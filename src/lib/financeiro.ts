import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, differenceInCalendarDays, addDays } from "date-fns";

export type Periodo = "hoje" | "semana" | "mes" | "personalizado";

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
}

export interface Goals {
  meta_diaria?: number | null;
  meta_semanal?: number | null;
  meta_mensal?: number | null;
  horas_meta_dia?: number | null;
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
  const now = new Date();
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
  const parcela = v.tipo_posse && v.tipo_posse !== "proprio" ? Number(v.valor_parcela_ou_diaria || 0) : Number(v.valor_parcela_ou_diaria || 0);
  // Se é diária, multiplica pelos dias trabalhados/mês; senão é mensal direto
  const parcelaMensal = v.tipo_posse === "alugado_diaria" ? parcela * Number(v.dias_trabalhados_mes || 22) : parcela;
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
  const consumo = Number(v.consumo_km_litro || 0);
  const preco = Number(v.preco_combustivel || 0);
  if (!consumo) return 0;
  return (kmTotal / consumo) * preco;
}

/** Filtra rides dentro do range usando data_corrida (ou horario_inicio como fallback). */
export function filterRidesInRange(rides: Ride[], from: Date, to: Date): Ride[] {
  return rides.filter((r) => {
    const ref = r.data_corrida ? new Date(r.data_corrida + "T12:00:00") : r.horario_inicio ? new Date(r.horario_inicio) : null;
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

export function calcPeriodMetrics(rides: Ride[], vehicle: Vehicle | null, from: Date, to: Date): PeriodMetrics {
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

  const horasTrabalhadas = inRange.reduce((s, r) => s + Number(r.duracao_minutos || 0) / 60, 0);

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

  return days.map((day) => {
    const dStart = startOfDay(day);
    const dEnd = endOfDay(day);
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

export function projecaoFimDia(ganhoAtual: number, horasTrabalhadasHoje: number): number {
  // Projeta linear até 10h padrão se ainda não atingiu
  if (horasTrabalhadasHoje <= 0) return ganhoAtual;
  const horasAlvo = 10;
  if (horasTrabalhadasHoje >= horasAlvo) return ganhoAtual;
  return (ganhoAtual / horasTrabalhadasHoje) * horasAlvo;
}

export function diasRestantesSemana(): number {
  const now = new Date();
  const fim = endOfWeek(now, { weekStartsOn: 1 });
  return Math.max(0, differenceInCalendarDays(fim, now));
}

export function projecaoMensal(ganhoMesAtual: number, diaAtualDoMes: number, diasNoMes: number): number {
  if (diaAtualDoMes <= 0) return 0;
  return (ganhoMesAtual / diaAtualDoMes) * diasNoMes;
}

export { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay };
