import { useEffect, useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  getDate,
  getDaysInMonth,
  format,
} from "date-fns";
import { CalendarIcon, TrendingDown, TrendingUp, Trophy, ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDailySeries,
  calcPeriodMetrics,
  diasRestantesSemana,
  fmtBRL,
  fmtNumber,
  getPeriodRange,
  metaPeriodo,
  nowInTZ,
  Periodo,
  projecaoFimDia,
  projecaoMensal,
  projecaoSemanal,
  resolveGoals,
  Ride,
  Vehicle,
  Goals,
} from "@/lib/financeiro";

export default function DashboardFinanceiro() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();
  const [rides, setRides] = useState<Ride[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [rRes, vRes, gRes] = await Promise.all([
        supabase
          .from("rides")
          .select("id,data_corrida,horario_inicio,horario_fim,valor_bruto,km_passageiro,km_deslocamento,km_total,duracao_minutos,classificacao,bairro_origem,bairro_destino")
          .eq("user_id", user.id)
          .order("data_corrida", { ascending: false })
          .limit(2000),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancel) return;
      setRides((rRes.data as Ride[]) || []);
      setVehicle((vRes.data as Vehicle) || null);
      setGoals((gRes.data as Goals) || null);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const range = useMemo(() => getPeriodRange(periodo, custom), [periodo, custom]);
  const metrics = useMemo(() => calcPeriodMetrics(rides, vehicle, range.from, range.to), [rides, vehicle, range]);
  const series = useMemo(() => buildDailySeries(rides, vehicle, range.from, range.to), [rides, vehicle, range]);
  const metas = useMemo(() => resolveGoals(goals, vehicle), [goals, vehicle]);

  // Indicadores por km/hora
  const custoTotalKm = metrics.kmTotal > 0 ? metrics.custoTotal / metrics.kmTotal : 0;
  const custoCombKm = metrics.kmTotal > 0 ? metrics.custoCombustivel / metrics.kmTotal : 0;
  const kmTotalPeriodo = metrics.kmTotal;
  const receitaBrutaPeriodo = metrics.ganhoBruto;
  const ganhoRealKm = kmTotalPeriodo > 0 ? receitaBrutaPeriodo / kmTotalPeriodo : 0;
  const ganhoPorKm = ganhoRealKm;
  const ganhoPorHora = metrics.ganhoBrutoPorHora;
  // Resultado do dia: receita bruta - ponto de equilíbrio diário
  const resultadoDia = receitaBrutaPeriodo - metrics.pontoEquilibrioDiario;

  // Comparativos
  const comparativoSemanas = useMemo(() => buildComparativoSemanas(rides, vehicle), [rides, vehicle]);
  const comparativoMeses = useMemo(() => buildComparativoMeses(rides, vehicle), [rides, vehicle]);

  // Donut data
  const donutData = [
    { name: "Combustível/Energia", value: Math.max(0, metrics.custoCombustivel), color: "hsl(var(--warning))" },
    { name: "Custos fixos", value: Math.max(0, metrics.custoFixoProporcional), color: "hsl(var(--primary))" },
    { name: "Comissão Uber", value: Math.max(0, metrics.comissaoUber), color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  // Métricas para cards de meta (sempre exibe diária, semanal, mensal)
  const metricsHoje = useMemo(() => {
    const r = getPeriodRange("hoje");
    return calcPeriodMetrics(rides, vehicle, r.from, r.to);
  }, [rides, vehicle]);
  const metricsSemana = useMemo(() => {
    const r = getPeriodRange("semana");
    return calcPeriodMetrics(rides, vehicle, r.from, r.to);
  }, [rides, vehicle]);
  const metricsMes = useMemo(() => {
    const r = getPeriodRange("mes");
    return calcPeriodMetrics(rides, vehicle, r.from, r.to);
  }, [rides, vehicle]);

  // Meta do período (compara receita bruta com a meta configurada)
  const metaDoPeriodo =
    periodo === "hoje"
      ? metas.diaria
      : periodo === "semana"
      ? metas.semanal
      : periodo === "mes"
      ? metas.mensal
      : metaPeriodo(metas.diaria, metrics.diasNoPeriodo);
  const percentualMeta = metaDoPeriodo > 0 ? Math.min(100, (metrics.ganhoBruto / metaDoPeriodo) * 100) : 0;

  const horasMetaDia = Number(goals?.horas_meta_dia || 8);
  const projDia = projecaoFimDia(metricsHoje.ganhoBruto, metricsHoje.horasTrabalhadas, horasMetaDia, metricsHoje.numCorridas);
  const projSem = projecaoSemanal(metricsSemana.ganhoBruto, metricsSemana.numCorridas);
  const diasRestSem = diasRestantesSemana();
  const hojeTZ = nowInTZ();
  const projMes = projecaoMensal(
    metricsMes.ganhoBruto,
    hojeTZ.getDate(),
    new Date(hojeTZ.getFullYear(), hojeTZ.getMonth() + 1, 0).getDate(),
    metricsMes.numCorridas
  );
  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Dashboard Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Acompanhe receitas, custos e lucro real do período</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <TabsList>
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="semana">Esta semana</TabsTrigger>
                <TabsTrigger value="mes">Este mês</TabsTrigger>
                <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
              </TabsList>
            </Tabs>
            {periodo === "personalizado" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {custom ? `${format(custom.from, "dd/MM")} - ${format(custom.to, "dd/MM")}` : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={custom ? { from: custom.from, to: custom.to } : undefined}
                    onSelect={(r: any) => {
                      if (r?.from && r?.to) setCustom({ from: r.from, to: r.to });
                    }}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Carregando dados financeiros…</CardContent>
          </Card>
        ) : (
          <>
            {/* RESULTADO DO PERÍODO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Receitas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Line2 label="Ganho bruto total" value={fmtBRL(metrics.ganhoBruto)} />
                  <Line2 label="Comissão Uber descontada" value={fmtBRL(metrics.comissaoUber)} muted />
                  <Line2 label="Ganho líquido após comissão" value={fmtBRL(metrics.ganhoLiquido)} bold />
                </CardContent>
              </Card>

              <Card className="border-rose-500/20 bg-rose-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">Custos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Line2 label="Combustível / energia" value={fmtBRL(metrics.custoCombustivel)} />
                  <Line2 label="Custo fixo proporcional" value={fmtBRL(metrics.custoFixoProporcional)} />
                  <Line2 label="Custo total do período" value={fmtBRL(metrics.custoTotal)} bold />
                </CardContent>
              </Card>
            </div>

            {/* GANHO REAL DESTAQUE */}
            <Card className={cn("overflow-hidden", metrics.ganhoReal >= 0 ? "border-emerald-500/40" : "border-destructive/40")}> 
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Ganho real do período</p>
                    <div className="flex items-center gap-2 mt-1">
                      {metrics.ganhoReal >= 0 ? (
                        <TrendingUp className="h-7 w-7 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-7 w-7 text-destructive" />
                      )}
                      <span
                        className={cn(
                          "font-display font-bold text-4xl md:text-5xl",
                          metrics.ganhoReal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                        )}
                      >
                        {fmtBRL(metrics.ganhoReal)}
                      </span>
                    </div>
                  </div>
                  <div className="md:w-1/2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso da meta</span>
                      <span className="font-semibold">{percentualMeta.toFixed(0)}%</span>
                    </div>
                    <Progress value={percentualMeta} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {percentualMeta.toFixed(0)}% da meta de {fmtBRL(metaDoPeriodo)} atingida
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* INDICADORES POR KM E HORA */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Indicadores por km e hora</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MiniCard title="Custo total por km" value={`R$ ${fmtNumber(custoTotalKm)}/km`} />
                <MiniCard title="Custo combustível por km" value={`R$ ${fmtNumber(custoCombKm)}/km`} hint="Use para avaliar corridas" />
                <MiniCard title="Ganho real por km" value={`R$ ${fmtNumber(ganhoPorKm)}/km`} positive={ganhoPorKm >= 0} hint="Bruto ÷ km totais (com vazio)" />
                <MiniCard title="Ganho real por hora" value={`R$ ${fmtNumber(ganhoPorHora)}/h`} positive={ganhoPorHora >= 0} hint="Bruto ÷ horas ao volante" />
                <MiniCard title="Ponto de equilíbrio diário" value={fmtBRL(metrics.pontoEquilibrioDiario)} hint="Mínimo para cobrir custos" />
                <MiniCard
                  title="Resultado do dia"
                  value={fmtBRL(resultadoDia)}
                  positive={resultadoDia >= 0}
                  hint={resultadoDia >= 0 ? "✓ Acima do equilíbrio" : `Faltam ${fmtBRL(Math.abs(resultadoDia))} para cobrir custos`}
                />
              </div>
            </div>

            {/* GRÁFICOS */}
            <Card>
              <CardHeader>
                <CardTitle>Evolução do ganho real</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id="ganhoFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                      <RechartsTooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(v: any, name: string) => {
                          if (name === "Corridas" || name === "Horas") return [v, name];
                          return [fmtBRL(Number(v)), name];
                        }}
                      />
                      {metas.diaria > 0 && (
                        <ReferenceLine y={metas.diaria} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "Meta diária", position: "right", fill: "hsl(var(--warning))", fontSize: 11 }} />
                      )}
                      <Area type="monotone" dataKey="ganhoReal" name="Ganho real" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ganhoFill)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="ganhoBruto" name="Ganho bruto" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Composição por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                      <RechartsTooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(v: any, name: string) => [fmtBRL(Number(v)), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="ganhoReal" name="Ganho real" stackId="a" fill="hsl(var(--success))" />
                      <Bar dataKey="custoCombustivel" name="Combustível" stackId="a" fill="hsl(var(--warning))" />
                      <Bar dataKey="custoFixo" name="Custo fixo" stackId="a" fill="hsl(var(--primary))" />
                      <Bar dataKey="comissaoUber" name="Comissão Uber" stackId="a" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Composição dos custos</CardTitle>
              </CardHeader>
              <CardContent>
                {donutData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">Nenhum custo registrado no período.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="h-64 w-full relative">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                            {donutData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs text-muted-foreground">Total</span>
                        <span className="font-display font-bold text-xl">{fmtBRL(metrics.custoTotal)}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {donutData.map((d) => {
                        const pct = metrics.custoTotal > 0 ? (d.value / metrics.custoTotal) * 100 : 0;
                        return (
                          <div key={d.name} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
                              <span className="text-sm">{d.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-sm">{fmtBRL(d.value)}</div>
                              <div className="text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* METAS */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Metas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetaCard
                  titulo="Meta diária"
                  atual={metricsHoje.ganhoBruto}
                  meta={metas.diaria}
                  rodape={projDia != null ? `Projeção fim do dia: ${fmtBRL(projDia)}` : "Projeção fim do dia: —"}
                />
                <MetaCard
                  titulo="Meta semanal"
                  atual={metricsSemana.ganhoBruto}
                  meta={metas.semanal}
                  rodape={
                    projSem != null
                      ? `Projeção semana: ${fmtBRL(projSem)} • ${diasRestSem} ${diasRestSem === 1 ? "dia restante" : "dias restantes"}`
                      : `${diasRestSem} ${diasRestSem === 1 ? "dia restante" : "dias restantes"}`
                  }
                />
                <MetaCard
                  titulo="Meta mensal"
                  atual={metricsMes.ganhoBruto}
                  meta={metas.mensal}
                  rodape={projMes != null ? `Projeção fechamento: ${fmtBRL(projMes)}` : "Projeção fechamento: —"}
                />
              </div>
            </div>

            {/* COMPARATIVOS */}
            <Card>
              <CardHeader>
                <CardTitle>Esta semana vs. semana passada</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ComparativoTable rows={comparativoSemanas} colA="Esta semana" colB="Semana passada" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Este mês vs. mês passado</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ComparativoTable rows={comparativoMeses} colA="Este mês" colB="Mês passado" />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Line2({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-sm", muted ? "text-muted-foreground" : "")}>{label}</span>
      <span className={cn("tabular-nums", bold ? "font-display font-bold text-lg" : "font-semibold")}>{value}</span>
    </div>
  );
}

function MiniCard({ title, value, hint, positive }: { title: string; value: string; hint?: string; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p
          className={cn(
            "text-lg font-display font-bold mt-1 tabular-nums",
            positive === true && "text-emerald-600 dark:text-emerald-400",
            positive === false && "text-destructive"
          )}
        >
          {value}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MetaCard({ titulo, atual, meta, rodape }: { titulo: string; atual: number; meta: number; rodape: string }) {
  const pct = meta > 0 ? Math.min(100, (atual / meta) * 100) : 0;
  const atingida = meta > 0 && atual >= meta;
  return (
    <Card className={cn("transition-all", atingida && "border-emerald-500 shadow-[0_0_0_2px_hsl(var(--success)/0.3)] animate-pulse")}> 
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{titulo}</p>
          {atingida && <Trophy className="h-5 w-5 text-emerald-500" />}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display font-bold text-xl tabular-nums">{fmtBRL(atual)}</span>
          <span className="text-xs text-muted-foreground">/ {fmtBRL(meta)}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">{pct.toFixed(0)}%</span>
          <span className="text-muted-foreground">{rodape}</span>
        </div>
        {atingida && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">🎉 Meta atingida! Excelente trabalho!</p>}
      </CardContent>
    </Card>
  );
}

interface CompRow {
  metric: string;
  a: number;
  b: number;
  format: "brl" | "num" | "rkm" | "rh";
}

function buildComparativoSemanas(rides: Ride[], vehicle: Vehicle | null): CompRow[] {
  const now = new Date();
  const aFrom = startOfWeek(now, { weekStartsOn: 1 });
  const aTo = endOfWeek(now, { weekStartsOn: 1 });
  const bFrom = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const bTo = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  return makeComp(calcPeriodMetrics(rides, vehicle, aFrom, aTo), calcPeriodMetrics(rides, vehicle, bFrom, bTo));
}

function buildComparativoMeses(rides: Ride[], vehicle: Vehicle | null): CompRow[] {
  const now = new Date();
  const aFrom = startOfMonth(now);
  const aTo = endOfMonth(now);
  const bFrom = startOfMonth(subMonths(now, 1));
  const bTo = endOfMonth(subMonths(now, 1));
  return makeComp(calcPeriodMetrics(rides, vehicle, aFrom, aTo), calcPeriodMetrics(rides, vehicle, bFrom, bTo));
}

function makeComp(a: ReturnType<typeof calcPeriodMetrics>, b: ReturnType<typeof calcPeriodMetrics>): CompRow[] {
  return [
    { metric: "Ganho real", a: a.ganhoReal, b: b.ganhoReal, format: "brl" },
    { metric: "Km rodados", a: a.kmTotal, b: b.kmTotal, format: "num" },
    { metric: "Corridas realizadas", a: a.numCorridas, b: b.numCorridas, format: "num" },
    { metric: "R$ / hora", a: a.ganhoBrutoPorHora, b: b.ganhoBrutoPorHora, format: "rh" },
    { metric: "R$ / km", a: a.ganhoBrutoPorKm, b: b.ganhoBrutoPorKm, format: "rkm" },
  ];
}

function ComparativoTable({ rows, colA, colB }: { rows: CompRow[]; colA: string; colB: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Métrica</TableHead>
          <TableHead className="text-right">{colA}</TableHead>
          <TableHead className="text-right">{colB}</TableHead>
          <TableHead className="text-right">Variação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const semBase = !r.b || r.b === 0;
          const diff = r.a - r.b;
          const pct = !semBase ? (diff / Math.abs(r.b)) * 100 : 0;
          const up = diff > 0;
          const flat = diff === 0;
          return (
            <TableRow key={r.metric}>
              <TableCell className="font-medium">{r.metric}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVal(r.a, r.format)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatVal(r.b, r.format)}</TableCell>
              <TableCell className="text-right">
                {semBase ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                    <Minus className="h-3 w-3" />
                    <span className="tabular-nums">—</span>
                    <span className="hidden sm:inline text-xs">Sem dados anteriores</span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 tabular-nums font-semibold text-sm",
                      flat ? "text-muted-foreground" : up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                    )}
                  >
                    {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {pct.toFixed(1)}%
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function formatVal(v: number, fmt: CompRow["format"]): string {
  switch (fmt) {
    case "brl":
      return fmtBRL(v);
    case "num":
      return fmtNumber(v, v % 1 === 0 ? 0 : 1);
    case "rkm":
      return `R$ ${fmtNumber(v)}/km`;
    case "rh":
      return `R$ ${fmtNumber(v)}/h`;
  }
}
