import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Sparkles, AlertTriangle, Lightbulb, Star, RefreshCw, AlertCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Fuel, Clock, TrendingUp } from "lucide-react";
import { formatHorasHHMM } from "@/lib/formatters";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  calcPeriodMetrics,
  resolveGoals,
  fmtBRL,
  fmtInTZ,
  nowInTZ,
  projecaoMensal,
  sumJornadaHoursInRange,
  type Ride,
  type Vehicle,
  type Goals,
  type JornadaRecord,
} from "@/lib/financeiro";
import { getStartOfTodaySP, getEndOfTodaySP, getStartOfMonthSP, getEndOfMonthSP } from "@/lib/dateUtils";
import { endOfMonth, format, subMonths, subWeeks, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  aggregateWeek,
  aggregateMonth,
  getWeekRange,
  getPrevWeekRange,
  getMonthRange,
  getPrevMonthRange,
} from "@/lib/aiAggregations";
import { calcAnalisePersonalizada, calcContextoDia, calcContextoSemana, calcContextoMes } from "@/lib/aiBehavioral";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

interface Analysis {
  resumo_dia: string;
  recomendacoes: string;
  projecao_mes: string;
  dica_estrategica: string;
}
type Status = "idle" | "loading" | "ok" | "error" | "empty";

const RATE_LIMIT_MS = 60 * 60 * 1000;

type Periodo = "hoje" | "semana" | "mes";

async function getNomeMotorista(user: any): Promise<string> {
  try {
    const { data } = await supabase.from("users").select("nome").eq("id", user.id).maybeSingle();
    const dbNome = (data as any)?.nome?.trim();
    if (dbNome) return dbNome.split(" ")[0];
  } catch {
    /* noop */
  }
  const meta = user?.user_metadata?.full_name || user?.user_metadata?.nome;
  if (meta) return String(meta).split(" ")[0];
  if (user?.email) return String(user.email).split("@")[0];
  return "";
}

async function fetchHistoricoAnalises(userId: string, periodo: "dia" | "semana" | "mes") {
  try {
    const { data } = await supabase
      .from("analises_geradas" as any)
      .select("data_referencia, resumo_dia, dica_estrategica, payload")
      .eq("user_id", userId)
      .eq("periodo", periodo)
      .order("data_referencia", { ascending: false })
      .limit(21);
    return ((data as any) || []).map((h: any) => ({
      data: h.data_referencia,
      resumo: h.resumo_dia?.slice(0, 300),
      dica: h.dica_estrategica?.slice(0, 200),
      corridas: h.payload?.total_corridas,
      ganho_real: h.payload?.ganho_real,
    }));
  } catch {
    return [];
  }
}

async function fetchHistoricoSemanal(userId: string) {
  try {
    const { data } = await supabase
      .from("analises_geradas" as any)
      .select("data_referencia, resumo_dia, payload")
      .eq("user_id", userId)
      .eq("periodo", "semana")
      .order("data_referencia", { ascending: false })
      .limit(4);
    return ((data as any) || []).map((h: any) => ({
      data: h.data_referencia,
      resumo: h.resumo_dia?.slice(0, 200),
      corridas: h.payload?.total_corridas,
      ganho_real: h.payload?.ganho_real,
      r_por_hora: h.payload?.r_por_hora,
    }));
  } catch {
    return [];
  }
}

async function saveAnalise(params: {
  userId: string;
  periodo: "dia" | "semana" | "mes";
  dataRef: string;
  payload: any;
  result: Analysis;
}) {
  try {
    await supabase.from("analises_geradas" as any).insert({
      user_id: params.userId,
      periodo: params.periodo,
      data_referencia: params.dataRef,
      payload: params.payload,
      resumo_dia: params.result.resumo_dia,
      recomendacoes: params.result.recomendacoes,
      projecao_mes: params.result.projecao_mes,
      dica_estrategica: params.result.dica_estrategica,
    } as any);
  } catch {
    /* save é best-effort */
  }
}

