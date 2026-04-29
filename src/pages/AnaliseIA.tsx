import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Sparkles, AlertTriangle, Lightbulb, Star, RefreshCw, Clock, MapPin, Check, AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  calcPeriodMetrics,
  resolveGoals,
  fmtBRL,
  fmtInTZ,
  nowInTZ,
  projecaoMensal,
  type Ride,
  type Vehicle,
  type Goals,
} from "@/lib/financeiro";
import {
  getStartOfTodaySP,
  getEndOfTodaySP,
  getStartOfMonthSP,
  getEndOfMonthSP,
} from "@/lib/dateUtils";
import { endOfMonth, startOfMonth } from "date-fns";

interface Analysis {
  resumo_dia: string;
  recomendacoes: string;
  projecao_mes: string;
  dica_estrategica: string;
}

type Status = "idle" | "loading" | "ok" | "error" | "empty";

export default function AnaliseIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [realizadoMes, setRealizadoMes] = useState(0);
  const [metaMensal, setMetaMensal] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleGenerate = async () => {
    if (!user) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      // Carrega dados em paralelo
      const [ridesRes, vehicleRes, goalsRes] = await Promise.all([
        supabase.from("rides").select("*").eq("user_id", user.id),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      const rides = (ridesRes.data || []) as Ride[];
      const vehicle = (vehicleRes.data as Vehicle | null) ?? null;
      const goals = (goalsRes.data as Goals | null) ?? null;

      const fromHoje = getStartOfTodaySP();
      const toHoje = getEndOfTodaySP();
      const fromMes = getStartOfMonthSP();
      const toMes = getEndOfMonthSP();

      const mHoje = calcPeriodMetrics(rides, vehicle, fromHoje, toHoje);
      const mMes = calcPeriodMetrics(rides, vehicle, fromMes, toMes);

      if (mHoje.numCorridas === 0) {
        setStatus("empty");
        return;
      }

      const { diaria: metaDiaria, mensal: metaMensalCfg } = resolveGoals(goals, vehicle);
      const percentualMeta = metaDiaria > 0 ? (mHoje.ganhoReal / metaDiaria) * 100 : 0;

      // Filtra corridas de hoje para extras
      const isHoje = (r: Ride) => {
        if (r.data_corrida) {
          const ref = new Date(r.data_corrida + "T12:00:00");
          return ref >= fromHoje && ref <= toHoje;
        }
        if (r.horario_inicio) {
          const sp = new Date(new Date(r.horario_inicio).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          return sp >= fromHoje && sp <= toHoje;
        }
        return false;
      };
      const ridesHoje = rides.filter(isHoje);

      const ticketMedio = ridesHoje.length > 0 ? mHoje.ganhoBruto / ridesHoje.length : 0;
      const nBoas = ridesHoje.filter((r) => r.classificacao === "boa").length;
      const nMedias = ridesHoje.filter((r) => r.classificacao === "media").length;
      const nRuins = ridesHoje.filter((r) => r.classificacao === "ruim").length;

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

      const sortedByValor = [...ridesHoje].sort(
        (a, b) => Number(b.valor_bruto || 0) - Number(a.valor_bruto || 0),
      );
      const melhor = sortedByValor[0];
      const pior = sortedByValor[sortedByValor.length - 1];

      const refRide = (r: Ride | undefined) => ({
        valor: Number(r?.valor_bruto || 0),
        km: Number(r?.km_passageiro || 0) + Number(r?.km_deslocamento || 0),
        origem: r?.bairro_origem || "—",
        destino: r?.bairro_destino || "—",
      });

      // Projeção mensal
      const now = nowInTZ();
      const diaAtual = now.getDate();
      const ultimoDia = endOfMonth(now).getDate();
      const projMes = projecaoMensal(mMes.ganhoReal, diaAtual, ultimoDia, mMes.numCorridas) ?? mMes.ganhoReal;
      const diasRestantes = Math.max(0, ultimoDia - diaAtual);
      const valorFaltante = Math.max(0, metaMensalCfg - mMes.ganhoReal);
      const valorPorDia = diasRestantes > 0 ? valorFaltante / diasRestantes : valorFaltante;

      const dataHoje = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const payload = {
        total_corridas: mHoje.numCorridas,
        ganho_bruto: mHoje.ganhoBruto,
        custo_total: mHoje.custoTotal,
        ganho_real: mHoje.ganhoReal,
        meta_diaria: metaDiaria,
        percentual_meta: percentualMeta,
        km_total: mHoje.kmTotal,
        km_deslocamento_total: mHoje.kmDeslocamento,
        horas: mHoje.horasTrabalhadas,
        r_por_hora: mHoje.horasTrabalhadas > 0 ? mHoje.ganhoReal / mHoje.horasTrabalhadas : 0,
        r_por_km: mHoje.kmTotal > 0 ? mHoje.ganhoReal / mHoje.kmTotal : 0,
        ticket_medio: ticketMedio,
        n_boas: nBoas,
        n_medias: nMedias,
        n_ruins: nRuins,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        data_hoje: dataHoje,
        corrida_melhor: refRide(melhor),
        corrida_pior: refRide(pior),
        projecao_mensal: projMes,
        meta_mensal: metaMensalCfg,
        dias_restantes_mes: diasRestantes,
        valor_faltante_meta: valorFaltante,
        valor_necessario_por_dia: valorPorDia,
      };

      setRealizadoMes(mMes.ganhoReal);
      setMetaMensal(metaMensalCfg);
      setProgressPct(metaMensalCfg > 0 ? Math.min(100, (mMes.ganhoReal / metaMensalCfg) * 100) : 0);

      const { data, error } = await supabase.functions.invoke("groq-analysis", { body: payload });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || "Erro desconhecido");

      setAnalysis(data as Analysis);
      setGeneratedAt(new Date());
      setStatus("ok");
    } catch (e) {
      console.error("Erro análise IA:", e);
      setErrorMsg((e as Error).message || "Erro inesperado");
      setStatus("error");
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <header
          className="relative overflow-hidden rounded-2xl border border-border/50 p-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(270 80% 30% / 0.55), hsl(180 80% 30% / 0.55))",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_0%,white,transparent_60%)]" />
          <div className="relative">
            <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur animate-pulse shadow-[0_0_30px_rgba(168,85,247,0.6)]">
              <Brain className="h-9 w-9 text-white drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">Análise Inteligente</h1>
            <p className="mt-1 text-sm text-white/80">
              Gerado por IA • LLaMA 3.3 70B • Baseado no seu histórico
            </p>
          </div>
        </header>

        {/* Botão gerar */}
        {status !== "ok" && (
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={status === "loading"}
              className="group relative overflow-hidden px-8 py-6 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, hsl(270 80% 50%), hsl(180 80% 45%))",
              }}
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Sparkles className="mr-2 h-5 w-5" />
              {status === "loading" ? "Analisando..." : "Gerar Análise do Dia"}
            </Button>
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex gap-2">
                <span className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <span className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <span className="h-3 w-3 animate-bounce rounded-full bg-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Analisando suas corridas com IA...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty: sem corridas hoje */}
        {status === "empty" && (
          <Card className="border-orange-500/40 bg-orange-500/5">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-orange-500" />
              <p className="text-sm text-muted-foreground">
                Nenhuma corrida registrada hoje. Registre pelo menos uma corrida para gerar sua análise personalizada.
              </p>
              <Button onClick={() => navigate("/dashboard/operacional")}>
                Registrar Corrida
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {status === "error" && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium">Não foi possível gerar a análise no momento.</p>
                <p className="text-sm text-muted-foreground">Tente novamente em alguns instantes.</p>
                {errorMsg && <p className="mt-2 text-xs text-muted-foreground/70">{errorMsg}</p>}
              </div>
              <Button onClick={handleGenerate} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Resultado */}
        {status === "ok" && analysis && (
          <div className="space-y-5">
            {/* CARD 1 — Resumo */}
            <div className="rounded-xl p-[2px] [background:linear-gradient(135deg,hsl(270_80%_55%),hsl(180_80%_50%),hsl(270_80%_55%))] [background-size:200%_200%] animate-[shimmer_4s_linear_infinite]">
              <Card className="rounded-[10px] bg-card/95">
                <CardHeader>
                  <CardTitle className="text-lg">📊 Resumo do Dia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 whitespace-pre-line text-sm leading-relaxed">
                  {analysis.resumo_dia || "—"}
                </CardContent>
              </Card>
            </div>

            {/* CARD 2 — Recomendações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🎯 Recomendações para Amanhã</CardTitle>
              </CardHeader>
              <CardContent>
                <RecomendacoesGrid raw={analysis.recomendacoes} />
              </CardContent>
            </Card>

            {/* CARD 3 — Projeção Mensal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📈 Projeção do Mês</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Realizado: <strong className="text-foreground">{fmtBRL(realizadoMes)}</strong></span>
                  <span className="text-muted-foreground">Meta: <strong className="text-foreground">{fmtBRL(metaMensal)}</strong></span>
                </div>
                <Progress value={progressPct} className="h-3" />
                <div className="text-right text-xs text-muted-foreground">{progressPct.toFixed(1)}% atingido</div>
                <p className="whitespace-pre-line pt-2 text-sm leading-relaxed">{analysis.projecao_mes || "—"}</p>
              </CardContent>
            </Card>

            {/* CARD 4 — Dica Estratégica */}
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  💡 Dica Estratégica do Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed">{analysis.dica_estrategica || "—"}</p>
              </CardContent>
            </Card>

            {/* Footer badge */}
            <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
              <Badge variant="secondary" className="gap-1.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Gerado por IA • LLaMA 3.3 70B • Groq
              </Badge>
              {generatedAt && (
                <span className="text-xs text-muted-foreground">
                  {generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              )}
            </div>

            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleGenerate}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Gerar nova análise
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function RecomendacoesGrid({ raw }: { raw: string }) {
  // Extrai cada bloco a partir dos emojis
  const grab = (emoji: string) => {
    const re = new RegExp(`${emoji}([^\\n🕐📍✅⚠️]*(?:\\n(?!🕐|📍|✅|⚠️)[^\\n]*)*)`, "u");
    const m = raw.match(re);
    return m ? m[1].replace(/^[\s:.-]*/, "").trim() : "";
  };

  const items = [
    { icon: <Clock className="h-4 w-4" />, emoji: "🕐", title: "Melhores Horários", text: grab("🕐") },
    { icon: <MapPin className="h-4 w-4" />, emoji: "📍", title: "Regiões a Priorizar", text: grab("📍") },
    { icon: <Check className="h-4 w-4 text-emerald-500" />, emoji: "✅", title: "Priorize", text: grab("✅") },
    { icon: <AlertTriangle className="h-4 w-4 text-orange-500" />, emoji: "⚠️", title: "Evite", text: grab("⚠️") },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.emoji} className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            {it.icon}
            <span>{it.title}</span>
          </div>
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {it.text || "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
