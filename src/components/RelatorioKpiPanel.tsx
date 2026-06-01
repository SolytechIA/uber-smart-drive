import { useMemo, useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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

type Periodo = "hoje" | "semana" | "mes" | "acumulado" | "personalizado";

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

const LABELS: Record<Periodo, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  acumulado: "Acumulado",
  personalizado: "Personalizado",
};

export function RelatorioKpiPanel({ rides, vehicle, jornadas, passes }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [custom, setCustom] = useState<{ from: Date; to: Date }>(() => {
    const n = nowInTZ();
    return { from: startOfDay(n), to: endOfDay(n) };
  });

  const { from, to } = useMemo(() => {
    const n = nowInTZ();
    switch (periodo) {
      case "hoje":
        return { from: startOfDay(n), to: endOfDay(n) };
      case "semana":
        return { from: startOfWeek(n, { weekStartsOn: 1 }), to: endOfWeek(n, { weekStartsOn: 1 }) };
      case "mes":
        return { from: startOfMonth(n), to: endOfMonth(n) };
      case "acumulado": {
        let min: Date | null = null;
        for (const r of rides) {
          const ref = r.data_corrida
            ? new Date(r.data_corrida + "T12:00:00")
            : r.horario_inicio
              ? new Date(r.horario_inicio)
              : null;
          if (ref && (!min || ref < min)) min = ref;
        }
        return { from: min ? startOfDay(min) : startOfMonth(n), to: endOfDay(n) };
      }
      case "personalizado":
        return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
    }
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

  const opts: Periodo[] = ["hoje", "semana", "mes", "acumulado", "personalizado"];

  const badgeText =
    periodo === "personalizado"
      ? `${format(custom.from, "dd/MM", { locale: ptBR })} – ${format(custom.to, "dd/MM", { locale: ptBR })}`
      : LABELS[periodo];

  return (
    <section className="space-y-4">
      {/* Filtro único */}
      <div className="flex flex-wrap items-center gap-2">
        {opts.map((o) => (
          <Button
            key={o}
            size="sm"
            variant={periodo === o ? "default" : "outline"}
            onClick={() => setPeriodo(o)}
            className={cn(periodo === o && "gradient-bg")}
          >
            {LABELS[o]}
          </Button>
        ))}
        {periodo === "personalizado" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(custom.from, "dd/MM/yyyy", { locale: ptBR })} – {format(custom.to, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: custom.from, to: custom.to }}
                onSelect={(r) => r?.from && r?.to && setCustom({ from: r.from, to: r.to })}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Badge de período ativo */}
      <Badge variant="outline" className="text-xs">
        📅 Exibindo: {badgeText}
      </Badge>

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