export default function AnaliseIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Periodo>("hoje");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(nowInTZ(), "yyyy-MM"));
  const [selectedDay, setSelectedDay] = useState<Date>(() => nowInTZ());
  // semana selecionada: armazenada como ISO yyyy-MM-dd da segunda-feira
  const [selectedWeek, setSelectedWeek] = useState<string>(() => format(getWeekRange(nowInTZ()).from, "yyyy-MM-dd"));

  return (
    <AppLayout>
      <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <header
          className="relative overflow-hidden rounded-2xl border border-border/50 p-6 text-center md:p-8"
          style={{
            background: "linear-gradient(135deg, hsl(270 80% 30% / 0.55), hsl(180 80% 30% / 0.55))",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_0%,white,transparent_60%)]" />
          <div className="relative">
            <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur animate-pulse shadow-[0_0_30px_rgba(168,85,247,0.6)] md:h-16 md:w-16">
              <Brain className="h-8 w-8 text-white drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] md:h-9 md:w-9" />
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">Análise Inteligente</h1>
            <p className="mt-1 text-sm text-white/80">Análise personalizada baseada no seu histórico</p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Periodo)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="semana">Esta Semana</TabsTrigger>
            <TabsTrigger value="mes">Este Mês</TabsTrigger>
          </TabsList>

          <TabsContent value="hoje" className="mt-6 space-y-4">
            <div className="flex items-center justify-end">
              <SeletorDia value={selectedDay} onChange={setSelectedDay} />
            </div>
            <PainelDia user={user} navigate={navigate} selectedDay={selectedDay} />
          </TabsContent>

          <TabsContent value="semana" className="mt-6 space-y-4">
            <div className="flex items-center justify-end">
              <SeletorSemana value={selectedWeek} onChange={setSelectedWeek} />
            </div>
            <PainelSemana user={user} weekStartISO={selectedWeek} />
          </TabsContent>

          <TabsContent value="mes" className="mt-6 space-y-4">
            <div className="flex items-center justify-end">
              <SeletorMes value={selectedMonth} onChange={setSelectedMonth} />
            </div>
            <PainelMes user={user} mesYYYYMM={selectedMonth} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function SeletorDia({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[220px] justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(value, "dd 'de' MMMM yyyy", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          disabled={(d) => d > nowInTZ()}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function SeletorSemana({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = useMemo(() => {
    const arr: Array<{ v: string; label: string }> = [];
    const now = nowInTZ();
    for (let i = 0; i < 6; i++) {
      const d = subWeeks(now, i);
      const r = getWeekRange(d);
      const v = format(r.from, "yyyy-MM-dd");
      const label =
        i === 0
          ? `Esta semana (${format(r.from, "dd/MM")})`
          : i === 1
            ? `Semana passada (${format(r.from, "dd/MM")})`
            : `Semana de ${format(r.from, "dd/MM")}`;
      arr.push({ v, label });
    }
    return arr;
  }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SeletorMes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = useMemo(() => {
    const arr: Array<{ v: string; label: string }> = [];
    const now = nowInTZ();
    for (let i = 0; i < 6; i++) {
      const d = subMonths(now, i);
      arr.push({
        v: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
      });
    }
    return arr;
  }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ======================== Painel HOJE (lógica original) ======================== */
function PainelDia({
  user,
  navigate,
  selectedDay,
}: {
  user: any;
  navigate: ReturnType<typeof useNavigate>;
  selectedDay: Date;
}) {
  const cacheKey = `dia_${format(selectedDay, "yyyy-MM-dd")}`;
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [realizadoMes, setRealizadoMes] = useState(0);
  const [metaMensal, setMetaMensal] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [now, setNow] = useState<number>(Date.now());
  const [resumo, setResumo] = useState<{
    cur: { corridas: number; ganho_real: number; r_por_hora: number; r_por_km: number };
    prev: { corridas: number; ganho_real: number; r_por_hora: number; r_por_km: number };
    pct: number;
    hasPrev: boolean;
  } | null>(null);
  const [sinais, setSinais] = useState<{
    custoVazio: number | null;
    kmVazio: number;
    tempoOcioso: number | null;
    melhorJanela: string | null;
  } | null>(null);

  // Reset ao trocar dia/semana/mês
  useEffect(() => {
    setStatus("idle");
    setAnalysis(null);
    setGeneratedAt(null);
    setResumo(null);
    setSinais(null);
  }, [cacheKey]);

  // Carrega resumo do dia (KPIs e comparação) independentemente da IA
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [ridesRes, vehicleRes, goalsRes, jornadasRes] = await Promise.all([
        supabase.from("rides").select("*").eq("user_id", user.id),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("jornadas" as any)
          .select("*")
          .eq("user_id", user.id)
          .gte("data_jornada", format(startOfDay(new Date(selectedDay.getTime() - 86400000)), "yyyy-MM-dd"))
          .lte("data_jornada", format(selectedDay, "yyyy-MM-dd")),
      ]);
      if (cancelled) return;
      const rides = (ridesRes.data || []) as Ride[];
      const vehicle = (vehicleRes.data as Vehicle | null) ?? null;
      const goals = (goalsRes.data as Goals | null) ?? null;
      const jornadas = ((jornadasRes.data as any) || []) as JornadaRecord[];

      const fromCur = startOfDay(selectedDay);
      const toCur = endOfDay(selectedDay);
      const prevDate = new Date(selectedDay);
      prevDate.setDate(prevDate.getDate() - 1);
      const fromPrev = startOfDay(prevDate);
      const toPrev = endOfDay(prevDate);

      const mCur = calcPeriodMetrics(rides, vehicle, fromCur, toCur, jornadas);
      const mPrev = calcPeriodMetrics(rides, vehicle, fromPrev, toPrev, jornadas);
      const { diaria } = resolveGoals(goals, vehicle);
      const pct = diaria > 0 ? (mCur.ganhoReal / diaria) * 100 : 0;

      setResumo({
        cur: {
          corridas: mCur.numCorridas,
          ganho_real: mCur.ganhoReal,
          r_por_hora: mCur.horasTrabalhadas > 0 ? mCur.ganhoBruto / mCur.horasTrabalhadas : 0,
          r_por_km: mCur.kmTotal > 0 ? mCur.ganhoBruto / mCur.kmTotal : 0,
        },
        prev: {
          corridas: mPrev.numCorridas,
          ganho_real: mPrev.ganhoReal,
          r_por_hora: mPrev.horasTrabalhadas > 0 ? mPrev.ganhoBruto / mPrev.horasTrabalhadas : 0,
          r_por_km: mPrev.kmTotal > 0 ? mPrev.ganhoBruto / mPrev.kmTotal : 0,
        },
        pct,
        hasPrev: mPrev.numCorridas > 0,
      });

      // ── Sinais invisíveis ─────────────────────────────────────────
      const ridesCur = rides.filter((r) => {
        if (!r.data_corrida) return false;
        const ref = new Date(r.data_corrida + "T12:00:00");
        return ref >= fromCur && ref <= toCur;
      });
      const kmVazio = ridesCur.reduce((s, r) => s + Number((r as any).km_deslocamento || 0), 0);
      const consumo = vehicle?.consumo_km_litro ? Number(vehicle.consumo_km_litro) : null;
      const precoComb = (vehicle as any)?.preco_combustivel
        ? Number((vehicle as any).preco_combustivel)
        : null;
      const custoVazio =
        consumo && consumo > 0 && precoComb && precoComb > 0 ? kmVazio * (precoComb / consumo) : null;

      const horasJornadaDia = sumJornadaHoursInRange(jornadas, fromCur, toCur);
      const minPassageiro = ridesCur.reduce(
        (s, r) => s + (Number((r as any).duracao_minutos) || 0),
        0,
      );
      const tempoOcioso =
        horasJornadaDia > 0 ? Math.max(0, horasJornadaDia - minPassageiro / 60) : null;

      const buckets: Record<number, { v: number; k: number }> = {};
      for (const r of ridesCur) {
        const cls = String((r as any).classificacao || "").toLowerCase();
        if (cls !== "boa") continue;
        const ts = (r as any).horario_inicio;
        if (!ts) continue;
        const h = new Date(ts).getHours();
        if (!buckets[h]) buckets[h] = { v: 0, k: 0 };
        buckets[h].v += Number((r as any).valor_bruto || 0);
        buckets[h].k +=
          Number((r as any).km_passageiro || 0) + Number((r as any).km_deslocamento || 0);
      }
      let bestHour: number | null = null;
      let bestRkm = -1;
      for (const [h, b] of Object.entries(buckets)) {
        if (b.k <= 0) continue;
        const rkm = b.v / b.k;
        if (rkm > bestRkm) {
          bestRkm = rkm;
          bestHour = Number(h);
        }
      }
      const melhorJanela =
        bestHour != null ? `${bestHour}h–${(bestHour + 1) % 24}h` : null;

      setSinais({ custoVazio, kmVazio, tempoOcioso, melhorJanela });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, selectedDay]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lastTs = generatedAt?.getTime() || 0;
  const rateLimited = lastTs > 0 && now - lastTs < RATE_LIMIT_MS;
  const minutesLeft = rateLimited ? Math.ceil((RATE_LIMIT_MS - (now - lastTs)) / 60_000) : 0;

  const handleGenerate = async () => {
    if (!user || rateLimited) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const fromHoje = startOfDay(selectedDay);
      const toHoje = endOfDay(selectedDay);
      const fromMes = getStartOfMonthSP();
      const toMes = getEndOfMonthSP();
      const [ridesRes, vehicleRes, goalsRes, jornadasRes] = await Promise.all([
        supabase.from("rides").select("*").eq("user_id", user.id),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("jornadas" as any)
          .select("*")
          .eq("user_id", user.id)
          .gte("data_jornada", format(fromMes, "yyyy-MM-dd"))
          .lte("data_jornada", format(toMes, "yyyy-MM-dd")),
      ]);
      const rides = (ridesRes.data || []) as Ride[];
      const vehicle = (vehicleRes.data as Vehicle | null) ?? null;
      const goals = (goalsRes.data as Goals | null) ?? null;
      const jornadas = ((jornadasRes.data as any) || []) as JornadaRecord[];

      const mHoje = calcPeriodMetrics(rides, vehicle, fromHoje, toHoje, jornadas);
      const mMes = calcPeriodMetrics(rides, vehicle, fromMes, toMes, jornadas);

      if (mHoje.numCorridas === 0) {
        setStatus("empty");
        return;
      }

      const { diaria: metaDiaria, mensal: metaMensalCfg } = resolveGoals(goals, vehicle);
      const percentualMeta = metaDiaria > 0 ? (mHoje.ganhoReal / metaDiaria) * 100 : 0;

      const isHoje = (r: Ride) => {
        if (r.data_corrida) {
          const ref = new Date(r.data_corrida + "T12:00:00");
          return ref >= fromHoje && ref <= toHoje;
        }
        return false;
      };
      const ridesHoje = rides.filter(isHoje);
      const ticketMedio = ridesHoje.length > 0 ? mHoje.ganhoBruto / ridesHoje.length : 0;
      const nBoas = ridesHoje.filter((r) => r.classificacao === "BOA" || r.classificacao === "boa").length;
      const nMedias = ridesHoje.filter((r) => r.classificacao === "MEDIA" || r.classificacao === "media").length;
      const nRuins = ridesHoje.filter((r) => r.classificacao === "RUIM" || r.classificacao === "ruim").length;
      const horarios = ridesHoje
        .map((r) => r.horario_inicio)
        .filter((x): x is string => !!x)
        .sort();
      const horaInicio = horarios.length ? fmtInTZ(horarios[0]) : "—";
      const horarios_fim = ridesHoje
        .map((r) => r.horario_fim || r.horario_inicio)
        .filter((x): x is string => !!x)
        .sort();
      const horaFim = horarios_fim.length ? fmtInTZ(horarios_fim[horarios_fim.length - 1]) : "—";
      const sortedByValor = [...ridesHoje].sort((a, b) => Number(b.valor_bruto || 0) - Number(a.valor_bruto || 0));
      const melhor = sortedByValor[0],
        pior = sortedByValor[sortedByValor.length - 1];
      const refRide = (r: Ride | undefined) => ({
        valor: Number(r?.valor_bruto || 0),
        km: Number(r?.km_passageiro || 0) + Number(r?.km_deslocamento || 0),
        origem: r?.bairro_origem || "—",
        destino: r?.bairro_destino || "—",
      });
      const nowD = nowInTZ();
      const diaAtual = nowD.getDate();
      const ultimoDia = endOfMonth(nowD).getDate();
      const projMes = projecaoMensal(mMes.ganhoReal, diaAtual, ultimoDia, mMes.numCorridas) ?? mMes.ganhoReal;
      const diasRestantes = Math.max(0, ultimoDia - diaAtual);
      const valorFaltante = Math.max(0, metaMensalCfg - mMes.ganhoReal);
      const valorPorDia = diasRestantes > 0 ? valorFaltante / diasRestantes : valorFaltante;

      // Métricas de tempo ocioso / eficiência de jornada
      const corridasOrdenadas = [...ridesHoje].sort(
        (a, b) =>
          new Date(a.horario_inicio || 0).getTime() - new Date(b.horario_inicio || 0).getTime(),
      );
      const intervalos: number[] = [];
      for (let i = 1; i < corridasOrdenadas.length; i++) {
        const fim =
          new Date(corridasOrdenadas[i - 1].horario_inicio || 0).getTime() +
          (Number((corridasOrdenadas[i - 1] as any).duracao_minutos) || 0) * 60000;
        const inicioProx = new Date(corridasOrdenadas[i].horario_inicio || 0).getTime();
        const diff = (inicioProx - fim) / 60000;
        if (diff >= 0 && diff < 120) intervalos.push(diff);
      }
      const tempoMedioEntreCorridas =
        intervalos.length > 0 ? intervalos.reduce((s, v) => s + v, 0) / intervalos.length : 0;
      const maiorIntervalo = intervalos.length > 0 ? Math.max(...intervalos) : 0;
      const totalMinCorridas = ridesHoje.reduce(
        (s, r) => s + (Number((r as any).duracao_minutos) || 0),
        0,
      );
      const jornadaMinutes = mHoje.horasTrabalhadas * 60;
      const totalMinJornada = jornadaMinutes > 0 ? jornadaMinutes : totalMinCorridas;
      const pctTempoOnlineSemCorrida =
        totalMinJornada > 0
          ? Math.max(0, ((totalMinJornada - totalMinCorridas) / totalMinJornada) * 100)
          : 0;
      const corridasPorHoraEfetiva =
        totalMinCorridas > 0 ? ridesHoje.length / (totalMinCorridas / 60) : 0;

      const payload = {
        periodo: "dia" as const,
        total_corridas: mHoje.numCorridas,
        ganho_bruto: mHoje.ganhoBruto,
        custo_total: mHoje.custoTotal,
        ganho_real: mHoje.ganhoReal,
        meta_diaria: metaDiaria,
        percentual_meta: percentualMeta,
        km_total: mHoje.kmTotal,
        km_deslocamento_total: mHoje.kmDeslocamento,
        horas: mHoje.horasTrabalhadas,
        r_por_hora: mHoje.horasTrabalhadas > 0 ? mHoje.ganhoBruto / mHoje.horasTrabalhadas : 0,
        r_por_km: mHoje.kmTotal > 0 ? mHoje.ganhoBruto / mHoje.kmTotal : 0,
        ticket_medio: ticketMedio,
        n_boas: nBoas,
        n_medias: nMedias,
        n_ruins: nRuins,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        data_hoje: nowD.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        corrida_melhor: refRide(melhor),
        corrida_pior: refRide(pior),
        projecao_mensal: projMes,
        meta_mensal: metaMensalCfg,
        dias_restantes_mes: diasRestantes,
        valor_faltante_meta: valorFaltante,
        valor_necessario_por_dia: valorPorDia,
        r_km_bom: Number((goals as any)?.r_km_bom || (goals as any)?.r_por_km_minimo || 0),
        r_km_medio: Number((goals as any)?.r_km_medio || 0),
        ticket_minimo: Number((goals as any)?.valor_minimo_corrida || 0),
        tempo_medio_entre_corridas: tempoMedioEntreCorridas,
        maior_intervalo_sem_corrida: maiorIntervalo,
        corridas_por_hora_efetiva: corridasPorHoraEfetiva,
        pct_tempo_online_sem_corrida: pctTempoOnlineSemCorrida,
        consumo_medio_km_l: vehicle?.consumo_km_litro ? Number(vehicle.consumo_km_litro) : undefined,
        preco_combustivel: vehicle?.preco_combustivel ? Number(vehicle.preco_combustivel) : undefined,
        tipo_combustivel: vehicle?.combustivel ?? undefined,
        ...calcContextoDia(rides, selectedDay),
        analise_personalizada: calcAnalisePersonalizada(rides, vehicle, goals, fromHoje, toHoje),
        nome_motorista: await getNomeMotorista(user),
        historico_analises: await fetchHistoricoAnalises(user.id, "dia"),
        historico_semanal: await fetchHistoricoSemanal(user.id),
      };

      const pct = metaMensalCfg > 0 ? Math.min(100, (mMes.ganhoReal / metaMensalCfg) * 100) : 0;
      setRealizadoMes(mMes.ganhoReal);
      setMetaMensal(metaMensalCfg);
      setProgressPct(pct);

      const { data, error } = await supabase.functions.invoke("groq-analysis", { body: payload });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || "Erro desconhecido");
      const result = data as Analysis;
      const ts = Date.now();
      setAnalysis(result);
      setGeneratedAt(new Date(ts));
      setStatus("ok");
      void saveAnalise({
        userId: user.id,
        periodo: "dia",
        dataRef: format(selectedDay, "yyyy-MM-dd"),
        payload,
        result,
      });
    } catch (e) {
      console.error(e);
      setErrorMsg((e as Error).message);
      setStatus("error");
    }
  };

  const isHojeReal = format(selectedDay, "yyyy-MM-dd") === format(nowInTZ(), "yyyy-MM-dd");
  const rotuloDia = isHojeReal ? "Hoje" : format(selectedDay, "dd/MM");
  return (
    <div className="space-y-4">
      {resumo && resumo.cur.corridas > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resumo do Dia — {format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Mini label="Corridas" value={String(resumo.cur.corridas)} />
            <Mini label="Ganho real" value={fmtBRL(resumo.cur.ganho_real)} />
            <Mini label="R$/hora" value={fmtBRL(resumo.cur.r_por_hora)} />
            <Mini label="R$/km" value={fmtBRL(resumo.cur.r_por_km)} />
            <Mini label="% meta" value={`${resumo.pct.toFixed(0)}%`} />
          </CardContent>
        </Card>
      )}

      {resumo && resumo.cur.corridas > 0 && resumo.hasPrev && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rotuloDia} vs. dia anterior</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Compare label="Corridas" cur={resumo.cur.corridas} prev={resumo.prev.corridas} />
            <Compare label="Ganho real" cur={resumo.cur.ganho_real} prev={resumo.prev.ganho_real} money />
            <Compare label="R$/hora" cur={resumo.cur.r_por_hora} prev={resumo.prev.r_por_hora} money />
            <Compare label="R$/km" cur={resumo.cur.r_por_km} prev={resumo.prev.r_por_km} money />
          </CardContent>
        </Card>
      )}

      {sinais && resumo && resumo.cur.corridas > 0 && <SinaisInvisiveis sinais={sinais} />}

      <ResultadoLayout
        status={status}
        analysis={analysis}
        errorMsg={errorMsg}
        onGenerate={handleGenerate}
        rateLimited={rateLimited}
        minutesLeft={minutesLeft}
        generatedAt={generatedAt}
        ctaLabel={isHojeReal ? "Gerar Análise do Dia" : `Gerar Análise de ${format(selectedDay, "dd/MM")}`}
        emptyAction={isHojeReal ? () => navigate("/dashboard/operacional") : undefined}
        emptyText={
          isHojeReal
            ? "Nenhuma corrida registrada hoje. Registre pelo menos uma corrida para gerar sua análise personalizada."
            : "Nenhuma corrida registrada neste dia."
        }
        titleResumo="📊 Resumo do Dia"
        titleProj="📈 Projeção do Mês"
        titleDica="💡 Dica Estratégica do Dia"
        titleRecs="🎯 Recomendações para Amanhã"
        footerProgress={{ realizado: realizadoMes, meta: metaMensal, pct: progressPct }}
      />
    </div>
  );
}

/* ======================== Painel SEMANA ======================== */
function PainelSemana({ user, weekStartISO }: { user: any; weekStartISO: string }) {
  const cacheKey = `semana_${weekStartISO}`;
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Reset ao trocar dia/semana/mês
  useEffect(() => {
    setStatus("idle");
    setAnalysis(null);
    setGeneratedAt(null);
  }, [cacheKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const lastTs = generatedAt?.getTime() || 0;
  const rateLimited = lastTs > 0 && now - lastTs < RATE_LIMIT_MS;
  const minutesLeft = rateLimited ? Math.ceil((RATE_LIMIT_MS - (now - lastTs)) / 60_000) : 0;

  const handleGenerate = async () => {
    if (!user || rateLimited) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const refDate = new Date(weekStartISO + "T12:00:00");
      const cur = getWeekRange(refDate);
      const prev = getPrevWeekRange(refDate);
      const [ridesRes, vehicleRes, goalsRes, jornadasRes] = await Promise.all([
        supabase.from("rides").select("*").eq("user_id", user.id),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("jornadas" as any)
          .select("*")
          .eq("user_id", user.id)
          .gte("data_jornada", format(cur.from, "yyyy-MM-dd"))
          .lte("data_jornada", format(cur.to, "yyyy-MM-dd")),
      ]);
      const rides = (ridesRes.data || []) as Ride[];
      const vehicle = (vehicleRes.data as Vehicle | null) ?? null;
      const goals = (goalsRes.data as Goals | null) ?? null;
      const jornadas = ((jornadasRes.data as any) || []) as JornadaRecord[];

      const aCur = aggregateWeek(rides, vehicle, cur.from, cur.to);
      const aPrev = aggregateWeek(rides, vehicle, prev.from, prev.to);
      if (aCur.total_corridas === 0) {
        setStatus("empty");
        return;
      }

      const { semanal: metaSemanal } = resolveGoals(goals, vehicle);
      const pct = metaSemanal > 0 ? (aCur.ganho_real / metaSemanal) * 100 : 0;
      const horasJornada = sumJornadaHoursInRange(jornadas, cur.from, cur.to);
      const horasFinal = horasJornada > 0 ? horasJornada : aCur.horas;
      const rPorHoraFinal = horasFinal > 0 ? aCur.ganho_bruto / horasFinal : aCur.r_por_hora;

      const payload = {
        periodo: "semana" as const,
        rotulo_periodo: aCur.rotulo,
        total_corridas: aCur.total_corridas,
        ganho_bruto: aCur.ganho_bruto,
        ganho_real: aCur.ganho_real,
        r_por_hora: rPorHoraFinal,
        r_por_km: aCur.r_por_km,
        km_total: aCur.km_total,
        horas: horasFinal,
        meta_semanal: metaSemanal,
        percentual_meta: pct,
        melhor_dia: aCur.melhor_dia,
        pior_dia: aCur.pior_dia,
        hora_pico: aCur.hora_pico,
        rkm_hora_pico: aCur.rkm_hora_pico,
        semana_anterior: {
          corridas: aPrev.total_corridas,
          ganho_real: aPrev.ganho_real,
          r_por_hora: aPrev.r_por_hora,
          r_por_km: aPrev.r_por_km,
        },
        projecao_semanal: aCur.projecao_semanal,
        r_km_bom: Number((goals as any)?.r_km_bom || 0),
        r_km_medio: Number((goals as any)?.r_km_medio || 0),
        ...calcContextoSemana(rides, cur.from, cur.to),
        analise_personalizada: calcAnalisePersonalizada(rides, vehicle, goals, cur.from, cur.to),
        nome_motorista: await getNomeMotorista(user),
        historico_analises: await fetchHistoricoAnalises(user.id, "semana"),
      };

      const newMeta = { aCur, aPrev, metaSemanal, pct };
      setMeta(newMeta);

      const { data, error } = await supabase.functions.invoke("groq-analysis", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as Analysis;
      const ts = Date.now();
      setAnalysis(result);
      setGeneratedAt(new Date(ts));
      setStatus("ok");
      void saveAnalise({
        userId: user.id,
        periodo: "semana",
        dataRef: format(new Date(weekStartISO + "T12:00:00"), "yyyy-MM-dd"),
        payload,
        result,
      });
    } catch (e) {
      console.error(e);
      setErrorMsg((e as Error).message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4">
      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise da Semana — {meta.aCur.rotulo}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Mini label="Corridas" value={String(meta.aCur.total_corridas)} />
            <Mini label="Ganho real" value={fmtBRL(meta.aCur.ganho_real)} />
            <Mini label="R$/hora" value={fmtBRL(meta.aCur.r_por_hora)} />
            <Mini label="R$/km" value={fmtBRL(meta.aCur.r_por_km)} />
            <Mini label="% meta" value={`${meta.pct.toFixed(0)}%`} />
          </CardContent>
        </Card>
      )}

      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Esta semana vs. semana passada</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Compare label="Corridas" cur={meta.aCur.total_corridas} prev={meta.aPrev.total_corridas} />
            <Compare label="Ganho real" cur={meta.aCur.ganho_real} prev={meta.aPrev.ganho_real} money />
            <Compare label="R$/hora" cur={meta.aCur.r_por_hora} prev={meta.aPrev.r_por_hora} money />
            <Compare label="R$/km" cur={meta.aCur.r_por_km} prev={meta.aPrev.r_por_km} money />
          </CardContent>
        </Card>
      )}

      <ResultadoLayout
        status={status}
        analysis={analysis}
        errorMsg={errorMsg}
        onGenerate={handleGenerate}
        rateLimited={rateLimited}
        minutesLeft={minutesLeft}
        generatedAt={generatedAt}
        ctaLabel="Gerar Análise da Semana"
        emptyText="Sem corridas nesta semana ainda. Registre algumas corridas para liberar a análise."
        titleResumo="📊 Resumo da Semana"
        titleProj="📈 Projeção Semanal"
        titleDica="💡 Dica para Próxima Semana"
        titleRecs="🎯 Recomendações para a Próxima Semana"
      />
    </div>
  );
}

/* ======================== Painel MES ======================== */
function PainelMes({ user, mesYYYYMM }: { user: any; mesYYYYMM: string }) {
  const cacheKey = `mes_${mesYYYYMM}`;
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Reset ao trocar dia/semana/mês
  useEffect(() => {
    setStatus("idle");
    setAnalysis(null);
    setGeneratedAt(null);
  }, [cacheKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const lastTs = generatedAt?.getTime() || 0;
  const rateLimited = lastTs > 0 && now - lastTs < RATE_LIMIT_MS;
  const minutesLeft = rateLimited ? Math.ceil((RATE_LIMIT_MS - (now - lastTs)) / 60_000) : 0;

  const handleGenerate = async () => {
    if (!user || rateLimited) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const refDate = new Date(mesYYYYMM + "-15T12:00:00");
      const cur = getMonthRange(refDate);
      const prev = getPrevMonthRange(refDate);
      const [ridesRes, vehicleRes, goalsRes, jornadasRes] = await Promise.all([
        supabase.from("rides").select("*").eq("user_id", user.id),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("jornadas" as any)
          .select("*")
          .eq("user_id", user.id)
          .gte("data_jornada", format(cur.from, "yyyy-MM-dd"))
          .lte("data_jornada", format(cur.to, "yyyy-MM-dd")),
      ]);
      const rides = (ridesRes.data || []) as Ride[];
      const vehicle = (vehicleRes.data as Vehicle | null) ?? null;
      const goals = (goalsRes.data as Goals | null) ?? null;
      const jornadas = ((jornadasRes.data as any) || []) as JornadaRecord[];

      const aCur = aggregateMonth(rides, vehicle, cur.from, cur.to);
      const aPrev = aggregateMonth(rides, vehicle, prev.from, prev.to);
      if (aCur.total_corridas === 0) {
        setStatus("empty");
        return;
      }

      const { mensal: metaMensal } = resolveGoals(goals, vehicle);
      const pct = metaMensal > 0 ? (aCur.ganho_real / metaMensal) * 100 : 0;
      const horasJornada = sumJornadaHoursInRange(jornadas, cur.from, cur.to);
      const rPorHoraFinal = horasJornada > 0 ? aCur.ganho_bruto / horasJornada : aCur.r_por_hora;

      const payload = {
        periodo: "mes" as const,
        rotulo_periodo: aCur.rotulo,
        total_corridas: aCur.total_corridas,
        ganho_bruto: aCur.ganho_bruto,
        ganho_real: aCur.ganho_real,
        r_por_hora: rPorHoraFinal,
        r_por_km: aCur.r_por_km,
        percentual_meta: pct,
        meta_mensal: metaMensal,
        dias_trabalhados: aCur.dias_trabalhados,
        top3_dias: aCur.top3_dias.map((t) => ({ rotulo: t.rotulo, valor: t.valor })),
        hora_pico: aCur.hora_pico,
        melhor_dia_semana: aCur.melhor_dia_semana,
        km_total: aCur.km_total,
        km_vazio_total: aCur.km_vazio_total,
        ganho_perdido_deslocamentos_longos: aCur.ganho_perdido_deslocamentos_longos,
        mes_anterior: {
          corridas: aPrev.total_corridas,
          ganho_real: aPrev.ganho_real,
          r_por_hora: aPrev.r_por_hora,
          r_por_km: aPrev.r_por_km,
          dias_trabalhados: aPrev.dias_trabalhados,
        },
        r_km_bom: Number((goals as any)?.r_km_bom || 0),
        r_km_medio: Number((goals as any)?.r_km_medio || 0),
        ...calcContextoMes(rides, cur.from, cur.to),
        analise_personalizada: calcAnalisePersonalizada(rides, vehicle, goals, cur.from, cur.to),
        nome_motorista: await getNomeMotorista(user),
        historico_analises: await fetchHistoricoAnalises(user.id, "mes"),
      };

      const newMeta = { aCur, aPrev, metaMensal, pct };
      setMeta(newMeta);

      const { data, error } = await supabase.functions.invoke("groq-analysis", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as Analysis;
      const ts = Date.now();
      setAnalysis(result);
      setGeneratedAt(new Date(ts));
      setStatus("ok");
      void saveAnalise({
        userId: user.id,
        periodo: "mes",
        dataRef: `${mesYYYYMM}-01`,
        payload,
        result,
      });
    } catch (e) {
      console.error(e);
      setErrorMsg((e as Error).message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4">
      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise do Mês — {meta.aCur.rotulo}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Mini label="Corridas" value={String(meta.aCur.total_corridas)} />
            <Mini label="Ganho bruto" value={fmtBRL(meta.aCur.ganho_bruto)} />
            <Mini label="Ganho real" value={fmtBRL(meta.aCur.ganho_real)} />
            <Mini label="R$/hora" value={fmtBRL(meta.aCur.r_por_hora)} />
            <Mini label="% meta" value={`${meta.pct.toFixed(0)}%`} />
          </CardContent>
        </Card>
      )}

      {meta && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução diária do ganho real</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={meta.aCur.serie_diaria}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <RTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => fmtBRL(v)}
                    />
                    <Line
                      type="monotone"
                      dataKey="ganho_real"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ganho real médio por dia da semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={meta.aCur.serie_dia_semana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <RTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => fmtBRL(v)}
                    />
                    <Bar dataKey="ganho_real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mês atual vs. mês anterior</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Compare label="Ganho real" cur={meta.aCur.ganho_real} prev={meta.aPrev.ganho_real} money />
            <Compare label="Corridas" cur={meta.aCur.total_corridas} prev={meta.aPrev.total_corridas} />
            <Compare label="R$/hora" cur={meta.aCur.r_por_hora} prev={meta.aPrev.r_por_hora} money />
            <Compare label="R$/km" cur={meta.aCur.r_por_km} prev={meta.aPrev.r_por_km} money />
            <Compare label="Dias trab." cur={meta.aCur.dias_trabalhados} prev={meta.aPrev.dias_trabalhados} />
          </CardContent>
        </Card>
      )}

      <ResultadoLayout
        status={status}
        analysis={analysis}
        errorMsg={errorMsg}
        onGenerate={handleGenerate}
        rateLimited={rateLimited}
        minutesLeft={minutesLeft}
        generatedAt={generatedAt}
        ctaLabel="Gerar Análise do Mês"
        emptyText="Sem corridas neste mês. Selecione outro mês ou registre corridas."
        titleResumo="📊 Resumo do Mês"
        titleProj="📈 Próximo Mês"
        titleDica="💡 Estratégia de Longo Prazo"
        titleRecs="🎯 Insights do Mês"
      />
    </div>
  );
}

/* ======================== Subcomponentes ======================== */
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-bold sm:text-lg">{value}</p>
    </div>
  );
}

