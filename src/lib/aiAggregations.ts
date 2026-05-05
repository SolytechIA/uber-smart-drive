// Helpers de agregação para análise IA semanal/mensal.
// Usa o mesmo motor de calcPeriodMetrics, mas adiciona derivações narrativas
// (top dias, hora pico, melhor dia da semana, ganho perdido em deslocamentos longos).
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  calcPeriodMetrics,
  filterRidesInRange,
  nowInTZ,
  type Ride,
  type Vehicle,
} from "@/lib/financeiro";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface WeekAggregate {
  rotulo: string;
  from: Date;
  to: Date;
  total_corridas: number;
  ganho_bruto: number;
  ganho_real: number;
  r_por_hora: number;
  r_por_km: number;
  km_total: number;
  horas: number;
  melhor_dia: { rotulo: string; valor: number };
  pior_dia: { rotulo: string; valor: number };
  hora_pico: string;
  rkm_hora_pico: number;
  projecao_semanal: number;
}

export interface MonthAggregate {
  rotulo: string;
  from: Date;
  to: Date;
  total_corridas: number;
  ganho_bruto: number;
  ganho_real: number;
  r_por_hora: number;
  r_por_km: number;
  km_total: number;
  km_vazio_total: number;
  dias_trabalhados: number;
  top3_dias: Array<{ rotulo: string; valor: number; date: string }>;
  hora_pico: string;
  melhor_dia_semana: string;
  ganho_perdido_deslocamentos_longos: number;
  serie_diaria: Array<{ date: string; label: string; ganho_real: number }>;
  serie_dia_semana: Array<{ dia: string; ganho_real: number }>;
}

/** Agrupa corridas por bucket de hora e retorna janela com maior R$/km real médio. */
function calcHoraPico(rides: Ride[]): { rotulo: string; rkm: number } {
  const buckets = new Map<number, { valor: number; km: number }>();
  for (const r of rides) {
    if (!r.horario_inicio) continue;
    const h = new Date(
      new Date(r.horario_inicio).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
    ).getHours();
    const km = Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0);
    const cur = buckets.get(h) || { valor: 0, km: 0 };
    cur.valor += Number(r.valor_bruto || 0);
    cur.km += km;
    buckets.set(h, cur);
  }
  let bestH = 0;
  let bestRkm = 0;
  for (const [h, b] of buckets) {
    if (b.km > 5) {
      const rkm = b.valor / b.km;
      if (rkm > bestRkm) { bestRkm = rkm; bestH = h; }
    }
  }
  return { rotulo: `${bestH}h-${(bestH + 2) % 24}h`, rkm: bestRkm };
}

function calcMelhorDiaSemana(rides: Ride[]): string {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const r of rides) {
    if (!r.data_corrida) continue;
    const d = new Date(r.data_corrida + "T12:00:00");
    const dow = d.getDay();
    totals[dow] += Number(r.valor_bruto || 0);
    counts[dow] += 1;
  }
  let best = 0;
  let bestVal = 0;
  for (let i = 0; i < 7; i++) {
    const avg = counts[i] > 0 ? totals[i] / counts[i] : 0;
    if (avg > bestVal) { bestVal = avg; best = i; }
  }
  return DIAS_SEMANA[best];
}

