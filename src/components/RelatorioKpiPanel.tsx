import { useMemo, useState } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  Ride,
  Vehicle,
  JornadaRecord,
  UberPasse,
  calcPeriodMetrics,
  fmtBRL,
  fmtNumber,
  nowInTZ,
} from "@/lib/financeiro";
import { formatHorasHHMM } from "@/lib/formatters";
import { PeriodFilter, getPeriodRange, type Periodo } from "@/components/PeriodFilter";

interface Props {
  rides: Ride[];
  vehicle: Vehicle | null;
  jornadas: JornadaRecord[];
  passes: UberPasse[];
}

type Tone = "green" | "yellow" | "red" | "neutral";
const toneClass: Record<Tone, string> = {
  green: "text-emerald-500",
  yellow: "text-amber-500",
  red: "text-rose-500",
  neutral: "",
};

function tier(value: number, goodAtOrAbove: number, midAtOrAbove: number): Tone {
  if (value >= goodAtOrAbove) return "green";
  if (value >= midAtOrAbove) return "yellow";
  return "red";
}
function tierInverse(value: number, goodAtOrBelow: number, midAtOrBelow: number): Tone {
  if (value <= goodAtOrBelow) return "green";
  if (value <= midAtOrBelow) return "yellow";
  return "red";
}

function KpiCard({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</p>
        {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}


export function RelatorioKpiPanel({ rides, vehicle, jornadas, passes }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();

  const { from, to } = useMemo(() => {
    if (periodo === "acumulado") {
      // Para acumulado, encontra a primeira corrida real
      let min: Date | null = null;
      for (const r of rides) {
        const ref = r.data_corrida
          ? new Date(r.data_corrida + "T12:00:00")
          : r.horario_inicio
            ? new Date(r.horario_inicio)
            : null;
        if (ref && (!min || ref < min)) min = ref;
      }
      return { from: min ? startOfDay(min) : startOfDay(nowInTZ()), to: endOfDay(nowInTZ()) };
    }
    return getPeriodRange(periodo, custom);
  }, [periodo, custom, rides]);

  const m = useMemo(
    () => calcPeriodMetrics(rides, vehicle, from, to, jornadas, passes),
    [rides, vehicle, from, to, jornadas, passes],
  );

  const rPorKm = m.kmTotal > 0 ? m.ganhoBruto / m.kmTotal : 0;
  const rPorHora = m.horasTrabalhadas > 0 ? m.ganhoBruto / m.horasTrabalhadas : 0;
  const ticketMedio = m.numCorridas > 0 ? m.ganhoBruto / m.numCorridas : 0;

  const ridesInRange = useMemo(() => {
    const fromStr = format(from, "yyyy-MM-dd");
    const toStr = format(to, "yyyy-MM-dd");
    return rides.filter((r) => {
      const d = r.data_corrida || (r.horario_inicio ? r.horario_inicio.slice(0, 10) : null);
      return d && d >= fromStr && d <= toStr;
    });
  }, [rides, from, to]);

  const pctBoas = useMemo(() => {
    if (ridesInRange.length === 0) return 0;
    const boas = ridesInRange.filter((r) => (r.classificacao || "").toUpperCase() === "BOA").length;
    return (boas / ridesInRange.length) * 100;
  }, [ridesInRange]);

  return (
    <section className="space-y-4">
      <PeriodFilter periodo={periodo} custom={custom} onChange={(p, c) => { setPeriodo(p); setCustom(c); }} />


      {/* Linha 1 — métricas financeiras */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Bruto do período" value={fmtBRL(m.ganhoBruto)} tone="green" />
        <KpiCard label="Ganho real" value={fmtBRL(m.ganhoReal)} hint="Após custos" tone="green" />
        <KpiCard label="R$/km" value={fmtBRL(rPorKm)} tone={tier(rPorKm, 2, 1.5)} />
        <KpiCard label="R$/hora" value={fmtBRL(rPorHora)} tone={tier(rPorHora, 30, 20)} />
      </div>

      {/* Linha 2 — métricas operacionais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Ticket médio" value={fmtBRL(ticketMedio)} tone={tier(ticketMedio, 15, 10)} />
        <KpiCard label="Corridas" value={String(m.numCorridas)} />
        <KpiCard label="Km rodados" value={`${fmtNumber(m.kmTotal, 1)} km`} />
        <KpiCard label="Horas no volante" value={formatHorasHHMM(m.horasTrabalhadas)} />
      </div>

      {/* Linha 3 — métricas de qualidade */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="% Corridas boas" value={`${fmtNumber(pctBoas, 0)}%`} tone={tier(pctBoas, 70, 50)} />
        <KpiCard
          label="Custo / corrida"
          value={m.numCorridas > 0 ? fmtBRL(m.custoPorCorrida) : "—"}
          hint="Combustível + fixo + passe"
          tone={m.numCorridas > 0 ? tierInverse(m.custoPorCorrida, 5, 10) : "neutral"}
        />
        <KpiCard label="Custo combustível" value={fmtBRL(m.custoCombustivel)} tone="red" />
        <KpiCard label="Custo fixo diário" value={fmtBRL(m.custoFixoDiario)} tone="red" />
      </div>

      {/* Linha 4 — comparativos */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Custo total" value={fmtBRL(m.custoTotal)} tone="red" />
        <KpiCard label="Custo fixo no período" value={fmtBRL(m.custoFixoProporcional)} tone="red" />
        <KpiCard label="Ponto de equilíbrio /dia" value={fmtBRL(m.pontoEquilibrioDiario)} />
        <KpiCard label="Dias no período" value={String(m.diasNoPeriodo)} />
      </div>

    </section>
  );
}

export default RelatorioKpiPanel;