function Compare({ label, cur, prev, money }: { label: string; cur: number; prev: number; money?: boolean }) {
  const diff = cur - prev;
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
  const up = diff > 0;
  const color = diff === 0 ? "text-muted-foreground" : up ? "text-success" : "text-destructive";
  const fmt = (n: number) => (money ? fmtBRL(n) : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-bold sm:text-lg">{fmt(cur)}</p>
      <p className={cn("mt-0.5 text-xs", color)}>
        {diff === 0 ? "—" : `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`}
        <span className="ml-1 text-muted-foreground">vs {fmt(prev)}</span>
      </p>
    </div>
  );
}

function ResultadoLayout(props: {
  status: Status;
  analysis: Analysis | null;
  errorMsg: string;
  onGenerate: () => void;
  rateLimited: boolean;
  minutesLeft: number;
  generatedAt: Date | null;
  ctaLabel: string;
  emptyText: string;
  emptyAction?: () => void;
  titleResumo: string;
  titleProj: string;
  titleDica: string;
  titleRecs: string;
  footerProgress?: { realizado: number; meta: number; pct: number };
}) {
  const {
    status,
    analysis,
    errorMsg,
    onGenerate,
    rateLimited,
    minutesLeft,
    generatedAt,
    ctaLabel,
    emptyText,
    emptyAction,
    titleResumo,
    titleProj,
    titleDica,
    titleRecs,
    footerProgress,
  } = props;
  return (
    <div className="space-y-5">
      {status !== "ok" && (
        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            onClick={onGenerate}
            disabled={status === "loading" || rateLimited}
            className={cn(
              "group relative overflow-hidden px-8 py-6 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02]",
              rateLimited && "opacity-60 grayscale",
            )}
            style={
              rateLimited
                ? { background: "hsl(var(--muted))" }
                : { background: "linear-gradient(135deg, hsl(270 80% 50%), hsl(180 80% 45%))" }
            }
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <Sparkles className="mr-2 h-5 w-5" />
            {status === "loading" ? "Analisando..." : rateLimited ? `Disponível em ${minutesLeft} min` : ctaLabel}
          </Button>
        </div>
      )}

      {status === "loading" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex gap-2">
              <span className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-3 w-3 animate-bounce rounded-full bg-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Analisando suas corridas com IA...</p>
          </CardContent>
        </Card>
      )}

      {status === "empty" && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-orange-500" />
            <p className="text-sm text-muted-foreground">{emptyText}</p>
            {emptyAction && <Button onClick={emptyAction}>Registrar Corrida</Button>}
          </CardContent>
        </Card>
      )}

      {status === "error" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-medium">Não foi possível gerar a análise no momento.</p>
              {errorMsg && <p className="mt-2 text-xs text-muted-foreground/70">{errorMsg}</p>}
            </div>
            <Button onClick={onGenerate} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "ok" && analysis && (
        <AnaliseResultado
          analysis={analysis}
          generatedAt={generatedAt}
          onGenerate={onGenerate}
          rateLimited={rateLimited}
          minutesLeft={minutesLeft}
          titleResumo={titleResumo}
          titleRecs={titleRecs}
          titleProj={titleProj}
          titleDica={titleDica}
          footerProgress={footerProgress}
        />
      )}
    </div>
  );
}

