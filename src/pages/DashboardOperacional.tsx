import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Car,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Route,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { NewRideModal, type EditingRide } from "@/components/dashboard/NewRideModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  classificacaoColor,
  classificacaoLabel,
  type Classificacao,
  type ClassifyParams,
} from "@/lib/rideClassification";
import { cn } from "@/lib/utils";
import { getTodaySP, getYesterdaySP, formatLongDateSP } from "@/lib/dateUtils";

interface RideRow {
  id: string;
  horario_inicio: string | null;
  duracao_minutos: number | null;
  valor_bruto: number | null;
  km_passageiro: number | null;
  km_deslocamento: number | null;
  classificacao: string | null;
  bairro_origem: string | null;
  bairro_destino: string | null;
}

const DEFAULT_PARAMS: ClassifyParams = {
  valor_minimo_corrida: 8,
  km_max_deslocamento: 3,
  r_por_km_minimo: 1.8,
  r_km_bom: 1.8,
  r_km_medio: 1.3,
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtKm = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}km`;

const fmtHora = (iso: string | null) => {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
};

const fmtDataHoje = () => formatLongDateSP();

export default function DashboardOperacional() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [yesterdayCount, setYesterdayCount] = useState(0);
  const [params, setParams] = useState<ClassifyParams>(DEFAULT_PARAMS);
  const [nome, setNome] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<EditingRide | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = async (id: string) => {
    const { data, error } = await supabase
      .from("rides")
      .select(
        "id, data_corrida, horario_inicio, horario_fim, valor_bruto, km_passageiro, km_deslocamento, rua_origem, bairro_origem, rua_destino, bairro_destino, observacao",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível carregar a corrida");
      return;
    }
    setEditing(data as EditingRide);
    setShowNew(true);
  };

  const todayStr = useMemo(() => getTodaySP(), []);
  const yesterdayStr = useMemo(() => getYesterdaySP(), []);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [profileRes, goalsRes, ridesRes, yRes] = await Promise.all([
      supabase.from("users").select("nome").eq("id", user.id).maybeSingle(),
      supabase
        .from("goals")
        .select("valor_minimo_corrida, km_max_deslocamento, r_por_km_minimo, r_km_bom, r_km_medio")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("rides")
        .select(
          "id, horario_inicio, duracao_minutos, valor_bruto, km_passageiro, km_deslocamento, classificacao, bairro_origem, bairro_destino",
        )
        .eq("user_id", user.id)
        .eq("data_corrida", todayStr)
        .order("horario_inicio", { ascending: false }),
      supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("data_corrida", yesterdayStr),
    ]);

    setNome(profileRes.data?.nome || "");
    if (goalsRes.data) {
      const g = goalsRes.data as any;
      const baseMin = Number(g.r_por_km_minimo) || DEFAULT_PARAMS.r_por_km_minimo;
      setParams({
        valor_minimo_corrida: Number(g.valor_minimo_corrida) || DEFAULT_PARAMS.valor_minimo_corrida,
        km_max_deslocamento: Number(g.km_max_deslocamento) || DEFAULT_PARAMS.km_max_deslocamento,
        r_por_km_minimo: baseMin,
        r_km_bom: Number(g.r_km_bom) || baseMin,
        r_km_medio: Number(g.r_km_medio) || Math.max(baseMin - 0.5, baseMin * 0.7),
      });
    }
    setRides((ridesRes.data as RideRow[]) || []);
    setYesterdayCount(yRes.count || 0);
    setLoading(false);
  }, [user, todayStr, yesterdayStr]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const stats = useMemo(() => {
    const total = rides.length;
    const km = rides.reduce(
      (sum, r) => sum + (Number(r.km_passageiro) || 0) + (Number(r.km_deslocamento) || 0),
      0,
    );
    const minutos = rides.reduce((sum, r) => sum + (Number(r.duracao_minutos) || 0), 0);
    const horas = minutos / 60;
    const boas = rides.filter((r) => r.classificacao === "BOA").length;
    const pctBoas = total > 0 ? (boas / total) * 100 : 0;
    return { total, km, horas, pctBoas };
  }, [rides]);

  const variacao = stats.total - yesterdayCount;
  const pctColor =
    stats.pctBoas >= 70 ? "text-success" : stats.pctBoas >= 40 ? "text-warning" : "text-destructive";

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("rides").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Corrida excluída");
    loadAll();
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Olá, {nome || "motorista"}! 👋
            </h1>
            <p className="text-sm text-muted-foreground">{fmtDataHoje()}</p>
          </div>
          <Button variant="gradient" onClick={() => setShowNew(true)} className="hidden sm:inline-flex">
            <Plus className="mr-2 h-4 w-4" /> Nova corrida
          </Button>
        </div>

        {/* Cards de resumo */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <SummaryCard
            icon={Car}
            label="Corridas hoje"
            value={String(stats.total)}
            badge={
              variacao !== 0 ? (
                <Badge variant="outline" className={cn("text-xs", variacao > 0 ? "text-success" : "text-destructive")}>
                  {variacao > 0 ? "+" : ""}
                  {variacao} vs ontem
                </Badge>
              ) : null
            }
          />
          <SummaryCard
            icon={Route}
            label="Km rodados"
            value={`${stats.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`}
          />
          <SummaryCard
            icon={Clock}
            label="Horas ao volante"
            value={`${stats.horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`}
          />
          <SummaryCard
            icon={TrendingUp}
            label="% corridas boas"
            value={`${stats.pctBoas.toFixed(0)}%`}
            valueClassName={pctColor}
          />
        </div>

        {/* Lista de corridas */}
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Corridas de Hoje</h2>
            {rides.length > 0 && (
              <span className="text-xs text-muted-foreground">{rides.length} registro(s)</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
            </div>
          ) : rides.length === 0 ? (
            <EmptyState onNew={() => setShowNew(true)} />
          ) : (
            <ul className="space-y-2">
              {rides.map((r) => (
                <RideItem
                  key={r.id}
                  ride={r}
                  onDelete={() => setDeleteId(r.id)}
                  onEdit={() => handleEdit(r.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* FAB mobile */}
      <Button
        variant="gradient"
        size="icon"
        className="fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full shadow-glow sm:hidden"
        onClick={() => setShowNew(true)}
        aria-label="Nova corrida"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <NewRideModal
        open={showNew}
        onOpenChange={(o) => {
          setShowNew(o);
          if (!o) setEditing(null);
        }}
        onSaved={loadAll}
        params={params}
        editing={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir corrida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  badge,
  valueClassName,
}: {
  icon: typeof Car;
  label: string;
  value: string;
  badge?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="p-4 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between">
        <div className="rounded-lg gradient-bg-soft p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {badge}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-display text-2xl font-bold", valueClassName)}>{value}</p>
    </Card>
  );
}

function RideItem({
  ride,
  onDelete,
  onEdit,
}: {
  ride: RideRow;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const c = (ride.classificacao as Classificacao) || "MEDIA";
  const kmPax = Number(ride.km_passageiro) || 0;
  const kmDesl = Number(ride.km_deslocamento) || 0;
  return (
    <li className="group flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 transition-colors hover:bg-secondary/60">
      <div className="w-14 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
        {fmtHora(ride.horario_inicio)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold">
            {fmtBRL(Number(ride.valor_bruto) || 0)}
          </span>
          <Badge variant="outline" className={cn("text-[10px]", classificacaoColor[c])}>
            {classificacaoLabel[c]}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {fmtKm(kmPax)} + {fmtKm(kmDesl)} vazio · {ride.duracao_minutos ?? 0}min
          {ride.bairro_origem && ` · ${ride.bairro_origem}`}
          {ride.bairro_destino && ` → ${ride.bairro_destino}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-2xl gradient-bg-soft p-5 animate-fade-in">
        <Car className="h-10 w-10 text-primary" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">
        Nenhuma corrida hoje ainda. Suas corridas Uber aparecem automaticamente aqui.
      </p>
      <Button variant="gradient" className="mt-5" onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" /> Registrar manualmente
      </Button>
    </div>
  );
}
