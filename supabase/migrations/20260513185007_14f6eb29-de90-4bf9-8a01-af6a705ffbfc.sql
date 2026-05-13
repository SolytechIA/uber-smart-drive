CREATE TABLE IF NOT EXISTS public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_jornada date NOT NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz,
  duracao_minutos numeric GENERATED ALWAYS AS (
    CASE WHEN fim IS NOT NULL
    THEN EXTRACT(EPOCH FROM (fim - inicio)) / 60
    ELSE NULL END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jornadas_user_data ON public.jornadas(user_id, data_jornada);

ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own jornadas" ON public.jornadas
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);