/* ======================== Sinais Invisíveis ======================== */
function SinaisInvisiveis({
  sinais,
}: {
  sinais: {
    custoVazio: number | null;
    kmVazio: number;
    tempoOcioso: number | null;
    melhorJanela: string | null;
  };
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 animate-fade-in">
        <SinalCard
          tone="danger"
          icon={<Fuel className="h-4 w-4" />}
          label="Custo do deslocamento vazio"
          value={sinais.custoVazio != null ? fmtBRL(sinais.custoVazio) : "—"}
          sublabel={`${sinais.kmVazio.toFixed(1)} km sem passageiro`}
          tooltip="Estimativa do custo de combustível gasto no deslocamento até o passageiro ou entre corridas, sem cliente no carro."
        />
        <SinalCard
          tone="warning"
          icon={<Clock className="h-4 w-4" />}
          label="Tempo ocioso"
          value={sinais.tempoOcioso != null ? formatHorasHHMM(sinais.tempoOcioso) : "—"}
          sublabel="do tempo online sem corrida"
          tooltip="Tempo total online menos o tempo com passageiro a bordo."
        />
        <SinalCard
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Melhor janela do dia"
          value={sinais.melhorJanela ?? "—"}
          sublabel="maior R$/km registrado"
          tooltip="Hora do dia com o maior R$/km médio entre as corridas classificadas como BOA."
        />
      </div>
    </TooltipProvider>
  );
}

