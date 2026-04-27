export type Classificacao = "BOA" | "MEDIA" | "RUIM";

export interface ClassifyParams {
  valor_minimo_corrida: number;
  km_max_deslocamento: number;
  r_por_km_minimo: number;
}

export interface RideMetrics {
  valor_bruto: number;
  km_passageiro: number;
  km_deslocamento: number;
}

/**
 * Lógica:
 *  - BOA: valor >= valor_minimo E deslocamento <= km_max_deslocamento E (valor/km_total) >= r_por_km_minimo
 *  - RUIM: falha em 2 ou mais critérios
 *  - MEDIA: falha em apenas 1 critério
 */
export function classifyRide(ride: RideMetrics, params: ClassifyParams): Classificacao {
  const kmTotal = (ride.km_passageiro || 0) + (ride.km_deslocamento || 0);
  const rPorKm = kmTotal > 0 ? ride.valor_bruto / kmTotal : 0;

  let falhas = 0;
  if (ride.valor_bruto < params.valor_minimo_corrida) falhas++;
  if (ride.km_deslocamento > params.km_max_deslocamento) falhas++;
  if (rPorKm < params.r_por_km_minimo) falhas++;

  if (falhas === 0) return "BOA";
  if (falhas === 1) return "MEDIA";
  return "RUIM";
}

export const classificacaoLabel: Record<Classificacao, string> = {
  BOA: "✅ BOA",
  MEDIA: "🟡 MÉDIA",
  RUIM: "❌ RUIM",
};

export const classificacaoColor: Record<Classificacao, string> = {
  BOA: "bg-success/15 text-success border-success/30",
  MEDIA: "bg-warning/15 text-warning border-warning/30",
  RUIM: "bg-destructive/15 text-destructive border-destructive/30",
};
