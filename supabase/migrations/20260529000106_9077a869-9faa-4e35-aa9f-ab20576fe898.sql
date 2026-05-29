-- Remove Uber connection columns and table (descontinuação da integração Uber automática)
ALTER TABLE public.users
  DROP COLUMN IF EXISTS uber_conectado,
  DROP COLUMN IF EXISTS uber_ultimo_sync;

DROP TABLE IF EXISTS public.uber_connections;

-- Garantir coluna plataforma em rides (já existe, mas idempotente)
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS plataforma text NOT NULL DEFAULT 'Uber';

-- Nova tabela: lancamentos (ganhos e custos manuais multi-plataforma)
CREATE TABLE IF NOT EXISTS public.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ganho', 'custo')),
  conta text NOT NULL,
  descricao text,
  valor numeric(10,2) NOT NULL,
  data date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos TO authenticated;
GRANT ALL ON public.lancamentos TO service_role;

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lancamentos"
  ON public.lancamentos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lancamentos_user_data ON public.lancamentos(user_id, data DESC);