function SinalCard({
  tone,
  icon,
  label,
  value,
  sublabel,
  tooltip,
}: {
  tone: "danger" | "warning" | "success";
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  tooltip: string;
}) {
  const topBar =
    tone === "danger"
      ? "bg-destructive"
      : tone === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const valueColor =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-500"
        : "text-emerald-500";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group min-w-[220px] flex-1 cursor-help overflow-hidden rounded-xl border border-border/60 bg-card/60 transition-all hover:border-border hover:bg-card/80 sm:min-w-0">
          <div className={cn("h-[3px] w-full", topBar)} />
          <div className="space-y-1 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className={cn("opacity-80", valueColor)}>{icon}</span>
              <span className="truncate">{label}</span>
            </div>
            <p className={cn("font-display text-xl font-bold leading-tight", valueColor)}>{value}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/* ======================== Análise: parse + blocos ======================== */
function extrairAcao(text: string): { content: string; acao?: string } {
  if (!text) return { content: "" };
  let acao: string | undefined;
  const linhas = text.split("\n").filter((raw) => {
    const l = raw.trim();
    const m = l.match(/^[⚡✨]?\s*A[çc][ãa]o\s+para\s+agora\s*:?\s*(.*)$/i);
    if (m) {
      const rest = m[1].trim();
      if (rest) acao = rest;
      return false;
    }
    return true;
  });
  return { content: linhas.join("\n").trim(), acao };
}

function RichBlock({ text }: { text: string }) {
  if (!text || !text.trim()) return <p className="text-sm text-muted-foreground">—</p>;
  const linhas = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="space-y-1.5">
        {buf.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
            <span className="mt-[2px] select-none text-primary">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>,
    );
    buf = [];
  };
  for (const raw of linhas) {
    const l = raw.trim();
    if (!l) {
      flush();
      continue;
    }
    if (/^#{1,3}\s+/.test(l)) continue;
    const m = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) {
      buf.push(m[1].replace(/\*\*(.+?)\*\*/g, "$1"));
    } else {
      flush();
      nodes.push(
        <p key={`p-${nodes.length}`} className="text-sm leading-relaxed text-foreground/90">
          {l.replace(/\*\*(.+?)\*\*/g, "")}
        </p>,
      );
    }
  }
  flush();
  return <div className="space-y-2.5">{nodes}</div>;
}

