import { useEffect, useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
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
  filterRidesInRange,
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
  TZ,
  Ride,
  Vehicle,
  Goals,
  JornadaRecord,
} from "@/lib/financeiro";

export default function DashboardFinanceiro() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();
  const [rides, setRides] = useState<Ride[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [jornadas, setJornadas] = useState<JornadaRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [rRes, vRes, gRes, jRes] = await Promise.all([
        supabase
          .from("rides")
          .select("id,data_corrida,horario_inicio,horario_fim,valor_bruto,km_passageiro,km_deslocamento,km_total,duracao_minutos,classificacao,bairro_origem,bairro_destino")
          .eq("user_id", user.id)
          .order("data_corrida", { ascending: false })
          .limit(2000),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("jornadas" as any).select("*").eq("user_id", user.id).limit(2000),
      ]);
      if (cancel) return;
      setRides((rRes.data as Ride[]) || []);
      setVehicle((vRes.data as Vehicle) || null);
      setGoals((gRes.data as Goals) || null);
      setJornadas(((jRes.data as any) || []) as JornadaRecord[]);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const range = useMemo(() => getPeriodRange(periodo, custom), [periodo, custom]);
  const metrics = useMemo(() => calcPeriodMetrics(rides, vehicle, range.from, range.to, jornadas), [rides, vehicle, range, jornadas]);
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
  // Ticket médio por corrida
  const ticketMedio = metrics.numCorridas > 0 ? receitaBrutaPeriodo / metrics.numCorridas : 0;

  // Comparativos
  const comparativoHojeOntem = useMemo(() => buildComparativoHojeOntem(rides, vehicle, jornadas), [rides, vehicle, jornadas]);
  const comparativoSemanas = useMemo(() => buildComparativoSemanas(rides, vehicle, jornadas), [rides, vehicle, jornadas]);
  const comparativoMeses = useMemo(() => buildComparativoMeses(rides, vehicle, jornadas), [rides, vehicle, jornadas]);

  // Série para o gráfico "Evolução do ganho real":
  // - Filtro "hoje": eixo X por hora (00h..hora atual)
  // - Demais: por dia (mantém buildDailySeries)
  const evolucaoSeries = useMemo(() => {
    if (periodo !== "hoje") return series;
    return buildHourlySeriesToday(rides, range.from, range.to);
  }, [periodo, series, rides, range]);

  // Donut data
  const donutData = [
    { name: "Combustível/Energia", value: Math.max(0, metrics.custoCombustivel), color: "hsl(var(--warning))" },
    { name: "Custos fixos", value: Math.max(0, metrics.custoFixoProporcional), color: "hsl(var(--primary))" },
    { name: "Comissão Uber", value: Math.max(0, metrics.comissaoUber), color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  // Métricas para cards de meta (sempre exibe diária, semanal, mensal)
  const metricsHoje = useMemo(() => {
    const r = getPeriodRange("hoje");
    return calcPeriodMetrics(rides, vehicle, r.from, r.to, jornadas);
  }, [rides, vehicle, jornadas]);
  const metricsSemana = useMemo(() => {
    const r = getPeriodRange("semana");
    return calcPeriodMetrics(rides, vehicle, r.from, r.to, jornadas);
  }, [rides, vehicle, jornadas]);
  const metricsMes = useMemo(() => {
    const r = getPeriodRange("mes");
    return calcPeriodMetrics(rides, vehicle, r.from, r.to, jornadas);
  }, [rides, vehicle, jornadas]);

  // Meta do período (sempre usa o valor FIXO configurado pelo motorista,
  // nunca recalcula proporcional ao número de dias do filtro).
  const metaDoPeriodo =
    periodo === "hoje"
      ? metas.diaria
      : periodo === "semana"
      ? metas.semanal
      : periodo === "mes"
      ? metas.mensal
      : metas.mensal; // personalizado: sempre meta mensal
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
              <CustomRangePicker custom={custom} onApply={setCustom} />
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
                  title="Ticket médio por corrida"
                  value={metrics.numCorridas > 0 ? fmtBRL(ticketMedio) : "—"}
                  positive={metrics.numCorridas > 0}
                  hint="Receita média por corrida"
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
                    <AreaChart data={evolucaoSeries}>
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
                      {periodo !== "hoje" && metas.diaria > 0 && (
                        <ReferenceLine y={metas.diaria} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "Meta diária", position: "right", fill: "hsl(var(--warning))", fontSize: 11 }} />
                      )}
                      <Area type="monotone" dataKey="ganhoReal" name={periodo === "hoje" ? "Ganho na hora" : "Ganho real"} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ganhoFill)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      {periodo !== "hoje" && (
                        <Line type="monotone" dataKey="ganhoBruto" name="Ganho bruto" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} />
                      )}
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
                      <Bar dataKey="ganhoReal" name="Ganho real" fill="#22C55E" />
                      <Bar dataKey="custoCombustivel" name="Combustível" fill="#F97316" />
                      <Bar dataKey="custoFixo" name="Custo fixo" fill="#8B5CF6" />
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
                <MetaCard titulo="Meta diária" atual={metricsHoje.ganhoBruto} meta={metas.diaria} />
                <MetaCard titulo="Meta semanal" atual={metricsSemana.ganhoBruto} meta={metas.semanal} />
                <MetaCard titulo="Meta mensal" atual={metricsMes.ganhoBruto} meta={metas.mensal} />
              </div>
            </div>

            {/* COMPARATIVOS */}
            <Card>
              <CardHeader>
                <CardTitle>Hoje vs. ontem</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ComparativoTable rows={comparativoHojeOntem} colA="Hoje" colB="Ontem" />
              </CardContent>
            </Card>

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

function MetaCard({ titulo, atual, meta }: { titulo: string; atual: number; meta: number }) {
  // Sem meta configurada
  if (!meta || meta <= 0) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{titulo}</p>
          <div className="flex items-baseline justify-between">
            <span className="font-display font-bold text-xl tabular-nums">{fmtBRL(atual)}</span>
            <span className="text-xs text-muted-foreground">/ —</span>
          </div>
          <p className="text-xs text-muted-foreground italic">Meta não configurada</p>
        </CardContent>
      </Card>
    );
  }

  const pctRaw = (atual / meta) * 100;
  const atingida = pctRaw >= 100;
  const pctClamped = Math.min(100, Math.max(0, pctRaw));

  // Cor conforme faixa
  const corHex =
    pctRaw >= 100 ? "#22C55E" :
    pctRaw >= 80 ? "#EAB308" :
    pctRaw >= 50 ? "#F97316" :
    "#EF4444";

  // Gradiente da barra (ajusta intensidade até a posição atingida)
  const gradiente = atingida
    ? "linear-gradient(90deg, #22C55E 0%, #22C55E 100%)"
    : "linear-gradient(90deg, #EF4444 0%, #F97316 50%, #EAB308 80%, #22C55E 100%)";

  return (
    <Card className={cn("transition-all", atingida && "border-emerald-500 shadow-[0_0_24px_-4px_rgba(34,197,94,0.5)]")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{titulo}</p>
          {atingida && <Trophy className="h-5 w-5 text-emerald-500" />}
        </div>

        <div className="flex items-baseline justify-between">
          <span className="font-display font-bold text-xl tabular-nums">{fmtBRL(atual)}</span>
          <span className="text-xs text-muted-foreground">/ {fmtBRL(meta)}</span>
        </div>

        {/* Termômetro */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tabular-nums w-12 shrink-0" style={{ color: corHex }}>
            {atingida ? "100%+" : `${Math.round(pctRaw)}%`}
          </span>

          <div className="relative flex-1 pt-3">
            {/* Marcador triangular */}
            <div
              className="absolute -top-0.5 -translate-x-1/2 transition-all"
              style={{ left: `${pctClamped}%` }}
              aria-hidden="true"
            >
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `7px solid ${corHex}`,
                }}
              />
            </div>

            {/* Trilha + preenchimento */}
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "#2A2D3A" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pctClamped}%`,
                  background: gradiente,
                  backgroundSize: atingida ? "100% 100%" : `${100 / (pctClamped / 100 || 1)}% 100%`,
                  boxShadow: atingida ? "0 0 10px rgba(34,197,94,0.6)" : undefined,
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CompRow {
  metric: string;
  a: number;
  b: number;
  format: "brl" | "num" | "rkm" | "rh";
  aHasData: boolean;
  bHasData: boolean;
}

function buildComparativoHojeOntem(rides: Ride[], vehicle: Vehicle | null, jornadas: JornadaRecord[]): CompRow[] {
  const now = nowInTZ();
  const aFrom = startOfDay(now);
  const aTo = endOfDay(now);
  const ontem = subDays(now, 1);
  const bFrom = startOfDay(ontem);
  const bTo = endOfDay(ontem);
  return makeComp(
    calcPeriodMetrics(rides, vehicle, aFrom, aTo, jornadas),
    calcPeriodMetrics(rides, vehicle, bFrom, bTo, jornadas),
    { includeTicket: true },
  );
}

function buildComparativoSemanas(rides: Ride[], vehicle: Vehicle | null, jornadas: JornadaRecord[]): CompRow[] {
  const now = nowInTZ();
  const aFrom = startOfWeek(now, { weekStartsOn: 1 });
  const aTo = endOfWeek(now, { weekStartsOn: 1 });
  const bFrom = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const bTo = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  return makeComp(
    calcPeriodMetrics(rides, vehicle, aFrom, aTo, jornadas),
    calcPeriodMetrics(rides, vehicle, bFrom, bTo, jornadas),
    { includeTicket: true },
  );
}

function buildComparativoMeses(rides: Ride[], vehicle: Vehicle | null, jornadas: JornadaRecord[]): CompRow[] {
  const now = nowInTZ();
  const aFrom = startOfMonth(now);
  const aTo = endOfMonth(now);
  const bFrom = startOfMonth(subMonths(now, 1));
  const bTo = endOfMonth(subMonths(now, 1));
  return makeComp(
    calcPeriodMetrics(rides, vehicle, aFrom, aTo, jornadas),
    calcPeriodMetrics(rides, vehicle, bFrom, bTo, jornadas),
    { includeTicket: true },
  );
}

function makeComp(
  a: ReturnType<typeof calcPeriodMetrics>,
  b: ReturnType<typeof calcPeriodMetrics>,
  opts: { includeTicket?: boolean } = {},
): CompRow[] {
  const aHas = a.numCorridas > 0;
  const bHas = b.numCorridas > 0;
  const ticketA = a.numCorridas > 0 ? a.ganhoBruto / a.numCorridas : 0;
  const ticketB = b.numCorridas > 0 ? b.ganhoBruto / b.numCorridas : 0;
  const rows: CompRow[] = [
    { metric: "Ganho real", a: a.ganhoBruto, b: b.ganhoBruto, format: "brl", aHasData: aHas, bHasData: bHas },
    { metric: "Corridas realizadas", a: a.numCorridas, b: b.numCorridas, format: "num", aHasData: aHas, bHasData: bHas },
    { metric: "Km rodados", a: a.kmTotal, b: b.kmTotal, format: "num", aHasData: aHas, bHasData: bHas },
    { metric: "R$ / hora", a: a.ganhoBrutoPorHora, b: b.ganhoBrutoPorHora, format: "rh", aHasData: aHas, bHasData: bHas },
    { metric: "R$ / km", a: a.ganhoBrutoPorKm, b: b.ganhoBrutoPorKm, format: "rkm", aHasData: aHas, bHasData: bHas },
  ];
  if (opts.includeTicket) {
    rows.push({ metric: "Ticket médio", a: ticketA, b: ticketB, format: "brl", aHasData: aHas, bHasData: bHas });
  }
  return rows;
}

/** Constrói série horária para o filtro "hoje": uma barra/ponto por hora (00h..23h),
 *  somando o valor das corridas iniciadas naquela hora (em America/Sao_Paulo). */
function buildHourlySeriesToday(rides: Ride[], from: Date, to: Date) {
  const dayRides = filterRidesInRange(rides, from, to);
  const buckets: Record<number, { ganho: number; n: number }> = {};
  for (const r of dayRides) {
    let hour = 0;
    if (r.horario_inicio) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ,
        hour: "2-digit",
        hour12: false,
      }).formatToParts(new Date(r.horario_inicio));
      hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
      if (hour === 24) hour = 0;
    }
    if (!buckets[hour]) buckets[hour] = { ganho: 0, n: 0 };
    buckets[hour].ganho += Number(r.valor_bruto || 0);
    buckets[hour].n += 1;
  }
  // Eixo X fixo: 00h..23h (24 horas completas), independentemente da hora atual.
  const out: { date: string; label: string; ganhoReal: number; ganhoBruto: number; numCorridas: number }[] = [];
  for (let h = 0; h <= 23; h++) {
    const b = buckets[h] || { ganho: 0, n: 0 };
    out.push({
      date: String(h),
      label: `${String(h).padStart(2, "0")}h`,
      ganhoReal: b.ganho,
      ganhoBruto: b.ganho,
      numCorridas: b.n,
    });
  }
  return out;
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
          const semBase = !r.bHasData;
          const diff = r.a - r.b;
          const pct = !semBase && r.b !== 0 ? (diff / Math.abs(r.b)) * 100 : 0;
          const up = diff > 0;
          const flat = diff === 0;
          return (
            <TableRow key={r.metric}>
              <TableCell className="font-medium">{r.metric}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.aHasData ? formatVal(r.a, r.format) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {r.bHasData ? formatVal(r.b, r.format) : "—"}
              </TableCell>
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

function CustomRangePicker({
  custom,
  onApply,
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

  const handleApply = () => {
    if (draft?.from && draft?.to) {
      onApply({ from: draft.from, to: draft.to });
      setOpen(false);
    }
  };

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
              : "Selecione data inicial e final"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply} disabled={!draft?.from || !draft?.to}>
              Aplicar período
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
