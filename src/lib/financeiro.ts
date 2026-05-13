import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, differenceInCalendarDays, addDays } from "date-fns";

export type Periodo = "hoje" | "semana" | "mes" | "personalizado";

export const TZ = "America/Sao_Paulo";

/** Retorna a data "agora" como se estivesse em America/Sao_Paulo (componentes Y/M/D/H/m/s
 * representam o horário local de SP, mesmo que o objeto Date em si seja UTC). */
export function nowInTZ(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
  const h = get("hour"); // 24h
  return new Date(get("year"), get("month") - 1, get("day"), h === 24 ? 0 : h, get("minute"), get("second"));
}

/** Formata um instant ISO/Date no fuso de SP, ex: "HH:mm" ou "dd/MM HH:mm". */
export function fmtInTZ(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(d);
}

export interface Vehicle {
  combustivel?: string | null;
  consumo_km_litro?: number | null;
  preco_combustivel?: number | null;
  consumo_km_kwh?: number | null;
  preco_kwh?: number | null;
  custo_ipva_mensal?: number | null;
  custo_seguro_mensal?: number | null;
  custo_manutencao_mensal?: number | null;
  custo_lavagem_mensal?: number | null;
  percentual_celular_trabalho?: number | null;
  valor_plano_celular?: number | null;
  outros_custos_valor?: number | null;
  valor_parcela_ou_diaria?: number | null;
  tipo_posse?: string | null;
  taxa_uber_percent?: number | null;
  dias_trabalhados_mes?: number | null;
  // Flex / GNV
  preco_gasolina?: number | null;
  preco_alcool?: number | null;
  consumo_gasolina?: number | null;
  consumo_alcool?: number | null;
  preco_gasolina_reserva?: number | null;
  consumo_gasolina_reserva?: number | null;
}

export interface Goals {
  meta_diaria?: number | null;
  meta_semanal?: number | null;
  meta_mensal?: number | null;
  horas_meta_dia?: number | null;
}

export interface JornadaRecord {
  id: string;
  data_jornada: string;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
}

/** Soma de horas de jornadas no período [from, to] (data_jornada).
 * Para jornadas em andamento (fim=null), conta até agora. */
export function sumJornadaHoursInRange(jornadas: JornadaRecord[], from: Date, to: Date): number {
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");
  const now = Date.now();
  let total = 0;
  for (const j of jornadas) {
    if (!j.data_jornada) continue;
    if (j.data_jornada < fromStr || j.data_jornada > toStr) continue;
    if (j.fim) {
      total += Number(j.duracao_minutos || 0) / 60;
    } else if (j.inicio) {
      const ini = new Date(j.inicio).getTime();
      if (!isNaN(ini)) total += Math.max(0, (now - ini) / (1000 * 60 * 60));
    }
  }
  return total;
}

export interface Ride {
  id: string;
  data_corrida: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  valor_bruto: number | null;
  km_passageiro: number | null;
  km_deslocamento: number | null;
  km_total: number | null;
  duracao_minutos: number | null;
  classificacao: string | null;
  bairro_origem: string | null;
  bairro_destino: string | null;
}

export function getPeriodRange(periodo: Periodo, custom?: { from: Date; to: Date }): { from: Date; to: Date } {
  const now = nowInTZ();
  switch (periodo) {
    case "hoje":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "semana":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "mes":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "personalizado":
      return custom ? { from: startOfDay(custom.from), to: endOfDay(custom.to) } : { from: startOfDay(now), to: endOfDay(now) };
  }
}

/** Soma de todos os custos fixos mensais cadastrados no veículo. */
export function calcCustoFixoMensal(v: Vehicle | null): number {
  if (!v) return 0;
  const parcela = Number(v.valor_parcela_ou_diaria || 0);
  // diária × dias trabalhados; semanal × 4.33; senão mensal direto
  const parcelaMensal =
    v.tipo_posse === "alugado_diaria"
      ? parcela * Number(v.dias_trabalhados_mes || 22)
      : v.tipo_posse === "alugado_semana"
      ? parcela * 4.33
      : v.tipo_posse === "financiado"
      ? parcela
      : 0; // próprio quitado
  const celular = Number(v.valor_plano_celular || 0) * (Number(v.percentual_celular_trabalho || 0) / 100);
  return (
    parcelaMensal +
    Number(v.custo_ipva_mensal || 0) +
    Number(v.custo_seguro_mensal || 0) +
    Number(v.custo_manutencao_mensal || 0) +
    Number(v.custo_lavagem_mensal || 0) +
    celular +
    Number(v.outros_custos_valor || 0)
  );
}