function SectionBlock({
  title,
  icon,
  text,
  delay,
}: {
  title: string;
  icon?: React.ReactNode;
  text: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-in rounded-xl border border-border/60 bg-muted/20 p-5 transition-colors hover:border-border md:hover:bg-muted/25"
      style={delay ? { animationDelay: `${delay}ms`, animationFillMode: "both" } : undefined}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-border/40 pb-2.5">
        {icon}
        <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
      </div>
      <RichBlock text={text} />
    </div>
  );
}

function AcaoChip({ texto }: { texto: string }) {
  return (
    <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Zap className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Ação para agora
        </p>
        <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{texto}</p>
      </div>
    </div>
  );
}

function AnaliseResultado({
  analysis,
  generatedAt,
  onGenerate,
  rateLimited,
  minutesLeft,
  titleResumo,
  titleRecs,
  titleProj,
  titleDica,
  footerProgress,
}: {
  analysis: Analysis;
  generatedAt: Date | null;
  onGenerate: () => void;
  rateLimited: boolean;
  minutesLeft: number;
  titleResumo: string;
  titleRecs: string;
  titleProj: string;
  titleDica: string;
  footerProgress?: { realizado: number; meta: number; pct: number };
}) {
  const pResumo = extrairAcao(analysis.resumo_dia || "");
  const pRecs = extrairAcao(analysis.recomendacoes || "");
  const pProj = extrairAcao(analysis.projecao_mes || "");
  const pDica = extrairAcao(analysis.dica_estrategica || "");
  const acao = pDica.acao || pRecs.acao || pResumo.acao || pProj.acao;

  const handleShare = async () => {
    const texto = `📊 Análise Drive IA — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\n${titleResumo}\n${analysis.resumo_dia}\n\n${titleRecs}\n${analysis.recomendacoes}\n\n${titleProj}\n${analysis.projecao_mes}\n\n${titleDica}\n${analysis.dica_estrategica}\n\nGerado pelo Drive IA 🚗`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Minha Análise Drive IA", text: texto });
      } catch {
        /* cancelado */
      }
    } else {
      try {
        await navigator.clipboard.writeText(texto);
        toast.success("Análise copiada! Cole no WhatsApp ou e-mail.");
      } catch {
        toast.error("Não foi possível copiar a análise.");
      }
    }
  };

  return (
    <div className="space-y-3">
      <SectionBlock
        title={titleResumo}
        text={pResumo.content}
        delay={0}
      />
      <SectionBlock
        title={titleRecs}
        text={pRecs.content}
        delay={60}
      />
      <div
        className="animate-fade-in rounded-xl border border-border/60 bg-muted/20 p-5"
        style={{ animationDelay: "120ms", animationFillMode: "both" }}
      >
        <div className="mb-3 flex items-center gap-2 border-b border-border/40 pb-2.5">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
            {titleProj}
          </h3>
        </div>
        {footerProgress && (
          <div className="mb-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Realizado <strong className="text-foreground">{fmtBRL(footerProgress.realizado)}</strong>
              </span>
              <span className="text-muted-foreground">
                Meta <strong className="text-foreground">{fmtBRL(footerProgress.meta)}</strong>
              </span>
            </div>
            <Progress value={footerProgress.pct} className="h-2" />
          </div>
        )}
        <RichBlock text={pProj.content} />
      </div>
      <SectionBlock
        title={titleDica}
        icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
        text={pDica.content}
        delay={180}
      />

      {acao && (
        <div className="pt-2">
          <AcaoChip texto={acao} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-500" /> Não salva automaticamente
        </span>
        <span aria-hidden>·</span>
        {generatedAt && (
          <>
            <span>
              Gerado em{" "}
              {generatedAt.toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <span aria-hidden>·</span>
          </>
        )}
        {rateLimited ? (
          <span>⏳ Disponível em {minutesLeft} min</span>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Gerar nova análise
          </button>
        )}
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 transition-colors hover:underline"
        >
          <Share2 className="h-3 w-3" /> Compartilhar →
        </button>
      </div>
    </div>
  );
}
