CREATE TABLE IF NOT EXISTS public.analise_rate_limit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  periodo text NOT NULL,
  periodo_referencia text NOT NULL,
  ultima_analise timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analise_rate_limit_periodo_chk CHECK (periodo IN ('dia','semana','mes')),
  CONSTRAINT analise_rate_limit_uniq UNIQUE (user_id, periodo, periodo_referencia)
);

ALTER TABLE public.analise_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own analise_rate_limit"
ON public.analise_rate_limit
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analise_rate_limit_lookup
ON public.analise_rate_limit (user_id, periodo, periodo_referencia);