/** Custo de combustível para um total de km, baseado no veículo. */
export function calcCustoCombustivel(kmTotal: number, v: Vehicle | null): number {
  if (!v || !kmTotal) return 0;
  if (v.combustivel === "eletrico") {
    const consumo = Number(v.consumo_km_kwh || 0);
    const preco = Number(v.preco_kwh || 0);
    if (!consumo) return 0;
    return (kmTotal / consumo) * preco;
  }
  if (v.combustivel === "flex") {
    // Média entre gasolina e álcool quando ambos informados; caso contrário, usa o disponível.
    const cg = Number(v.consumo_gasolina || 0);
    const pg = Number(v.preco_gasolina || 0);
    const ca = Number(v.consumo_alcool || 0);
    const pa = Number(v.preco_alcool || 0);
    const custoG = cg > 0 && pg > 0 ? (kmTotal / cg) * pg : null;
    const custoA = ca > 0 && pa > 0 ? (kmTotal / ca) * pa : null;
    if (custoG != null && custoA != null) return (custoG + custoA) / 2;
    if (custoG != null) return custoG;
    if (custoA != null) return custoA;
    // fallback nos campos antigos
  }
  const consumo = Number(v.consumo_km_litro || 0);
  const preco = Number(v.preco_combustivel || 0);
  if (!consumo) return 0;
  return (kmTotal / consumo) * preco;
}

/** Filtra rides dentro do range usando data_corrida (ou horario_inicio em SP como fallback). */
export function filterRidesInRange(rides: Ride[], from: Date, to: Date): Ride[] {
  return rides.filter((r) => {
    let ref: Date | null = null;
    if (r.data_corrida) {
      // data_corrida é "YYYY-MM-DD" (sem TZ) — tratamos como meio-dia local
      ref = new Date(r.data_corrida + "T12:00:00");
    } else if (r.horario_inicio) {
      // horario_inicio é UTC; convertemos para wallclock de SP
      const utc = new Date(r.horario_inicio);
      const sp = new Date(utc.toLocaleString("en-US", { timeZone: TZ }));
      ref = sp;
    }
    if (!ref) return false;
    return ref >= from && ref <= to;
  });
}

export interface PeriodMetrics {
  ganhoBruto: number;
  comissaoUber: number;
  ganhoLiquido: number;
  custoCombustivel: number;
  custoFixoProporcional: number;
  custoTotal: number;
  ganhoReal: number;
  kmTotal: number;
  kmPassageiro: number;
  kmDeslocamento: number;
  horasTrabalhadas: number;
  numCorridas: number;
  diasNoPeriodo: number;
  custoFixoDiario: number;
  custoCombustivelDiario: number;
  pontoEquilibrioDiario: number;
  /** Faturamento bruto / horas efetivas ao volante (duracao_minutos das corridas). */
  ganhoBrutoPorHora: number;
  /** Faturamento bruto / soma(km_passageiro + km_deslocamento). */
  ganhoBrutoPorKm: number;
}

/** Limita uma data ao fim do dia atual em SP, para evitar contar dias futuros. */
export function clampToTodayTZ(to: Date): Date {
  const todayEnd = endOfDay(nowInTZ());
  return to > todayEnd ? todayEnd : to;
}

