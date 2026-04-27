
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_classificacao_check;
ALTER TABLE public.rides ADD CONSTRAINT rides_classificacao_check
  CHECK (classificacao IS NULL OR classificacao = ANY (ARRAY['BOA'::text, 'MEDIA'::text, 'RUIM'::text]));
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS rua_origem text;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS rua_destino text;
