// Cálculos comportamentais e contexto temporal para análise IA.
// Esses dados são enviados estruturados ao Groq, que apenas formata o texto.
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calcCustoCombustivel, nowInTZ, type Goals, type Ride, type Vehicle } from "@/lib/financeiro";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export type ContextoTemporal =
  | "mes_passado" | "mes_atual_iniciante" | "mes_atual_andamento" | "mes_atual_concluido"
  | "semana_passada" | "semana_atual_iniciante" | "semana_atual_andamento"
  | "dia_passado" | "dia_atual";

export interface ContextoTemporalInfo {
  contexto_temporal: ContextoTemporal;
  periodo_referencia: string; // ex "Março/2026" ou "28/04 a 04/05"
  periodo_atual: string;       // ex "Maio/2026" ou "Esta semana"
  dias_com_corridas: number;
}

export interface BlocoComportamental {
  titulo: string;
  descricao: string;
  impacto_rs: number; // valor estimado em R$ (positivo)
}

export interface AnalisePersonalizada {
  eliminar: BlocoComportamental;
  manter: BlocoComportamental;
  melhorar: BlocoComportamental;
}

function ridesNoPeriodo(rides: Ride[], from: Date, to: Date): Ride[] {
  return rides.filter((r) => {
    if (!r.data_corrida) return false;
    const ref = new Date(r.data_corrida + "T12:00:00");
    return ref >= from && ref <= to;
  });
}

function diasComCorridas(rides: Ride[]): number {
  const set = new Set<string>();
  for (const r of rides) if (r.data_corrida) set.add(r.data_corrida);
  return set.size;
}

