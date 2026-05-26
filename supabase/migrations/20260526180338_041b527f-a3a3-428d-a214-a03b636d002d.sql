CREATE TABLE IF NOT EXISTS public.uber_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('tempo', 'ganhos')),
  duracao_horas NUMERIC,
  teto_ganhos NUMERIC,
  valor_pago NUMERIC NOT NULL,
  iniciado_em TIMESTAMPTZ NOT NULL,
  encerrado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uber_passes TO authenticated;
GRANT ALL ON public.uber_passes TO service_role;

ALTER TABLE public.uber_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own passes" ON public.uber_passes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_uber_passes_user_iniciado ON public.uber_passes (user_id, iniciado_em DESC);