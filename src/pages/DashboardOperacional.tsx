import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarIcon,
  Car,
  Clock,
  Eye,
  
  Pencil,
  Plus,
  Route,
  Trash2,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { NewRideModal, type EditingRide } from "@/components/dashboard/NewRideModal";
import { RideViewModal, type ViewRide } from "@/components/dashboard/RideViewModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { getTodaySP, formatLongDateSP } from "@/lib/dateUtils";
import { nowInTZ } from "@/lib/financeiro";
import { JornadaTimer } from "@/components/dashboard/JornadaTimer";

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
  origem?: string | null;
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
  const [viewing, setViewing] = useState<ViewRide | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => nowInTZ());
  const [jornadaMinutes, setJornadaMinutes] = useState(0);
  const [jornadaTick, setJornadaTick] = useState(0);

  const selectedDateStr = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);
  const todayStr = useMemo(() => getTodaySP(), []);
  
  const isToday = selectedDateStr === todayStr;
  // Comparativo: dia anterior à data selecionada
  const prevDayStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    return format(d, "yyyy-MM-dd");
  }, [selectedDate]);

  const handleView = async (id: string) => {
    const { data, error } = await supabase
      .from("rides")
      .select(
        "id, data_corrida, horario_inicio, horario_fim, duracao_minutos, valor_bruto, custo_combustivel_corrida, ganho_real_corrida, km_passageiro, km_deslocamento, rua_origem, bairro_origem, rua_destino, bairro_destino, classificacao, observacao",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível carregar a corrida");
      return;
    }
    setViewing(data as ViewRide);
  };

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
    setViewing(null);
    setEditing(data as EditingRide);
    setShowNew(true);
  };

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [profileRes, goalsRes, ridesRes, yRes, jornadasRes] = await Promise.all([
      supabase.from("users").select("nome").eq("id", user.id).maybeSingle(),
      supabase
        .from("goals")
        .select("valor_minimo_corrida, km_max_deslocamento, r_por_km_minimo, r_km_bom, r_km_medio")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("rides")
        .select(
          "id, horario_inicio, duracao_minutos, valor_bruto, km_passageiro, km_deslocamento, classificacao, bairro_origem, bairro_destino, origem",
        )
        .eq("user_id", user.id)
        .eq("data_corrida", selectedDateStr)
        .order("horario_inicio", { ascending: false }),
      supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("data_corrida", prevDayStr),
      supabase
        .from("jornadas" as any)
        .select("inicio, fim, duracao_minutos")
        .eq("user_id", user.id)
        .eq("data_jornada", selectedDateStr),
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
    const js = ((jornadasRes.data as any) || []) as Array<{ inicio: string; fim: string | null; duracao_minutos: number | null }>;
    const totalMin = js.reduce((sum, j) => {
      if (j.fim) return sum + (Number(j.duracao_minutos) || 0);
      return sum + (Date.now() - new Date(j.inicio).getTime()) / 60000;
    }, 0);
    setJornadaMinutes(totalMin);
    setLoading(false);
  }, [user, selectedDateStr, prevDayStr, jornadaTick]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const stats = useMemo(() => {
    const total = rides.length;
    const km = rides.reduce(
      (sum, r) => sum + (Number(r.km_passageiro) || 0) + (Number(r.km_deslocamento) || 0),
      0,
    );
    const horasCorridas = rides.reduce((sum, r) => sum + (Number(r.duracao_minutos) || 0), 0) / 60;
    const horasJornada = jornadaMinutes / 60;
    const horas = horasJornada > 0 ? horasJornada : horasCorridas;
    const boas = rides.filter((r) => r.classificacao === "BOA").length;
    const pctBoas = total > 0 ? (boas / total) * 100 : 0;
    const ganhoBruto = rides.reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0);
    return { total, km, horas, pctBoas, ganhoBruto, usaJornada: horasJornada > 0 };
  }, [rides, jornadaMinutes]);

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

        {isToday && <JornadaTimer onChange={() => setJornadaTick((t) => t + 1)} />}

        {/* Cards de resumo */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <SummaryCard
            icon={DollarSign}
            label={isToday ? "Bruto hoje" : "Bruto no dia"}
            value={fmtBRL(stats.ganhoBruto)}
          />
          <SummaryCard
            icon={Car}
            label={isToday ? "Corridas hoje" : "Corridas no dia"}
            value={String(stats.total)}
            badge={
              variacao !== 0 ? (
                <Badge variant="outline" className={cn("text-xs", variacao > 0 ? "text-success" : "text-destructive")}>
                  {variacao > 0 ? "+" : ""}
                  {variacao} {isToday ? "vs ontem" : "vs dia anterior"}
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
            label={stats.usaJornada ? "Horas no volante (tempo online)" : "Horas no volante"}
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold">
                {isToday ? "Corridas de Hoje" : "Corridas do dia"}
              </h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {format(selectedDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    disabled={(date) => date > nowInTZ()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {rides.length > 0 && (
              <span className="text-xs text-muted-foreground">{rides.length} registro(s)</span>
            )}
          </div>

          {!isToday && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs">
              <span>
                📅 Visualizando{" "}
                {selectedDate
                  .toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: "America/Sao_Paulo",
                  })
                  .replace(/^./, (m) => m.toUpperCase())}
              </span>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedDate(nowInTZ())}>
                Voltar para hoje
              </Button>
            </div>
          )}

          {loading ? (
            <ul className="space-y-2">
              {[0,1,2,3].map((i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted/70" />
                  </div>
                </li>
              ))}
            </ul>
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
                  onView={() => handleView(r.id)}
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
        defaultDate={selectedDate}
      />

      <RideViewModal
        ride={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={() => viewing && handleEdit(viewing.id)}
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
  onView,
}: {
  ride: RideRow;
  onDelete: () => void;
  onEdit: () => void;
  onView: () => void;
}) {
  const c = (ride.classificacao as Classificacao) || "MEDIA";
  const kmPax = Number(ride.km_passageiro) || 0;
  const kmDesl = Number(ride.km_deslocamento) || 0;
  const valor = Number(ride.valor_bruto) || 0;
  const dur = Number(ride.duracao_minutos) || 0;
  const insight = buildInsight(c, valor, kmPax, kmDesl, dur);
  return (
    <li className="group rounded-lg border border-border/60 bg-secondary/30 p-3 transition-colors hover:bg-secondary/60">
      <div className="flex items-center gap-3">
        <div className="w-14 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
          {fmtHora(ride.horario_inicio)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold">{fmtBRL(valor)}</span>
            <Badge variant="outline" className={cn("text-[10px]", classificacaoColor[c])}>
              {classificacaoLabel[c]}
            </Badge>
            {ride.origem === "uber_sync" && (
              <span title="Sincronizada automaticamente da Uber" className="text-xs">🔄</span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {fmtKm(kmPax)} + {fmtKm(kmDesl)} vazio · {dur}min
            {ride.bairro_origem && ` · ${ride.bairro_origem}`}
            {ride.bairro_destino && ` → ${ride.bairro_destino}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView} aria-label="Visualizar">
            <Eye className="h-3.5 w-3.5" />
          </Button>
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
      </div>
      <p className="mt-1 pl-[3.75rem] text-xs italic text-purple-400/80 dark:text-purple-300/80">
        {insight}
      </p>
    </li>
  );
}

function buildInsight(
  c: Classificacao,
  valor: number,
  kmPax: number,
  kmDesl: number,
  dur: number,
): string {
  if (c === "BOA") {
    if (kmDesl < 0.5) return "✨ Corrida eficiente — deslocamento mínimo com ótimo retorno por km.";
    if (valor > 15) return "🏆 Corrida premium — entre as mais rentáveis do dia.";
    return "✅ Boa corrida — acima da sua meta de R$/km.";
  }
  if (c === "MEDIA") {
    if (kmDesl > kmPax) return "⚠️ Você rodou mais vazio que com passageiro — impactou o R$/km.";
    if (dur > 15) return "⏱️ Corrida longa — avalie se o tempo valeu o retorno.";
    return "📊 Corrida dentro da média — há espaço para melhorar.";
  }
  // RUIM
  if (kmDesl > 1.5) return "🔴 Alto deslocamento vazio reduziu seu ganho real nesta corrida.";
  if (valor < 6) return "🔴 Valor baixo para a distância — considere os parâmetros de aceitação.";
  return "🔴 Corrida abaixo da meta — revise seus critérios de aceitação.";
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div className="mb-4 rounded-2xl gradient-bg-soft p-5 animate-pulse">
        <Car className="h-10 w-10 text-primary" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">
        Nenhuma corrida hoje ainda. Que tal registrar a primeira?
      </p>
      <Button variant="gradient" className="mt-5 hover-scale" onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" /> Registrar Corrida
      </Button>
    </div>
  );
}