export function calcContextoMes(rides: Ride[], from: Date, to: Date): ContextoTemporalInfo {
  const inRange = ridesNoPeriodo(rides, from, to);
  const dias = diasComCorridas(inRange);
  const now = nowInTZ();
  const isCurrent = now >= from && now <= to;
  const periodoRef = format(from, "MMMM/yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  const periodoAtual = format(now, "MMMM/yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  let contexto: ContextoTemporal;
  if (!isCurrent) contexto = "mes_passado";
  else if (dias < 5) contexto = "mes_atual_iniciante";
  else if (dias < 25) contexto = "mes_atual_andamento";
  else contexto = "mes_atual_concluido";
  return { contexto_temporal: contexto, periodo_referencia: periodoRef, periodo_atual: periodoAtual, dias_com_corridas: dias };
}

export function calcContextoSemana(rides: Ride[], from: Date, to: Date): ContextoTemporalInfo {
  const inRange = ridesNoPeriodo(rides, from, to);
  const dias = diasComCorridas(inRange);
  const now = nowInTZ();
  const isCurrent = now >= from && now <= to;
  const periodoRef = `${format(from, "dd/MM")} a ${format(to, "dd/MM")}`;
  const curWeek = { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  const periodoAtual = `${format(curWeek.from, "dd/MM")} a ${format(curWeek.to, "dd/MM")}`;
  let contexto: ContextoTemporal;
  if (!isCurrent) contexto = "semana_passada";
  else if (dias < 3) contexto = "semana_atual_iniciante";
  else contexto = "semana_atual_andamento";
  return { contexto_temporal: contexto, periodo_referencia: periodoRef, periodo_atual: periodoAtual, dias_com_corridas: dias };
}

export function calcContextoDia(rides: Ride[], dia: Date): ContextoTemporalInfo {
  const dayKey = format(dia, "yyyy-MM-dd");
  const todayKey = format(nowInTZ(), "yyyy-MM-dd");
  const inDay = rides.filter((r) => r.data_corrida === dayKey);
  return {
    contexto_temporal: dayKey === todayKey ? "dia_atual" : "dia_passado",
    periodo_referencia: format(dia, "dd/MM/yyyy"),
    periodo_atual: format(nowInTZ(), "dd/MM/yyyy"),
    dias_com_corridas: inDay.length > 0 ? 1 : 0,
  };
}

/** Bloco ELIMINAR: corridas com deslocamento acima do limite configurado.
 *  Impacto = soma do custo de combustível desperdiçado nesses deslocamentos. */
function calcEliminar(rides: Ride[], vehicle: Vehicle | null, goals: Goals | null): BlocoComportamental {
  const limiteKm = Number((goals as any)?.km_max_deslocamento || 5);
  const ofensoras = rides.filter((r) => Number(r.km_deslocamento || 0) > limiteKm);
  const desperdicio = ofensoras.reduce((sum, r) => sum + calcCustoCombustivel(Number(r.km_deslocamento || 0), vehicle), 0);
  return {
    titulo: ofensoras.length > 0
      ? `Aceitar corridas com deslocamento acima de ${limiteKm} km`
      : "Continue evitando deslocamentos longos",
    descricao: ofensoras.length > 0
      ? `Você aceitou ${ofensoras.length} corridas com deslocamento acima de ${limiteKm} km no período. Esses trajetos vazios consumiram combustível sem retorno.`
      : `Não foram detectadas corridas com deslocamento acima de ${limiteKm} km no período. Mantenha esse padrão.`,
    impacto_rs: Math.round(desperdicio * 100) / 100,
  };
}

/** Bloco MANTER: identifica o melhor padrão consistente (hora ou dia da semana) por R$/km. */
function calcManter(rides: Ride[], vehicle: Vehicle | null): BlocoComportamental {
  // Agrupa por hora
  const horaMap = new Map<number, { valor: number; km: number; n: number }>();
  const dowMap = new Map<number, { valor: number; km: number; n: number }>();
  let valorTotal = 0;
  let kmTotal = 0;
  for (const r of rides) {
    const km = Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0);
    const v = Number(r.valor_bruto || 0);
    valorTotal += v;
    kmTotal += km;
    if (r.horario_inicio) {
      const h = new Date(new Date(r.horario_inicio).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
      const cur = horaMap.get(h) || { valor: 0, km: 0, n: 0 };
      cur.valor += v; cur.km += km; cur.n += 1;
      horaMap.set(h, cur);
    }
    if (r.data_corrida) {
      const dow = new Date(r.data_corrida + "T12:00:00").getDay();
      const cur = dowMap.get(dow) || { valor: 0, km: 0, n: 0 };
      cur.valor += v; cur.km += km; cur.n += 1;
      dowMap.set(dow, cur);
    }
  }
  const mediaRkm = kmTotal > 0 ? valorTotal / kmTotal : 0;

  let bestH = -1, bestHRkm = 0;
  for (const [h, b] of horaMap) {
    if (b.n >= 3 && b.km > 10) {
      const rkm = b.valor / b.km;
      if (rkm > bestHRkm) { bestHRkm = rkm; bestH = h; }
    }
  }
  let bestD = -1, bestDRkm = 0;
  for (const [d, b] of dowMap) {
    if (b.n >= 2 && b.km > 10) {
      const rkm = b.valor / b.km;
      if (rkm > bestDRkm) { bestDRkm = rkm; bestD = d; }
    }
  }

  // Escolhe o melhor entre hora e dia
  const horaWins = bestHRkm >= bestDRkm;
  if (horaWins && bestH >= 0) {
    const ganhoExtra = (bestHRkm - mediaRkm) * (horaMap.get(bestH)?.km || 0);
    return {
      titulo: `Trabalhar entre ${bestH}h e ${(bestH + 2) % 24}h`,
      descricao: `Sua faixa de horário mais rentável rendeu R$ ${bestHRkm.toFixed(2)}/km vs. média geral de R$ ${mediaRkm.toFixed(2)}/km. Continue priorizando esse intervalo.`,
      impacto_rs: Math.max(0, Math.round(ganhoExtra * 100) / 100),
    };
  }
  if (bestD >= 0) {
    const ganhoExtra = (bestDRkm - mediaRkm) * (dowMap.get(bestD)?.km || 0);
    return {
      titulo: `Priorizar ${DIAS_SEMANA[bestD]}s`,
      descricao: `${DIAS_SEMANA[bestD]} é seu dia mais rentável (R$ ${bestDRkm.toFixed(2)}/km vs. média de R$ ${mediaRkm.toFixed(2)}/km). Mantenha esse dia ativo na sua rotina.`,
      impacto_rs: Math.max(0, Math.round(ganhoExtra * 100) / 100),
    };
  }
  return {
    titulo: "Mantenha consistência",
    descricao: "Ainda não há dados suficientes para identificar um padrão consistente. Continue registrando corridas.",
    impacto_rs: 0,
  };
}

/** Bloco MELHORAR: redistribuir horas dos piores horários para os melhores. */
function calcMelhorar(rides: Ride[]): BlocoComportamental {
  const horaMap = new Map<number, { valor: number; horas: number; n: number }>();
  for (const r of rides) {
    if (!r.horario_inicio) continue;
    const h = new Date(new Date(r.horario_inicio).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
    const horas = Number(r.duracao_minutos || 0) / 60;
    const cur = horaMap.get(h) || { valor: 0, horas: 0, n: 0 };
    cur.valor += Number(r.valor_bruto || 0);
    cur.horas += horas;
    cur.n += 1;
    horaMap.set(h, cur);
  }
  let bestH = -1, bestRH = 0;
  let worstH = -1, worstRH = Infinity;
  for (const [h, b] of horaMap) {
    if (b.n >= 3 && b.horas > 0.5) {
      const rh = b.valor / b.horas;
      if (rh > bestRH) { bestRH = rh; bestH = h; }
      if (rh < worstRH) { worstRH = rh; worstH = h; }
    }
  }
  if (bestH < 0 || worstH < 0 || bestH === worstH) {
    return {
      titulo: "Concentre suas horas nos picos",
      descricao: "Conforme você acumular mais corridas, vamos identificar os melhores horários para redistribuir suas horas.",
      impacto_rs: 0,
    };
  }
  const horasDesperdicadas = horaMap.get(worstH)?.horas || 0;
  const ganhoExtra = (bestRH - worstRH) * horasDesperdicadas;
  return {
    titulo: `Trocar horas das ${worstH}h pelas ${bestH}h`,
    descricao: `Nas ${worstH}h você fatura R$ ${worstRH.toFixed(2)}/h, mas nas ${bestH}h faz R$ ${bestRH.toFixed(2)}/h. Redistribuir as ${horasDesperdicadas.toFixed(1)}h trabalhadas no horário fraco pode aumentar significativamente seu ganho.`,
    impacto_rs: Math.max(0, Math.round(ganhoExtra * 100) / 100),
  };
}

/** Calcula os 3 blocos usando todo o histórico relevante (últimos 60 dias por padrão). */
export function calcAnalisePersonalizada(
  rides: Ride[],
  vehicle: Vehicle | null,
  goals: Goals | null,
): AnalisePersonalizada {
  return {
    eliminar: calcEliminar(rides, vehicle, goals),
    manter: calcManter(rides, vehicle),
    melhorar: calcMelhorar(rides),
  };
}