export function calcPeriodMetrics(rides: Ride[], vehicle: Vehicle | null, from: Date, to: Date, jornadas?: JornadaRecord[]): PeriodMetrics {
  const toClamped = clampToTodayTZ(to);
  // Se o período ainda não começou, retorna zeros
  if (from > toClamped) {
    return {
      ganhoBruto: 0, comissaoUber: 0, ganhoLiquido: 0, custoCombustivel: 0,
      custoFixoProporcional: 0, custoTotal: 0, ganhoReal: 0, kmTotal: 0,
      kmPassageiro: 0, kmDeslocamento: 0, horasTrabalhadas: 0, numCorridas: 0,
      diasNoPeriodo: 0, custoFixoDiario: 0, custoCombustivelDiario: 0,
      pontoEquilibrioDiario: 0, ganhoBrutoPorHora: 0, ganhoBrutoPorKm: 0,
    };
  }
  to = toClamped;
  const inRange = filterRidesInRange(rides, from, to);
  const ganhoBruto = inRange.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
  // Decisão do usuário: bruto = líquido (sem comissão por corrida)
  const comissaoUber = 0;
  const ganhoLiquido = ganhoBruto - comissaoUber;

  const kmPassageiro = inRange.reduce((s, r) => s + Number(r.km_passageiro || 0), 0);
  const kmDeslocamento = inRange.reduce((s, r) => s + Number(r.km_deslocamento || 0), 0);
  // Sempre usa passageiro + deslocamento (km vazio entra no denominador)
  const kmTotal = inRange.reduce(
    (s, r) => s + (Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0)),
    0
  );

  const horasCorridas = inRange.reduce((s, r) => s + Number(r.duracao_minutos || 0) / 60, 0);
  const horasJornada = jornadas && jornadas.length > 0 ? sumJornadaHoursInRange(jornadas, from, to) : 0;
  const horasTrabalhadas = horasJornada > 0 ? horasJornada : horasCorridas;

  const custoCombustivel = calcCustoCombustivel(kmTotal, vehicle);

  const custoFixoMensal = calcCustoFixoMensal(vehicle);
  const diasTrabMes = Number(vehicle?.dias_trabalhados_mes || 22);
  const custoFixoDiario = diasTrabMes > 0 ? custoFixoMensal / diasTrabMes : 0;
  const diasNoPeriodo = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const custoFixoProporcional = custoFixoDiario * diasNoPeriodo;

  const custoTotal = custoCombustivel + custoFixoProporcional;
  const ganhoReal = ganhoLiquido - custoTotal;

  // Custo de combustível diário: km médio/dia (baseado em dias trabalhados configurados)
  // × custo por km de combustível. Estima quanto se gasta por dia trabalhado.
  const custoPorKmCombustivel = kmTotal > 0 ? custoCombustivel / kmTotal : 0;
  const kmMedioDia = diasNoPeriodo > 0 ? kmTotal / diasNoPeriodo : 0;
  const custoCombustivelDiario = kmMedioDia * custoPorKmCombustivel;
  const pontoEquilibrioDiario = custoFixoDiario + custoCombustivelDiario;

  // Métricas de produtividade bruta (não dependem de custos/metas)
  const ganhoBrutoPorHora = horasTrabalhadas > 0 ? ganhoBruto / horasTrabalhadas : 0;
  const ganhoBrutoPorKm = kmTotal > 0 ? ganhoBruto / kmTotal : 0;

  return {
    ganhoBruto,
    comissaoUber,
    ganhoLiquido,
    custoCombustivel,
    custoFixoProporcional,
    custoTotal,
    ganhoReal,
    kmTotal,
    kmPassageiro,
    kmDeslocamento,
    horasTrabalhadas,
    numCorridas: inRange.length,
    diasNoPeriodo,
    custoFixoDiario,
    custoCombustivelDiario,
    pontoEquilibrioDiario,
    ganhoBrutoPorHora,
    ganhoBrutoPorKm,
  };
}

export interface DailyPoint {
  date: string; // ISO yyyy-MM-dd
  label: string; // dd/MM
  ganhoBruto: number;
  ganhoReal: number;
  custoCombustivel: number;
  custoFixo: number;
  comissaoUber: number;
  numCorridas: number;
  horas: number;
}

