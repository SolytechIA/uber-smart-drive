export type TipoPosse =
  | "proprio_quitado"
  | "financiado"
  | "alugado_diaria"
  | "alugado_semana";
export type Combustivel = "gasolina" | "etanol" | "flex" | "gnv" | "diesel" | "eletrico" | "hibrido";

export interface VehicleData {
  marca: string;
  modelo: string;
  ano: number | null;
  placa: string;
  tipo_posse: TipoPosse | "";
  valor_parcela_ou_diaria: number | null;
  combustivel: Combustivel | "";
  consumo_km_litro: number | null;
  preco_combustivel: number | null;
  capacidade_tanque: number | null;
  consumo_km_kwh: number | null;
  preco_kwh: number | null;
  // Flex (Bug 5B)
  preco_gasolina: number | null;
  preco_alcool: number | null;
  consumo_gasolina: number | null;
  consumo_alcool: number | null;
  // GNV reserva (Bug 5C) — preco_combustivel/consumo_km_litro são usados para o GNV em si
  preco_gasolina_reserva: number | null;
  consumo_gasolina_reserva: number | null;
}

export interface CostsData {
  custo_ipva_mensal: number | null; // armazenado como mensal (anual/12)
  ipva_anual_input: number | null;
  custo_seguro_mensal: number | null;
  custo_manutencao_mensal: number | null;
  custo_lavagem_mensal: number | null;
  valor_plano_celular: number | null;
  percentual_celular_trabalho: number;
  taxa_uber_percent: number;
  outros_custos_label: string;
  outros_custos_valor: number | null;
  dias_trabalhados_mes: number;
}

export interface GoalsData {
  meta_diaria: number | null;
  meta_semanal: number | null;
  meta_mensal: number | null;
  horas_meta_dia: number | null;
  km_max_deslocamento: number | null;
  valor_minimo_corrida: number | null;
  r_por_km_minimo: number | null;
  km_vazio_max_percent: number | null;
  // Bug 2: faixas de classificação por R$/km
  r_km_bom: number | null;
  r_km_medio: number | null;
}

export const initialVehicle: VehicleData = {
  marca: "",
  modelo: "",
  ano: null,
  placa: "",
  tipo_posse: "",
  valor_parcela_ou_diaria: null,
  combustivel: "",
  consumo_km_litro: null,
  preco_combustivel: null,
  capacidade_tanque: null,
  consumo_km_kwh: null,
  preco_kwh: null,
  preco_gasolina: null,
  preco_alcool: null,
  consumo_gasolina: null,
  consumo_alcool: null,
  preco_gasolina_reserva: null,
  consumo_gasolina_reserva: null,
};

export const initialCosts: CostsData = {
  custo_ipva_mensal: null,
  ipva_anual_input: null,
  custo_seguro_mensal: null,
  custo_manutencao_mensal: null,
  custo_lavagem_mensal: null,
  valor_plano_celular: null,
  percentual_celular_trabalho: 100,
  taxa_uber_percent: 25,
  outros_custos_label: "",
  outros_custos_valor: null,
  dias_trabalhados_mes: 22,
};

export const initialGoals: GoalsData = {
  meta_diaria: null,
  meta_semanal: null,
  meta_mensal: null,
  horas_meta_dia: 8,
  km_max_deslocamento: 3,
  valor_minimo_corrida: 8,
  r_por_km_minimo: 1.8,
  km_vazio_max_percent: 40,
  r_km_bom: 1.8,
  r_km_medio: 1.3,
};
