import { useEffect, useMemo, useState } from "react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, parseISO,
} from "date-fns";
import { CalendarIcon, Plus, Trophy, Eye, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtBRL, nowInTZ, resolveGoals, type Goals, type Vehicle } from "@/lib/financeiro";
import { PlataformaDot, plataformaColor } from "@/lib/plataformas";
import { LancamentoModal, type LancamentoTipo, type LancamentoEditData } from "@/components/dashboard/LancamentoModal";

type Periodo = "hoje" | "semana" | "mes" | "acumulado" | "personalizado";

interface RideRow {
  id: string;
  data_corrida: string | null;
  horario_inicio: string | null;
  valor_bruto: number | null;
  plataforma: string | null;
  bairro_origem: string | null;
  bairro_destino: string | null;
}

interface Lancamento {
  id: string;
  user_id: string;
  tipo: "ganho" | "custo";
  conta: string;
  descricao: string | null;
  valor: number;
  data: string;
  created_at: string;
}

const ORDEM_GANHOS = [
  "Ganhos Uber", "Ganhos 99", "Ganhos InDrive",
  "Transfers", "Gorjetas", "Particular", "Outros Ganhos",
];

const ORDEM_CUSTOS = [
  "Taxa/Passe Uber", "Taxa/Passe 99", "Taxa/Passe InDrive",
  "Financiamento de Veículo", "Aluguel de Veículo",
  "Combustível", "Estacionamentos", "Pedágio", "IPVA",
  "Manutenção Veículo", "Seguro Veículo", "Lavagem/Higienização",
  "Plano Celular", "Despesas com Alimentação", "Outros Custos Diversos",
];

const PLAT_TO_CONTA: Record<string, string> = {
  Uber: "Ganhos Uber",
  "99": "Ganhos 99",
  InDrive: "Ganhos InDrive",
  Particular: "Particular",
};

function getRange(periodo: Periodo, custom?: { from: Date; to: Date }): { from: Date; to: Date } {
  const n = nowInTZ();
  switch (periodo) {
    case "hoje": return { from: startOfDay(n), to: endOfDay(n) };
    case "semana": return { from: startOfWeek(n, { weekStartsOn: 1 }), to: endOfWeek(n, { weekStartsOn: 1 }) };
    case "mes": return { from: startOfMonth(n), to: endOfMonth(n) };
    case "acumulado": return { from: new Date(2000, 0, 1), to: new Date(2999, 11, 31) };
    case "personalizado":
      return custom
        ? { from: startOfDay(custom.from), to: endOfDay(custom.to) }
        : { from: startOfDay(n), to: endOfDay(n) };
  }
}

function rideDateKey(r: RideRow): string | null {
  return r.data_corrida ?? (r.horario_inicio ? r.horario_inicio.slice(0, 10) : null);
}

function inRangeStr(dateStr: string | null, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const f = format(from, "yyyy-MM-dd");
  const t = format(to, "yyyy-MM-dd");
  return dateStr >= f && dateStr <= t;
}

export default function DashboardFinanceiro() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [lancamentoTipo, setLancamentoTipo] = useState<LancamentoTipo | null>(null);
  const [editingLanc, setEditingLanc] = useState<LancamentoEditData | null>(null);
  const [viewLanc, setViewLanc] = useState<{
    tipo: string; conta: string; descricao: string; valor: number; data: string; plataforma?: string | null;
  } | null>(null);
  const [deleteLancId, setDeleteLancId] = useState<string | null>(null);
  const [drillConta, setDrillConta] = useState<{ conta: string; tipo: "ganho" | "custo" } | null>(null);

  const refresh = async () => {
    if (!user) return;
    const [rRes, lRes, vRes, gRes] = await Promise.all([
      supabase.from("rides")
        .select("id,data_corrida,horario_inicio,valor_bruto,plataforma,bairro_origem,bairro_destino")
        .eq("user_id", user.id)
        .order("data_corrida", { ascending: false })
        .limit(5000),
      supabase.from("lancamentos" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .limit(5000),
      supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setRides(((rRes.data as RideRow[]) || []));
    setLancamentos(((lRes.data as any[]) || []) as Lancamento[]);
    setVehicle((vRes.data as Vehicle) || null);
    setGoals((gRes.data as Goals) || null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const range = useMemo(() => getRange(periodo, custom), [periodo, custom]);
  const metas = useMemo(() => resolveGoals(goals, vehicle), [goals, vehicle]);

  const ridesNoPeriodo = useMemo(
    () => rides.filter((r) => inRangeStr(rideDateKey(r), range.from, range.to)),
    [rides, range],
  );
  const lancsNoPeriodo = useMemo(
    () => lancamentos.filter((l) => inRangeStr(l.data, range.from, range.to)),
    [lancamentos, range],
  );

  // Totais por conta de GANHO (corridas agrupadas por plataforma + lançamentos tipo=ganho)
  const ganhosPorConta = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of ridesNoPeriodo) {
      const conta = PLAT_TO_CONTA[r.plataforma || "Uber"] || "Outros Ganhos";
      map[conta] = (map[conta] || 0) + Number(r.valor_bruto || 0);
    }
    for (const l of lancsNoPeriodo.filter((x) => x.tipo === "ganho")) {
      map[l.conta] = (map[l.conta] || 0) + Number(l.valor || 0);
    }
    return map;
  }, [ridesNoPeriodo, lancsNoPeriodo]);

  const custosPorConta = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lancsNoPeriodo.filter((x) => x.tipo === "custo")) {
      map[l.conta] = (map[l.conta] || 0) + Number(l.valor || 0);
    }
    return map;
  }, [lancsNoPeriodo]);

  const ganhoBruto = Object.values(ganhosPorConta).reduce((a, b) => a + b, 0);
  const custoTotal = Object.values(custosPorConta).reduce((a, b) => a + b, 0);
  const ganhoLiquido = ganhoBruto - custoTotal;

  // Metas
  const ganhoBrutoHoje = useMemo(() => calcGanhoBrutoSimples(rides, lancamentos, getRange("hoje")), [rides, lancamentos]);
  const ganhoBrutoSem = useMemo(() => calcGanhoBrutoSimples(rides, lancamentos, getRange("semana")), [rides, lancamentos]);
  const ganhoBrutoMes = useMemo(() => calcGanhoBrutoSimples(rides, lancamentos, getRange("mes")), [rides, lancamentos]);

  // Extrato unificado (corridas + lançamentos)
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [periodo, custom]);
  const PAGE_SIZE = 20;

  const extrato = useMemo(() => {
    type Linha = {
      key: string;
      data: string;
      tipo: "Corrida" | "Ganho" | "Custo";
      conta: string;
      descricao: string;
      valor: number;
      cor: "verde" | "vermelho";
      plataforma?: string | null;
    };
    const linhas: Linha[] = [];
    for (const r of ridesNoPeriodo) {
      const d = rideDateKey(r) || "";
      linhas.push({
        key: `r-${r.id}`,
        data: d,
        tipo: "Corrida",
        conta: r.plataforma || "Uber",
        descricao: [r.bairro_origem, r.bairro_destino].filter(Boolean).join(" → ") || "—",
        valor: Number(r.valor_bruto || 0),
        cor: "verde",
        plataforma: r.plataforma,
      });
    }
    for (const l of lancsNoPeriodo) {
      linhas.push({
        key: `l-${l.id}`,
        data: l.data,
        tipo: l.tipo === "ganho" ? "Ganho" : "Custo",
        conta: l.conta,
        descricao: l.descricao || "—",
        valor: Number(l.valor || 0),
        cor: l.tipo === "ganho" ? "verde" : "vermelho",
      });
    }
    linhas.sort((a, b) => (a.data < b.data ? 1 : -1));
    return linhas;
  }, [ridesNoPeriodo, lancsNoPeriodo]);

  const totalPages = Math.max(1, Math.ceil(extrato.length / PAGE_SIZE));
  const pageRows = extrato.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hoje = format(nowInTZ(), "yyyy-MM-dd");

  // Lançamentos que compõem uma conta no drill
  const drillRows = useMemo(() => {
    if (!drillConta) return [];
    if (drillConta.tipo === "custo") {
      return lancsNoPeriodo
        .filter((l) => l.tipo === "custo" && l.conta === drillConta.conta)
        .map((l) => ({ data: l.data, descricao: l.descricao || "—", plataforma: "—", valor: l.valor }));
    }
    // ganho
    const linhas: { data: string; descricao: string; plataforma: string; valor: number }[] = [];
    const plat = Object.entries(PLAT_TO_CONTA).find(([, c]) => c === drillConta.conta)?.[0];
    if (plat) {
      for (const r of ridesNoPeriodo.filter((r) => (r.plataforma || "Uber") === plat)) {
        linhas.push({
          data: rideDateKey(r) || "",
          descricao: [r.bairro_origem, r.bairro_destino].filter(Boolean).join(" → ") || "Corrida",
          plataforma: plat,
          valor: Number(r.valor_bruto || 0),
        });
      }
    }
    for (const l of lancsNoPeriodo.filter((l) => l.tipo === "ganho" && l.conta === drillConta.conta)) {
      linhas.push({ data: l.data, descricao: l.descricao || "—", plataforma: "—", valor: l.valor });
    }
    linhas.sort((a, b) => (a.data < b.data ? 1 : -1));
    return linhas;
  }, [drillConta, ridesNoPeriodo, lancsNoPeriodo]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Demonstrativo financeiro completo com ganhos, custos e lucro líquido real.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <TabsList>
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mês</TabsTrigger>
                <TabsTrigger value="acumulado">Acumulado</TabsTrigger>
                <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
              </TabsList>
            </Tabs>
            {periodo === "personalizado" && (
              <CustomRangePicker custom={custom} onApply={setCustom} />
            )}
            <LancarDropdown onPick={setLancamentoTipo} />
          </div>
        </div>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : (
          <>
            {/* 3 CARDS PRINCIPAIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BigCard title="💰 Ganho Bruto" value={ganhoBruto} positive />
              <BigCard title="💸 Custo Total" value={custoTotal} negative />
              <BigCard title="✅ Ganho Líquido" value={ganhoLiquido} positive={ganhoLiquido >= 0} negative={ganhoLiquido < 0} />
            </div>

            {/* METAS */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Metas (base: ganho bruto)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetaCard titulo="Meta diária" atual={ganhoBrutoHoje} meta={metas.diaria} />
                <MetaCard titulo="Meta semanal" atual={ganhoBrutoSem} meta={metas.semanal} />
                <MetaCard titulo="Meta mensal" atual={ganhoBrutoMes} meta={metas.mensal} />
              </div>
            </div>

            {/* DEMONSTRATIVO FINANCEIRO */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📊 Demonstrativo Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <DRESecao
                  titulo="GANHO TOTAL NO PERÍODO"
                  total={ganhoBruto}
                  ordem={ORDEM_GANHOS}
                  valores={ganhosPorConta}
                  totalColor="text-emerald-500"
                  onClickConta={(c) => setDrillConta({ conta: c, tipo: "ganho" })}
                />
                <DRESecao
                  titulo="CUSTO TOTAL NO PERÍODO"
                  total={custoTotal}
                  ordem={ORDEM_CUSTOS}
                  valores={custosPorConta}
                  totalColor="text-rose-500"
                  onClickConta={(c) => setDrillConta({ conta: c, tipo: "custo" })}
                />
                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="font-display font-bold uppercase tracking-wide">GANHO LÍQUIDO TOTAL</span>
                  <span className={cn("font-display font-bold text-xl tabular-nums", ganhoLiquido >= 0 ? "text-emerald-500" : "text-destructive")}>
                    {fmtBRL(ganhoLiquido)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* EXTRATO ANALÍTICO */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📋 Extrato de Lançamentos</CardTitle>
              </CardHeader>
              <CardContent>
                {extrato.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento no período.</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {fmtData(row.data)}
                              {row.data > hoje && (
                                <Badge variant="outline" className="ml-2 text-[9px]">📅 Previsto</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{row.tipo}</TableCell>
                            <TableCell className="text-xs">
                              {row.tipo === "Corrida" ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <PlataformaDot plataforma={row.plataforma} size={8} />
                                  {row.conta}
                                </span>
                              ) : row.conta}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{row.descricao}</TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums font-semibold text-xs",
                              row.cor === "verde" ? "text-emerald-500" : "text-rose-500",
                            )}>
                              {row.cor === "vermelho" ? "-" : ""}{fmtBRL(row.valor)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
                      <span>{extrato.length} lançamento(s)</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                        <span>Página {page} de {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modais */}
      {lancamentoTipo && (
        <LancamentoModal
          open
          tipo={lancamentoTipo}
          onOpenChange={(o) => !o && setLancamentoTipo(null)}
          onSaved={refresh}
        />
      )}

      <Dialog open={!!drillConta} onOpenChange={(o) => !o && setDrillConta(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drillConta?.conta}</DialogTitle>
            <DialogDescription>Lançamentos que compõem este valor no período.</DialogDescription>
          </DialogHeader>
          {drillRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem lançamentos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtData(r.data)}</TableCell>
                    <TableCell className="text-xs">{r.descricao}</TableCell>
                    <TableCell className="text-xs">{r.plataforma}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold">{fmtBRL(r.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function calcGanhoBrutoSimples(rides: RideRow[], lancs: Lancamento[], r: { from: Date; to: Date }): number {
  let total = 0;
  for (const ride of rides) {
    if (inRangeStr(rideDateKey(ride), r.from, r.to)) total += Number(ride.valor_bruto || 0);
  }
  for (const l of lancs) {
    if (l.tipo === "ganho" && inRangeStr(l.data, r.from, r.to)) total += Number(l.valor || 0);
  }
  return total;
}

function fmtData(yyyyMmDd: string): string {
  try {
    return format(parseISO(yyyyMmDd), "dd/MM/yyyy");
  } catch {
    return yyyyMmDd;
  }
}

function BigCard({ title, value, positive, negative }: { title: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className={cn(
          "mt-2 font-display font-bold text-3xl tabular-nums",
          positive && "text-emerald-500",
          negative && "text-rose-500",
        )}>
          {fmtBRL(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function DRESecao({
  titulo, total, ordem, valores, totalColor, onClickConta,
}: {
  titulo: string;
  total: number;
  ordem: string[];
  valores: Record<string, number>;
  totalColor: string;
  onClickConta: (c: string) => void;
}) {
  const linhas = ordem.filter((k) => (valores[k] || 0) > 0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="font-display font-bold text-sm uppercase tracking-wide">{titulo}</span>
        <span className={cn("font-display font-bold tabular-nums", totalColor)}>{fmtBRL(total)}</span>
      </div>
      {linhas.map((conta) => (
        <button
          key={conta}
          type="button"
          onClick={() => onClickConta(conta)}
          className="w-full flex items-center justify-between py-1.5 px-2 text-sm rounded hover:bg-muted/50 transition-colors"
        >
          <span className="text-muted-foreground">{conta}</span>
          <span className="tabular-nums font-medium">{fmtBRL(valores[conta])}</span>
        </button>
      ))}
      {linhas.length === 0 && <p className="text-xs text-muted-foreground italic py-1.5 px-2">Sem lançamentos no período.</p>}
    </div>
  );
}

function MetaCard({ titulo, atual, meta }: { titulo: string; atual: number; meta: number }) {
  if (!meta || meta <= 0) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">{titulo}</p>
          <p className="font-display font-bold text-xl tabular-nums">{fmtBRL(atual)}</p>
          <p className="text-xs text-muted-foreground italic">Meta não configurada</p>
        </CardContent>
      </Card>
    );
  }
  const pct = Math.min(100, (atual / meta) * 100);
  const atingida = atual >= meta;
  return (
    <Card className={cn(atingida && "border-emerald-500/60")}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{titulo}</p>
          {atingida && <Trophy className="h-4 w-4 text-emerald-500" />}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display font-bold text-xl tabular-nums">{fmtBRL(atual)}</span>
          <span className="text-xs text-muted-foreground">/ {fmtBRL(meta)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% da meta</p>
      </CardContent>
    </Card>
  );
}

function LancarDropdown({ onPick }: { onPick: (t: LancamentoTipo) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="gradient" size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Lançar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onPick("ganho")}>💰 Lançar ganho</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("custo")}>💸 Lançar custo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CustomRangePicker({
  custom, onApply,
}: {
  custom: { from: Date; to: Date } | undefined;
  onApply: (r: { from: Date; to: Date } | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date } | undefined>(
    custom ? { from: custom.from, to: custom.to } : undefined,
  );
  useEffect(() => {
    if (open) setDraft(custom ? { from: custom.from, to: custom.to } : undefined);
  }, [open, custom]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {custom ? `${format(custom.from, "dd/MM")} - ${format(custom.to, "dd/MM")}` : "Selecionar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={draft as any}
          onSelect={(r: any) => setDraft(r || undefined)}
          numberOfMonths={2}
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
          <div className="text-xs text-muted-foreground">
            {draft?.from && draft?.to
              ? `${format(draft.from, "dd/MM/yyyy")} → ${format(draft.to, "dd/MM/yyyy")}`
              : "Inclui datas futuras p/ provisão"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={!draft?.from || !draft?.to}
              onClick={() => { if (draft?.from && draft?.to) { onApply({ from: draft.from, to: draft.to }); setOpen(false); } }}
            >Aplicar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
