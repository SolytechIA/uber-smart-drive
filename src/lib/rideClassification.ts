export type Classificacao = "BOA" | "MEDIA" | "RUIM";

/**
 * Parâmetros legados (mantidos por compatibilidade com chamadas antigas).
 * A classificação real agora usa as faixas de R$/km abaixo (r_km_bom / r_km_medio).
 */
export interface ClassifyParams {
  valor_minimo_corrida: number;
  km_max_deslocamento: number;
  r_por_km_minimo: number;
  r_km_bom?: number;
  r_km_medio?: number;
}

export interface RideMetrics {
  valor_bruto: number;
  km_passageiro: number;
  km_deslocamento: number;
}

/**
 * Classificação por R$/km real (denominador = km_passageiro + km_deslocamento):
 *   - r_por_km >= r_km_bom            → BOA
 *   - r_por_km >= r_km_medio          → MEDIA
 *   - r_por_km <  r_km_medio          → RUIM
 *
 * Defaults seguros caso os parâmetros não estejam configurados:
 *   r_km_bom   = r_por_km_minimo (ou 1.8)
 *   r_km_medio = max(r_por_km_minimo - 0.5, r_por_km_minimo * 0.7) (ou 1.3)
 */
export function classifyRide(ride: RideMetrics, params: ClassifyParams): Classificacao {
  const kmTotal = (ride.km_passageiro || 0) + (ride.km_deslocamento || 0);
  const rPorKm = kmTotal > 0 ? ride.valor_bruto / kmTotal : 0;

  const baseMin = Number(params.r_por_km_minimo) || 1.8;
  const rBom = Number(params.r_km_bom) || baseMin;
  const rMedio =
    Number(params.r_km_medio) || Math.max(baseMin - 0.5, baseMin * 0.7);

  if (rPorKm >= rBom) return "BOA";
  if (rPorKm >= rMedio) return "MEDIA";
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
