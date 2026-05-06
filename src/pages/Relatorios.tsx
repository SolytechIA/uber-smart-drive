import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  subMonths,
  getDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, TrendingDown, TrendingUp, Trophy, ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Goals,
  Ride,
  TZ,
  Vehicle,
  buildDailySeries,
  calcCustoCombustivel,
  calcCustoFixoMensal,
  calcPeriodMetrics,
  filterRidesInRange,
  fmtBRL,
  fmtInTZ,
  fmtNumber,
  nowInTZ,
  resolveGoals,
} from "@/lib/financeiro";
import { exportCSV } from "@/lib/csvExport";

// ============================================================
// Helpers
// ============================================================

function diaSemanaLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: TZ });
}

function rideRefDateSP(r: Ride): Date | null {
  if (r.data_corrida) return new Date(r.data_corrida + "T12:00:00");
  if (r.horario_inicio) {
    return new Date(new Date(r.horario_inicio).toLocaleString("en-US", { timeZone: TZ }));
  }
  return null;
}

function rideKmTotal(r: Ride): number {
  return Number(r.km_total ?? (Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0)));
}

function rideRPorKmReal(r: Ride): number {
  const km = rideKmTotal(r);
  return km > 0 ? Number(r.valor_bruto || 0) / km : 0;
}