export function buildDailySeries(rides: Ride[], vehicle: Vehicle | null, from: Date, to: Date): DailyPoint[] {
  const days = eachDayOfInterval({ start: from, end: to });
  const custoFixoMensal = calcCustoFixoMensal(vehicle);
  const diasTrabMes = Number(vehicle?.dias_trabalhados_mes || 22);
  const custoFixoDia = diasTrabMes > 0 ? custoFixoMensal / diasTrabMes : 0;
  const todayEnd = endOfDay(nowInTZ());

  return days.map((day) => {
    const dStart = startOfDay(day);
    const dEnd = endOfDay(day);
    // Dia futuro: exibe label mas sem dados
    if (dStart > todayEnd) {
      return {
        date: format(day, "yyyy-MM-dd"),
        label: format(day, "dd/MM"),
        ganhoBruto: null as any, ganhoReal: null as any,
        custoCombustivel: null as any, custoFixo: null as any,
        comissaoUber: null as any, numCorridas: 0, horas: 0,
      };
    }
    const dayRides = filterRidesInRange(rides, dStart, dEnd);
    const ganhoBruto = dayRides.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
    const kmTotal = dayRides.reduce((s, r) => s + Number(r.km_total || (Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0))), 0);
    const horas = dayRides.reduce((s, r) => s + Number(r.duracao_minutos || 0) / 60, 0);
    const custoCombustivel = calcCustoCombustivel(kmTotal, vehicle);
    const custoFixo = custoFixoDia;
    const comissaoUber = 0;
    const ganhoReal = ganhoBruto - comissaoUber - custoCombustivel - custoFixo;

    return {
      date: format(day, "yyyy-MM-dd"),
      label: format(day, "dd/MM"),
      ganhoBruto: round2(ganhoBruto),
      ganhoReal: round2(ganhoReal),
      custoCombustivel: round2(custoCombustivel),
      custoFixo: round2(custoFixo),
      comissaoUber: round2(comissaoUber),
      numCorridas: dayRides.length,
      horas: round2(horas),
    };
  });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNumber(n: number, digits = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Resolve metas: usa salvas se existirem, senão deriva da diária. */
export function resolveGoals(goals: Goals | null, vehicle: Vehicle | null): { diaria: number; semanal: number; mensal: number } {
  const diaria = Number(goals?.meta_diaria || 0);
  const diasTrab = Number(vehicle?.dias_trabalhados_mes || 22);
  const semanal = goals?.meta_semanal != null && Number(goals.meta_semanal) > 0 ? Number(goals.meta_semanal) : diaria * 6;
  const mensal = goals?.meta_mensal != null && Number(goals.meta_mensal) > 0 ? Number(goals.meta_mensal) : diaria * diasTrab;
  return { diaria, semanal, mensal };
}

/** Meta proporcional ao período selecionado (em dias). */
export function metaPeriodo(metaDiaria: number, diasNoPeriodo: number): number {
  return metaDiaria * diasNoPeriodo;
}

/** Projeção de fim de dia. Retorna null se não houver horas/corridas registradas. */
export function projecaoFimDia(receitaHoje: number, horasTrabalhadasHoje: number, horasMetaDia: number, numCorridasHoje: number): number | null {
  if (numCorridasHoje <= 0 || horasTrabalhadasHoje <= 0 || horasMetaDia <= 0) return null;
  if (horasTrabalhadasHoje >= horasMetaDia) return receitaHoje;
  return (receitaHoje / horasTrabalhadasHoje) * horasMetaDia;
}

export function diasRestantesSemana(): number {
  const now = nowInTZ();
  const fim = endOfWeek(now, { weekStartsOn: 1 });
  return Math.max(0, differenceInCalendarDays(fim, now));
}

export function diasJaPassadosSemana(): number {
  const now = nowInTZ();
  const ini = startOfWeek(now, { weekStartsOn: 1 });
  return Math.max(1, differenceInCalendarDays(now, ini) + 1);
}

/** Projeção semanal: receita atual + (média diária × dias restantes). null se não houver dados. */
export function projecaoSemanal(receitaSemanaAtual: number, numCorridasSemana: number): number | null {
  if (numCorridasSemana <= 0) return null;
  const passados = diasJaPassadosSemana();
  const restantes = diasRestantesSemana();
  const mediaDia = receitaSemanaAtual / passados;
  return receitaSemanaAtual + mediaDia * restantes;
}

/** Projeção mensal baseada em receita atual / dias passados × total dias do mês. */
export function projecaoMensal(receitaMesAtual: number, diaAtualDoMes: number, diasNoMes: number, numCorridasMes: number): number | null {
  if (numCorridasMes <= 0 || diaAtualDoMes <= 0) return null;
  const mediaDia = receitaMesAtual / diaAtualDoMes;
  const diasRestantes = Math.max(0, diasNoMes - diaAtualDoMes);
  return receitaMesAtual + mediaDia * diasRestantes;
}

export { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay };
