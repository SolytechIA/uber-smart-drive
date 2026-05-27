
-- Remove duplicates if any, keeping the most recent
DELETE FROM public.analise_rate_limit a
USING public.analise_rate_limit b
WHERE a.user_id = b.user_id
  AND a.periodo = b.periodo
  AND a.periodo_referencia = b.periodo_referencia
  AND a.ultima_analise < b.ultima_analise;

CREATE UNIQUE INDEX IF NOT EXISTS analise_rate_limit_user_periodo_ref_uniq
  ON public.analise_rate_limit (user_id, periodo, periodo_referencia);