interface ResumoCardProps {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
  negative?: boolean;
}
function ResumoCard({ label, value, hint, positive, negative }: ResumoCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold",
            positive && "text-success",
            negative && "text-destructive",
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Página
// ============================================================

export default function Relatorios() {
  const { user } = useAuth();
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
          .select(
            "id,data_corrida,horario_inicio,horario_fim,valor_bruto,km_passageiro,km_deslocamento,km_total,duracao_minutos,classificacao,bairro_origem,bairro_destino,rua_origem,rua_destino",
          )
          .eq("user_id", user.id)
          .order("horario_inicio", { ascending: false })
          .limit(5000),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancel) return;
      setRides(((rRes.data as any[]) || []) as Ride[]);
      setVehicle((vRes.data as Vehicle) || null);
      setGoals((gRes.data as Goals) || null);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold md:text-3xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análises detalhadas do seu desempenho — todas no fuso de São Paulo.
          </p>
        </header>

        <Tabs defaultValue="diario" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 md:w-auto md:inline-flex">
            <TabsTrigger value="diario">Diário</TabsTrigger>
            <TabsTrigger value="semanal">Semanal</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
            <TabsTrigger value="acumulado">Acumulado</TabsTrigger>
          </TabsList>

          <TabsContent value="diario">
            <AbaDiario rides={rides} vehicle={vehicle} loading={loading} />
          </TabsContent>
          <TabsContent value="semanal">
            <AbaSemanal rides={rides} vehicle={vehicle} loading={loading} />
          </TabsContent>
          <TabsContent value="mensal">
            <AbaMensal rides={rides} vehicle={vehicle} goals={goals} loading={loading} />
          </TabsContent>
          <TabsContent value="acumulado">
            <AbaAcumulado rides={rides} vehicle={vehicle} goals={goals} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ============================================================
// ABA DIÁRIO
// ============================================================

function AbaDiario({ rides, vehicle, loading }: { rides: Ride[]; vehicle: Vehicle | null; loading: boolean }) {
  const [date, setDate] = useState<Date>(() => nowInTZ());
  const from = startOfDay(date);
  const to = endOfDay(date);

  const m = useMemo(() => calcPeriodMetrics(rides, vehicle, from, to), [rides, vehicle, from, to]);
  const dayRides = useMemo(() => filterRidesInRange(rides, from, to), [rides, from, to]);

  const rPorHora = m.horasTrabalhadas > 0 ? m.ganhoBruto / m.horasTrabalhadas : 0;
  const rPorKm = m.kmTotal > 0 ? m.ganhoBruto / m.kmTotal : 0;

  const counts = useMemo(() => {
    const out = { BOA: 0, MEDIA: 0, RUIM: 0 } as Record<string, number>;
    dayRides.forEach((r) => {
      const c = (r.classificacao || "MEDIA").toUpperCase();
      if (out[c] != null) out[c]++;
    });
    return out;
  }, [dayRides]);
  const totalCls = counts.BOA + counts.MEDIA + counts.RUIM || 1;
  const pctBoas = totalCls > 0 ? (counts.BOA / totalCls) * 100 : 0;

  // Gráfico por hora
  const hourSeries = useMemo(() => {
    const buckets: Record<number, { n: number; valor: number }> = {};
    dayRides.forEach((r) => {
      if (!r.horario_inicio) return;
      const h = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: TZ,
          hour: "2-digit",
          hour12: false,
        }).format(new Date(r.horario_inicio)),
      );
      const bucket = buckets[h] || { n: 0, valor: 0 };
      bucket.n++;
      bucket.valor += Number(r.valor_bruto || 0);
      buckets[h] = bucket;
    });
    return Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, "0")}h`,
      corridas: buckets[h]?.n || 0,
      mediaValor: buckets[h]?.n ? buckets[h].valor / buckets[h].n : 0,
    }));
  }, [dayRides]);

  // Top 3 mais rentáveis
  const top3 = useMemo(
    () =>
      [...dayRides]
        .filter((r) => rideKmTotal(r) > 0)
        .sort((a, b) => rideRPorKmReal(b) - rideRPorKmReal(a))
        .slice(0, 3),
    [dayRides],
  );
  // 3 que mais pesaram (maior km_deslocamento / valor_bruto)
  const piores = useMemo(
    () =>
      [...dayRides]
        .filter((r) => Number(r.valor_bruto || 0) > 0)
        .sort(
          (a, b) =>
            Number(b.km_deslocamento || 0) / Math.max(1, Number(b.valor_bruto || 1)) -
            Number(a.km_deslocamento || 0) / Math.max(1, Number(a.valor_bruto || 1)),
        )
        .slice(0, 3),
    [dayRides],
  );

  const handleExportCSV = () => {
    const rows = dayRides.map((r) => ({
      Horario: r.horario_inicio ? fmtInTZ(r.horario_inicio) : "—",
      Origem: `${r.bairro_origem || ""}`.trim(),
      Destino: `${r.bairro_destino || ""}`.trim(),
      Km: rideKmTotal(r).toFixed(1),
      Valor: Number(r.valor_bruto || 0).toFixed(2),
      Classificacao: r.classificacao || "",
    }));
    exportCSV(`relatorio-diario-${format(date, "yyyy-MM-dd")}`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Seletor */}
      <div className="flex items-center justify-between gap-4">
        <DateSelector date={date} onChange={setDate} maxDate={nowInTZ()} />
        <Button variant="outline" onClick={handleExportCSV} disabled={!dayRides.length}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Resumo executivo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Ganho bruto" value={fmtBRL(m.ganhoBruto)} />
        <ResumoCard label="Ganho real" value={fmtBRL(m.ganhoReal)} positive={m.ganhoReal > 0} negative={m.ganhoReal < 0} />
        <ResumoCard label="Km total" value={`${fmtNumber(m.kmTotal, 1)} km`} />
        <ResumoCard label="Corridas" value={String(m.numCorridas)} />
      </div>

      {/* Secundários */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Horas trabalhadas" value={`${fmtNumber(m.horasTrabalhadas, 1)}h`} />
        <ResumoCard label="R$/hora" value={fmtBRL(rPorHora)} />
        <ResumoCard label="R$/km" value={fmtBRL(rPorKm)} />
        <ResumoCard label="% corridas boas" value={`${fmtNumber(pctBoas, 0)}%`} />
      </div>

      {/* Gráfico por hora */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corridas por hora do dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={hourSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                <RechartsTooltip
                  formatter={(v: number, name: string) =>
                    name === "Valor médio" ? fmtBRL(v) : `${v} corridas`
                  }
                />
                <Legend />
                <Bar yAxisId="l" dataKey="corridas" name="Corridas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="mediaValor" name="Valor médio" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Classificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classificação das corridas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <ClassBadge color="#22C55E" label="✅ Boas" count={counts.BOA} total={totalCls} />
            <ClassBadge color="#EAB308" label="🟡 Médias" count={counts.MEDIA} total={totalCls} />
            <ClassBadge color="#EF4444" label="❌ Ruins" count={counts.RUIM} total={totalCls} />
          </div>
        </CardContent>
      </Card>

      {/* Top 3 / Piores 3 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-success">
              <Trophy className="h-4 w-4" /> Top 3 mais rentáveis (R$/km)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {top3.length ? top3.map((r) => <RideMiniRow key={r.id} ride={r} highlight="success" />) : <p className="text-sm text-muted-foreground">Sem corridas.</p>}
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <TrendingDown className="h-4 w-4" /> 3 que mais pesaram (km vazio / valor)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {piores.length ? piores.map((r) => <RideMiniRow key={r.id} ride={r} highlight="destructive" />) : <p className="text-sm text-muted-foreground">Sem corridas.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Tabela completa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corridas do dia</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {dayRides.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Origem → Destino</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Ganho real</TableHead>
                  <TableHead>Class.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayRides.map((r) => {
                  const km = rideKmTotal(r);
                  const custo = calcCustoCombustivel(km, vehicle);
                  const ganhoReal = Number(r.valor_bruto || 0) - custo;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{fmtInTZ(r.horario_inicio)}</TableCell>
                      <TableCell className="text-xs">
                        {r.bairro_origem || "—"} → {r.bairro_destino || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtNumber(km, 1)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtBRL(Number(r.valor_bruto || 0))}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmtBRL(custo)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", ganhoReal > 0 ? "text-success" : "text-destructive")}>
                        {fmtBRL(ganhoReal)}
                      </TableCell>
                      <TableCell>
                        <ClassChip c={r.classificacao} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma corrida registrada neste dia.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ABA SEMANAL
// ============================================================

function AbaSemanal({ rides, vehicle, loading }: { rides: Ride[]; vehicle: Vehicle | null; loading: boolean }) {
  const [date, setDate] = useState<Date>(() => nowInTZ());
  const from = startOfWeek(date, { weekStartsOn: 1 });
  const to = endOfWeek(date, { weekStartsOn: 1 });

  const m = useMemo(() => calcPeriodMetrics(rides, vehicle, from, to), [rides, vehicle, from, to]);
  const series = useMemo(() => buildDailySeries(rides, vehicle, from, to), [rides, vehicle, from, to]);

  const mediaDiariaGanho = m.numCorridas > 0 && m.diasNoPeriodo > 0 ? m.ganhoReal / m.diasNoPeriodo : 0;

  // Resumo por dia
  const porDia = useMemo(() => {
    return eachDayOfInterval({ start: from, end: to }).map((day) => {
      const dStart = startOfDay(day);
      const dEnd = endOfDay(day);
      const dm = calcPeriodMetrics(rides, vehicle, dStart, dEnd);
      const ticket = dm.numCorridas > 0 ? dm.ganhoBruto / dm.numCorridas : 0;
      const rHora = dm.horasTrabalhadas > 0 ? dm.ganhoBruto / dm.horasTrabalhadas : 0;
      return {
        date: day,
        label: format(day, "dd/MM (EEE)", { locale: ptBR }),
        corridas: dm.numCorridas,
        horas: dm.horasTrabalhadas,
        km: dm.kmTotal,
        ganhoBruto: dm.ganhoBruto,
        ganhoReal: dm.ganhoReal,
        rHora,
        ticket,
      };
    });
  }, [from, to, rides, vehicle]);

  const melhor = porDia.reduce<typeof porDia[number] | null>((best, d) => (!best || d.ganhoReal > best.ganhoReal ? d : best), null);
  const pior = porDia.reduce<typeof porDia[number] | null>((worst, d) => (d.corridas > 0 && (!worst || d.ganhoReal < worst.ganhoReal) ? d : worst), null);

  const handleExportCSV = () => {
    exportCSV(
      `relatorio-semanal-${format(from, "yyyy-MM-dd")}`,
      porDia.map((d) => ({
        Data: format(d.date, "yyyy-MM-dd"),
        Corridas: d.corridas,
        Horas: d.horas.toFixed(2),
        Km: d.km.toFixed(1),
        GanhoBruto: d.ganhoBruto.toFixed(2),
        GanhoReal: d.ganhoReal.toFixed(2),
        RPorHora: d.rHora.toFixed(2),
        Ticket: d.ticket.toFixed(2),
      })),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <DateSelector
          date={date}
          onChange={setDate}
          label={`Semana de ${format(from, "dd/MM")} a ${format(to, "dd/MM")}`}
          maxDate={nowInTZ()}
        />
        <Button variant="outline" onClick={handleExportCSV} disabled={!m.numCorridas}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Ganho real semana" value={fmtBRL(m.ganhoReal)} positive={m.ganhoReal > 0} negative={m.ganhoReal < 0} />
        <ResumoCard label="Km total" value={`${fmtNumber(m.kmTotal, 1)} km`} />
        <ResumoCard label="Corridas" value={String(m.numCorridas)} />
        <ResumoCard label="Média diária" value={fmtBRL(mediaDiariaGanho)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ganho real por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                  <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                  <Line type="monotone" dataKey="ganhoReal" name="Ganho real" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corridas por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="corridas" name="Corridas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por dia</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Corridas</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">R$/hora</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porDia.map((d) => (
                <TableRow key={d.date.toISOString()}>
                  <TableCell className="text-xs">{d.label}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{d.corridas}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNumber(d.horas, 1)}h</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNumber(d.km, 1)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtBRL(d.ganhoBruto)}</TableCell>
                  <TableCell className={cn("text-right font-mono text-xs", d.ganhoReal >= 0 ? "text-success" : "text-destructive")}>
                    {fmtBRL(d.ganhoReal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtBRL(d.rHora)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtBRL(d.ticket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-success">
              <Trophy className="h-4 w-4" /> Melhor dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {melhor && melhor.corridas > 0 ? (
              <div>
                <p className="text-lg font-bold">{melhor.label}</p>
                <p className="text-2xl font-bold text-success">{fmtBRL(melhor.ganhoReal)}</p>
                <p className="text-xs text-muted-foreground">{melhor.corridas} corridas • {fmtNumber(melhor.km, 1)} km</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <TrendingDown className="h-4 w-4" /> Dia mais fraco
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pior && pior.corridas > 0 ? (
              <div>
                <p className="text-lg font-bold">{pior.label}</p>
                <p className="text-2xl font-bold text-destructive">{fmtBRL(pior.ganhoReal)}</p>
                <p className="text-xs text-muted-foreground">{pior.corridas} corridas • {fmtNumber(pior.km, 1)} km</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// ABA MENSAL
// ============================================================

function AbaMensal({ rides, vehicle, goals, loading }: { rides: Ride[]; vehicle: Vehicle | null; goals: Goals | null; loading: boolean }) {
  const [date, setDate] = useState<Date>(() => nowInTZ());
  const from = startOfMonth(date);
  const to = endOfMonth(date);

  const m = useMemo(() => calcPeriodMetrics(rides, vehicle, from, to), [rides, vehicle, from, to]);
  const series = useMemo(() => buildDailySeries(rides, vehicle, from, to), [rides, vehicle, from, to]);
  const metas = resolveGoals(goals, vehicle);

  // Comparativo por semana dentro do mês
  const semanas = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
    return weeks.map((wStart, idx) => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
      const realStart = wStart < from ? from : wStart;
      const realEnd = wEnd > to ? to : wEnd;
      const wm = calcPeriodMetrics(rides, vehicle, realStart, realEnd);
      return {
        label: `S${idx + 1}`,
        ganhoReal: Math.round(wm.ganhoReal * 100) / 100,
        custoCombustivel: Math.round(wm.custoCombustivel * 100) / 100,
        custoFixo: Math.round(wm.custoFixoProporcional * 100) / 100,
        ganhoBruto: wm.ganhoBruto,
        corridas: wm.numCorridas,
        horas: wm.horasTrabalhadas,
        km: wm.kmTotal,
      };
    });
  }, [from, to, rides, vehicle]);

  // Mês anterior (comparativo)
  const prevFrom = startOfMonth(subMonths(date, 1));
  const prevTo = endOfMonth(subMonths(date, 1));
  const mPrev = useMemo(() => calcPeriodMetrics(rides, vehicle, prevFrom, prevTo), [rides, vehicle, prevFrom, prevTo]);

  // Análise: melhor semana, melhor dia da semana histórico, horário de pico
  const melhorSemana = semanas.reduce<typeof semanas[number] | null>((best, s) => (!best || s.ganhoReal > best.ganhoReal ? s : best), null);

  const monthRides = useMemo(() => filterRidesInRange(rides, from, to), [rides, from, to]);
  const diaSemanaTop = useMemo(() => {
    const buckets: Record<number, number> = {};
    monthRides.forEach((r) => {
      const ref = rideRefDateSP(r);
      if (!ref) return;
      const wd = getDay(ref); // 0..6
      buckets[wd] = (buckets[wd] || 0) + Number(r.valor_bruto || 0);
    });
    let best = -1;
    let bestVal = -Infinity;
    for (let i = 0; i < 7; i++) {
      if ((buckets[i] || 0) > bestVal) {
        best = i;
        bestVal = buckets[i] || 0;
      }
    }
    if (best < 0 || bestVal <= 0) return null;
    const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return { dia: names[best], valor: bestVal };
  }, [monthRides]);

  const horaPico = useMemo(() => {
    const buckets: Record<number, number> = {};
    monthRides.forEach((r) => {
      if (!r.horario_inicio) return;
      const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(r.horario_inicio)));
      buckets[h] = (buckets[h] || 0) + 1;
    });
    let best = -1;
    let bestN = 0;
    for (let h = 0; h < 24; h++) {
      if ((buckets[h] || 0) > bestN) {
        best = h;
        bestN = buckets[h] || 0;
      }
    }
    return best >= 0 ? { hora: `${String(best).padStart(2, "0")}h`, n: bestN } : null;
  }, [monthRides]);

  const handleExportCSV = () => {
    exportCSV(
      `relatorio-mensal-${format(date, "yyyy-MM")}`,
      semanas.map((s) => ({
        Semana: s.label,
        Corridas: s.corridas,
        Horas: s.horas.toFixed(2),
        Km: s.km.toFixed(1),
        GanhoBruto: s.ganhoBruto.toFixed(2),
        GanhoReal: s.ganhoReal.toFixed(2),
      })),
    );
  };

  const compareRow = (label: string, atual: number, prev: number, isCurrency = true) => {
    const variacao = prev > 0 ? ((atual - prev) / prev) * 100 : null;
    return (
      <TableRow>
        <TableCell className="text-xs">{label}</TableCell>
        <TableCell className="text-right font-mono text-xs">{isCurrency ? fmtBRL(atual) : fmtNumber(atual, 0)}</TableCell>
        <TableCell className="text-right font-mono text-xs">{isCurrency ? fmtBRL(prev) : fmtNumber(prev, 0)}</TableCell>
        <TableCell className="text-right font-mono text-xs">
          {variacao == null ? (
            <span className="text-muted-foreground">— Sem dados</span>
          ) : (
            <span className={cn("inline-flex items-center gap-1", variacao >= 0 ? "text-success" : "text-destructive")}>
              {variacao >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {fmtNumber(Math.abs(variacao), 1)}%
            </span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <MonthSelector date={date} onChange={setDate} maxDate={nowInTZ()} />
        <Button variant="outline" onClick={handleExportCSV} disabled={!m.numCorridas}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Ganho real" value={fmtBRL(m.ganhoReal)} positive={m.ganhoReal > 0} negative={m.ganhoReal < 0} />
        <ResumoCard label="Km total" value={`${fmtNumber(m.kmTotal, 1)} km`} />
        <ResumoCard label="Corridas" value={String(m.numCorridas)} />
        <ResumoCard label="Horas" value={`${fmtNumber(m.horasTrabalhadas, 1)}h`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução diária — Ganho real vs meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend />
                {metas.diaria > 0 && (
                  <ReferenceLine y={metas.diaria} stroke="#8B5CF6" strokeDasharray="4 4" label={{ value: "Meta diária", fontSize: 11, fill: "#8B5CF6" }} />
                )}
                <Line type="monotone" dataKey="ganhoReal" name="Ganho real" stroke="#22C55E" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo por semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={semanas}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend />
                <Bar dataKey="ganhoReal" name="Ganho real" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custoCombustivel" name="Combustível" fill="#F97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custoFixo" name="Custo fixo" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por semana</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead className="text-right">Corridas</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Real</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semanas.map((s) => (
                <TableRow key={s.label}>
                  <TableCell className="text-xs">{s.label}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{s.corridas}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNumber(s.horas, 1)}h</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtNumber(s.km, 1)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtBRL(s.ganhoBruto)}</TableCell>
                  <TableCell className={cn("text-right font-mono text-xs", s.ganhoReal >= 0 ? "text-success" : "text-destructive")}>{fmtBRL(s.ganhoReal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Semana mais rentável</CardTitle>
          </CardHeader>
          <CardContent>
            {melhorSemana && melhorSemana.corridas > 0 ? (
              <>
                <p className="text-lg font-bold">{melhorSemana.label}</p>
                <p className="text-xl font-bold text-success">{fmtBRL(melhorSemana.ganhoReal)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Melhor dia da semana</CardTitle>
          </CardHeader>
          <CardContent>
            {diaSemanaTop ? (
              <>
                <p className="text-lg font-bold">{diaSemanaTop.dia}</p>
                <p className="text-xs text-muted-foreground">Bruto: {fmtBRL(diaSemanaTop.valor)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Horário de pico</CardTitle>
          </CardHeader>
          <CardContent>
            {horaPico ? (
              <>
                <p className="text-lg font-bold">{horaPico.hora}</p>
                <p className="text-xs text-muted-foreground">{horaPico.n} corridas iniciadas</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo com mês anterior</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Este mês</TableHead>
                <TableHead className="text-right">Mês anterior</TableHead>
                <TableHead className="text-right">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compareRow("Ganho bruto", m.ganhoBruto, mPrev.ganhoBruto)}
              {compareRow("Ganho real", m.ganhoReal, mPrev.ganhoReal)}
              {compareRow("Km total", m.kmTotal, mPrev.kmTotal, false)}
              {compareRow("Corridas", m.numCorridas, mPrev.numCorridas, false)}
              {compareRow("Horas", m.horasTrabalhadas, mPrev.horasTrabalhadas, false)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ABA ACUMULADO
// ============================================================

function AbaAcumulado({ rides, vehicle, goals, loading }: { rides: Ride[]; vehicle: Vehicle | null; goals: Goals | null; loading: boolean }) {
  const metas = resolveGoals(goals, vehicle);

  // Range total = primeira corrida → hoje
  const sorted = useMemo(
    () =>
      [...rides]
        .map((r) => ({ r, ref: rideRefDateSP(r) }))
        .filter((x) => !!x.ref)
        .sort((a, b) => (a.ref!.getTime() - b.ref!.getTime())),
    [rides],
  );
  const fromAll = sorted.length ? startOfDay(sorted[0].ref!) : startOfMonth(nowInTZ());
  const toAll = endOfDay(nowInTZ());

  const m = useMemo(() => calcPeriodMetrics(rides, vehicle, fromAll, toAll), [rides, vehicle, fromAll, toAll]);
  const ticket = m.numCorridas > 0 ? m.ganhoBruto / m.numCorridas : 0;
  const rHora = m.horasTrabalhadas > 0 ? m.ganhoReal / m.horasTrabalhadas : 0;
  const rKm = m.kmTotal > 0 ? m.ganhoReal / m.kmTotal : 0;

  // Recordes
  const ridesByDay = useMemo(() => {
    const map = new Map<string, Ride[]>();
    rides.forEach((r) => {
      const ref = rideRefDateSP(r);
      if (!ref) return;
      const key = format(ref, "yyyy-MM-dd");
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    });
    return map;
  }, [rides]);

  const recordeDia = useMemo(() => {
    let best: { date: string; ganhoReal: number } | null = null;
    ridesByDay.forEach((arr, key) => {
      const d = new Date(key + "T12:00:00");
      const dm = calcPeriodMetrics(rides, vehicle, startOfDay(d), endOfDay(d));
      if (!best || dm.ganhoReal > best.ganhoReal) best = { date: key, ganhoReal: dm.ganhoReal };
    });
    return best;
  }, [ridesByDay, rides, vehicle]);

  // Recorde semana / mês
  const recordeSemana = useMemo(() => {
    if (!sorted.length) return null;
    const weeks = eachWeekOfInterval({ start: fromAll, end: toAll }, { weekStartsOn: 1 });
    let best: { label: string; ganhoReal: number } | null = null;
    weeks.forEach((wStart) => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
      const dm = calcPeriodMetrics(rides, vehicle, wStart, wEnd);
      if (dm.numCorridas > 0 && (!best || dm.ganhoReal > best.ganhoReal)) {
        best = { label: `${format(wStart, "dd/MM")} – ${format(wEnd, "dd/MM")}`, ganhoReal: dm.ganhoReal };
      }
    });
    return best;
  }, [sorted, fromAll, toAll, rides, vehicle]);

  const recordeMes = useMemo(() => {
    if (!sorted.length) return null;
    const months: Date[] = [];
    let cursor = startOfMonth(fromAll);
    while (cursor <= toAll) {
      months.push(new Date(cursor));
      cursor = startOfMonth(subMonths(cursor, -1));
    }
    let best: { label: string; ganhoReal: number } | null = null;
    months.forEach((mStart) => {
      const mEnd = endOfMonth(mStart);
      const dm = calcPeriodMetrics(rides, vehicle, mStart, mEnd);
      if (dm.numCorridas > 0 && (!best || dm.ganhoReal > best.ganhoReal)) {
        best = { label: format(mStart, "MMM/yyyy", { locale: ptBR }), ganhoReal: dm.ganhoReal };
      }
    });
    return best;
  }, [sorted, fromAll, toAll, rides, vehicle]);

  // Série mensal (últimos 12 meses ou todos)
  const monthlySeries = useMemo(() => {
    if (!sorted.length) return [] as { label: string; ganhoReal: number; mStart: Date; corridas: number; horas: number; km: number; ganhoBruto: number }[];
    const months: Date[] = [];
    let cursor = startOfMonth(fromAll);
    while (cursor <= toAll) {
      months.push(new Date(cursor));
      cursor = startOfMonth(subMonths(cursor, -1));
    }
    const last = months.slice(-12);
    return last.map((mStart) => {
      const mEnd = endOfMonth(mStart);
      const dm = calcPeriodMetrics(rides, vehicle, mStart, mEnd);
      return {
        label: format(mStart, "MMM/yy", { locale: ptBR }),
        mStart,
        ganhoReal: Math.round(dm.ganhoReal * 100) / 100,
        ganhoBruto: dm.ganhoBruto,
        corridas: dm.numCorridas,
        horas: dm.horasTrabalhadas,
        km: dm.kmTotal,
      };
    });
  }, [sorted, fromAll, toAll, rides, vehicle]);

  // Distribuição classificação
  const classDist = useMemo(() => {
    const counts = { BOA: 0, MEDIA: 0, RUIM: 0 } as Record<string, number>;
    rides.forEach((r) => {
      const c = (r.classificacao || "MEDIA").toUpperCase();
      if (counts[c] != null) counts[c]++;
    });
    return [
      { name: "BOA", value: counts.BOA, color: "#22C55E" },
      { name: "MÉDIA", value: counts.MEDIA, color: "#EAB308" },
      { name: "RUIM", value: counts.RUIM, color: "#EF4444" },
    ];
  }, [rides]);
  const totalCls = classDist.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Histórico desde{" "}
            <strong>{sorted.length ? format(sorted[0].ref!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—"}</strong>
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Total corridas" value={String(m.numCorridas)} />
        <ResumoCard label="Total km" value={`${fmtNumber(m.kmTotal, 1)} km`} />
        <ResumoCard label="Total horas" value={`${fmtNumber(m.horasTrabalhadas, 1)}h`} />
        <ResumoCard label="Receita bruta" value={fmtBRL(m.ganhoBruto)} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Ganho real total" value={fmtBRL(m.ganhoReal)} positive={m.ganhoReal > 0} negative={m.ganhoReal < 0} />
        <ResumoCard label="Ticket médio" value={fmtBRL(ticket)} />
        <ResumoCard label="R$/hora histórico" value={fmtBRL(rHora)} />
        <ResumoCard label="R$/km histórico" value={fmtBRL(rKm)} />
      </div>

      {/* Recordes */}
      <div className="grid gap-4 md:grid-cols-3">
        <RecordCard title="Melhor dia" subtitle={recordeDia ? format(new Date(recordeDia.date + "T12:00:00"), "dd/MM/yyyy") : "—"} value={recordeDia ? fmtBRL(recordeDia.ganhoReal) : "—"} />
        <RecordCard title="Melhor semana" subtitle={recordeSemana?.label || "—"} value={recordeSemana ? fmtBRL(recordeSemana.ganhoReal) : "—"} />
        <RecordCard title="Melhor mês" subtitle={recordeMes?.label || "—"} value={recordeMes ? fmtBRL(recordeMes.ganhoReal) : "—"} />
      </div>

      {/* Série mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução mensal — Ganho real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="grAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                <Area type="monotone" dataKey="ganhoReal" stroke="#22C55E" strokeWidth={2} fill="url(#grAcum)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição classificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição total das corridas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={classDist} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {classDist.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {classDist.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-md border border-border/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{d.value}</p>
                    <p className="text-xs text-muted-foreground">{fmtNumber((d.value / totalCls) * 100, 1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico mensal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Corridas</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">R$/hora</TableHead>
                <TableHead className="text-right">Meta %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlySeries.map((s) => {
                const rh = s.horas > 0 ? s.ganhoReal / s.horas : 0;
                const metaPct = metas.mensal > 0 ? (s.ganhoReal / metas.mensal) * 100 : null;
                return (
                  <TableRow key={s.label}>
                    <TableCell className="text-xs capitalize">{s.label}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{s.corridas}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtNumber(s.km, 1)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtNumber(s.horas, 1)}h</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtBRL(s.ganhoBruto)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", s.ganhoReal >= 0 ? "text-success" : "text-destructive")}>{fmtBRL(s.ganhoReal)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtBRL(rh)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{metaPct == null ? "—" : `${fmtNumber(metaPct, 0)}%`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function DateSelector({ date, onChange, label, maxDate }: { date: Date; onChange: (d: Date) => void; label?: string; maxDate?: Date }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start gap-2">
          <CalendarIcon className="h-4 w-4" />
          {label || format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
          disabled={(d) => (maxDate ? d > maxDate : false)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function MonthSelector({ date, onChange, maxDate }: { date: Date; onChange: (d: Date) => void; maxDate?: Date }) {
  const now = nowInTZ();
  const months = useMemo(() => {
    const out: Date[] = [];
    let cursor = startOfMonth(new Date(now.getFullYear() - 2, now.getMonth(), 1));
    const end = startOfMonth(maxDate || now);
    while (cursor <= end) {
      out.push(new Date(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return out.reverse();
  }, [now, maxDate]);

  const value = format(startOfMonth(date), "yyyy-MM");

  return (
    <Select value={value} onValueChange={(v) => onChange(new Date(v + "-01T12:00:00"))}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={format(m, "yyyy-MM")} value={format(m, "yyyy-MM")} className="capitalize">
            {format(m, "MMMM 'de' yyyy", { locale: ptBR })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ClassBadge({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border/50 p-4 text-center" style={{ borderColor: `${color}55` }}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color }}>{count}</p>
      <p className="text-xs text-muted-foreground">{fmtNumber(pct, 1)}%</p>
    </div>
  );
}

function ClassChip({ c }: { c: string | null }) {
  const cls = (c || "MEDIA").toUpperCase();
  const colors: Record<string, string> = {
    BOA: "bg-success/15 text-success border-success/30",
    MEDIA: "bg-warning/15 text-warning border-warning/30",
    RUIM: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const labels: Record<string, string> = { BOA: "Boa", MEDIA: "Média", RUIM: "Ruim" };
  return <Badge variant="outline" className={cn("text-[10px]", colors[cls] || colors.MEDIA)}>{labels[cls] || labels.MEDIA}</Badge>;
}

function RideMiniRow({ ride, highlight }: { ride: Ride; highlight: "success" | "destructive" }) {
  const km = rideKmTotal(ride);
  const rkm = rideRPorKmReal(ride);
  return (
    <div className={cn("rounded-md border p-3 text-sm", highlight === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {ride.bairro_origem || "—"} → {ride.bairro_destino || "—"}
        </p>
        <p className="font-mono text-xs">{fmtBRL(Number(ride.valor_bruto || 0))}</p>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{fmtInTZ(ride.horario_inicio)} • {fmtNumber(km, 1)} km • desloc. {fmtNumber(Number(ride.km_deslocamento || 0), 1)} km</span>
        <span className="font-mono">R$/km: {fmtBRL(rkm)}</span>
      </div>
    </div>
  );
}

function RecordCard({ title, subtitle, value }: { title: string; subtitle: string; value: string }) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <p className="mt-2 text-xl font-bold capitalize">{value}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