function topNDays(rides: Ride[], n: number) {
  const map = new Map<string, number>();
  for (const r of rides) {
    if (!r.data_corrida) continue;
    map.set(r.data_corrida, (map.get(r.data_corrida) || 0) + Number(r.valor_bruto || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([date, valor]) => ({
      date,
      rotulo: format(new Date(date + "T12:00:00"), "dd/MM (EEE)", { locale: ptBR }),
      valor,
    }));
}

function bestWorstDay(rides: Ride[]) {
  const map = new Map<string, number>();
  for (const r of rides) {
    if (!r.data_corrida) continue;
    map.set(r.data_corrida, (map.get(r.data_corrida) || 0) + Number(r.valor_bruto || 0));
  }
  let best: [string, number] | null = null;
  let worst: [string, number] | null = null;
  for (const e of map.entries()) {
    if (!best || e[1] > best[1]) best = e;
    if (!worst || e[1] < worst[1]) worst = e;
  }
  const fmtDay = (d: string) =>
    format(new Date(d + "T12:00:00"), "EEEE dd/MM", { locale: ptBR });
  return {
    melhor: best ? { rotulo: fmtDay(best[0]), valor: best[1] } : { rotulo: "—", valor: 0 },
    pior: worst ? { rotulo: fmtDay(worst[0]), valor: worst[1] } : { rotulo: "—", valor: 0 },
  };
}

export function aggregateWeek(rides: Ride[], vehicle: Vehicle | null, from: Date, to: Date): WeekAggregate {
  const inRange = filterRidesInRange(rides, from, to);
  const m = calcPeriodMetrics(rides, vehicle, from, to);
  const bw = bestWorstDay(inRange);
  const hp = calcHoraPico(inRange);
  // Projeção semanal: receita atual / dias passados × 7 (se semana atual)
  const now = nowInTZ();
  const isCurrent = now >= from && now <= to;
  let projecao = m.ganhoReal;
  if (isCurrent && m.numCorridas > 0) {
    const diasPassados = Math.max(1, Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    projecao = (m.ganhoReal / diasPassados) * 7;
  }
  return {
    rotulo: `${format(from, "dd/MM")} a ${format(to, "dd/MM")}`,
    from, to,
    total_corridas: m.numCorridas,
    ganho_bruto: m.ganhoBruto,
    ganho_real: m.ganhoReal,
    r_por_hora: m.horasTrabalhadas > 0 ? m.ganhoReal / m.horasTrabalhadas : 0,
    r_por_km: m.kmTotal > 0 ? m.ganhoReal / m.kmTotal : 0,
    km_total: m.kmTotal,
    horas: m.horasTrabalhadas,
    melhor_dia: bw.melhor,
    pior_dia: bw.pior,
    hora_pico: hp.rotulo,
    rkm_hora_pico: hp.rkm,
    projecao_semanal: projecao,
  };
}

export function aggregateMonth(rides: Ride[], vehicle: Vehicle | null, from: Date, to: Date): MonthAggregate {
  const inRange = filterRidesInRange(rides, from, to);
  const m = calcPeriodMetrics(rides, vehicle, from, to);

  const diasUnicos = new Set(inRange.map((r) => r.data_corrida).filter(Boolean));
  const top3 = topNDays(inRange, 3);
  const hp = calcHoraPico(inRange);
  const melhorDow = calcMelhorDiaSemana(inRange);

  // Ganho perdido em deslocamentos longos (>5km)
  const desperdicio = inRange.reduce((sum, r) => {
    const desl = Number(r.km_deslocamento || 0);
    if (desl > 5) {
      const consumo = Number(vehicle?.consumo_km_litro || 12);
      const preco = Number(vehicle?.preco_combustivel || vehicle?.preco_gasolina || 6);
      return sum + (desl / consumo) * preco;
    }
    return sum;
  }, 0);

  // Série diária
  const dayMap = new Map<string, number>();
  for (const r of inRange) {
    if (!r.data_corrida) continue;
    const km = Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0);
    const consumo = Number(vehicle?.consumo_km_litro || 12);
    const preco = Number(vehicle?.preco_combustivel || vehicle?.preco_gasolina || 6);
    const custoComb = consumo > 0 ? (km / consumo) * preco : 0;
    const real = Number(r.valor_bruto || 0) - custoComb;
    dayMap.set(r.data_corrida, (dayMap.get(r.data_corrida) || 0) + real);
  }
  const serieDiaria = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, valor]) => ({ date, label: format(new Date(date + "T12:00:00"), "dd/MM"), ganho_real: Math.round(valor * 100) / 100 }));

  // Série por dia da semana
  const dowSums = new Array(7).fill(0);
  const dowCounts = new Array(7).fill(0);
  for (const [date, real] of dayMap) {
    const dow = new Date(date + "T12:00:00").getDay();
    dowSums[dow] += real;
    dowCounts[dow] += 1;
  }
  const serieDiaSemana = DIAS_SEMANA.map((d, i) => ({
    dia: d.slice(0, 3),
    ganho_real: dowCounts[i] > 0 ? Math.round((dowSums[i] / dowCounts[i]) * 100) / 100 : 0,
  }));

  return {
    rotulo: format(from, "MMMM yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
    from, to,
    total_corridas: m.numCorridas,
    ganho_bruto: m.ganhoBruto,
    ganho_real: m.ganhoReal,
    r_por_hora: m.horasTrabalhadas > 0 ? m.ganhoReal / m.horasTrabalhadas : 0,
    r_por_km: m.kmTotal > 0 ? m.ganhoReal / m.kmTotal : 0,
    km_total: m.kmTotal,
    km_vazio_total: m.kmDeslocamento,
    dias_trabalhados: diasUnicos.size,
    top3_dias: top3,
    hora_pico: hp.rotulo,
    melhor_dia_semana: melhorDow,
    ganho_perdido_deslocamentos_longos: Math.round(desperdicio * 100) / 100,
    serie_diaria: serieDiaria,
    serie_dia_semana: serieDiaSemana,
  };
}

export function getWeekRange(date: Date) {
  return { from: startOfWeek(date, { weekStartsOn: 1 }), to: endOfWeek(date, { weekStartsOn: 1 }) };
}
export function getPrevWeekRange(date: Date) {
  return getWeekRange(subWeeks(date, 1));
}
export function getMonthRange(date: Date) {
  return { from: startOfMonth(date), to: endOfMonth(date) };
}
export function getPrevMonthRange(date: Date) {
  return getMonthRange(subMonths(date, 1));
}
