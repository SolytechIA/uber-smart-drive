CREATE TABLE IF NOT EXISTS public.analises_geradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo text NOT NULL CHECK (periodo IN ('dia','semana','mes')),
  data_referencia date NOT NULL,
  payload jsonb NOT NULL,
  resumo_dia text NOT NULL,
  recomendacoes text NOT NULL,
  projecao_mes text NOT NULL,
  dica_estrategica text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analises_user_periodo ON public.analises_geradas(user_id, periodo, data_referencia DESC);

ALTER TABLE public.analises_geradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own analises"
  ON public.analises_geradas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);