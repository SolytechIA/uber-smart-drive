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

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
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
        <KpiCard label="Bruto do período" value={fmtBRL(m.ganhoBruto)} />
        <KpiCard label="Ganho real" value={fmtBRL(m.ganhoReal)} hint="Após custos" />
        <KpiCard label="R$/km" value={fmtBRL(rPorKm)} />
        <KpiCard label="R$/hora" value={fmtBRL(rPorHora)} />
      </div>

      {/* Linha 2 — métricas operacionais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Ticket médio" value={fmtBRL(ticketMedio)} />
        <KpiCard label="Corridas" value={String(m.numCorridas)} />
        <KpiCard label="Km rodados" value={`${fmtNumber(m.kmTotal, 1)} km`} />
        <KpiCard label="Horas no volante" value={formatHorasHHMM(m.horasTrabalhadas)} />
      </div>

      {/* Linha 3 — métricas de qualidade */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="% Corridas boas" value={`${fmtNumber(pctBoas, 0)}%`} />
        <KpiCard
          label="Custo / corrida"
          value={m.numCorridas > 0 ? fmtBRL(m.custoPorCorrida) : "—"}
          hint="Combustível + fixo + passe"
        />
        <KpiCard label="Custo combustível" value={fmtBRL(m.custoCombustivel)} />
        <KpiCard label="Custo fixo diário" value={fmtBRL(m.custoFixoDiario)} />
      </div>

      {/* Linha 4 — comparativos */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Custo total" value={fmtBRL(m.custoTotal)} />
        <KpiCard label="Custo fixo no período" value={fmtBRL(m.custoFixoProporcional)} />
        <KpiCard label="Ponto de equilíbrio /dia" value={fmtBRL(m.pontoEquilibrioDiario)} />
        <KpiCard label="Dias no período" value={String(m.diasNoPeriodo)} />
      </div>
    </section>
  );
}

export default RelatorioKpiPanel;
