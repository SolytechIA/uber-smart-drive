import { useEffect, useMemo, useState } from "react";
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

  // Reset ao trocar dia/semana/mês
  useEffect(() => {
    setStatus("idle");
    setAnalysis(null);
    setGeneratedAt(null);
    setResumo(null);
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
        ...calcContextoDia(rides, selectedDay),
        analise_personalizada: calcAnalisePersonalizada(rides, vehicle, goals, fromHoje, toHoje),
        nome_motorista: await getNomeMotorista(user),
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
        <div className="space-y-5">
          <div className="rounded-xl p-[2px] [background:linear-gradient(135deg,hsl(270_80%_55%),hsl(180_80%_50%),hsl(270_80%_55%))] [background-size:200%_200%] animate-[shimmer_4s_linear_infinite]">
            <Card className="rounded-[10px] bg-card/95">
              <CardHeader>
                <CardTitle className="text-lg">{titleResumo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 whitespace-pre-line text-sm leading-relaxed">
                {analysis.resumo_dia || "—"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{titleRecs}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed">{analysis.recomendacoes || "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{titleProj}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {footerProgress && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Realizado: <strong className="text-foreground">{fmtBRL(footerProgress.realizado)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Meta: <strong className="text-foreground">{fmtBRL(footerProgress.meta)}</strong>
                    </span>
                  </div>
                  <Progress value={footerProgress.pct} className="h-3" />
                </>
              )}
              <p className="whitespace-pre-line pt-2 text-sm leading-relaxed">{analysis.projecao_mes || "—"}</p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                {titleDica}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed">{analysis.dica_estrategica || "—"}</p>
            </CardContent>
          </Card>

          {/* Aviso de análise temporária */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Esta análise não fica salva. Compartilhe antes de sair da tela para não perder.
          </div>

          <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
            <Badge variant="secondary" className="gap-1.5">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />✨ Gerado por Drive IA
            </Badge>
            {generatedAt && (
              <span className="text-xs text-muted-foreground">
                Gerado em{" "}
                {generatedAt.toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-2 pt-2 sm:flex-row">
            <Button variant="outline" onClick={onGenerate} disabled={rateLimited}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {rateLimited ? `Disponível em ${minutesLeft} min` : "Gerar nova análise"}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const texto = `📊 Análise Drive IA — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\n${titleResumo}\n${analysis.resumo_dia}\n\n${titleRecs}\n${analysis.recomendacoes}\n\n${titleProj}\n${analysis.projecao_mes}\n\n${titleDica}\n${analysis.dica_estrategica}\n\nGerado pelo Drive IA 🚗`;
                if (typeof navigator !== "undefined" && (navigator as any).share) {
                  try {
                    await (navigator as any).share({ title: "Minha Análise Drive IA", text: texto });
                  } catch {
                    /* usuário cancelou */
                  }
                } else {
                  try {
                    await navigator.clipboard.writeText(texto);
                    toast.success("Análise copiada! Cole no WhatsApp ou e-mail.");
                  } catch {
                    toast.error("Não foi possível copiar a análise.");
                  }
                }
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
