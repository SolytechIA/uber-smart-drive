
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS aceite_privacidade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aceite_privacidade_em timestamptz;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS public.uber_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  uber_cookie text,
  uber_email text,
  status text NOT NULL DEFAULT 'inactive',
  ultima_sincronizacao timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uber_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own uber connection"
  ON public.uber_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_uber_connections_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uber_connections_updated_at ON public.uber_connections;
CREATE TRIGGER trg_uber_connections_updated_at
  BEFORE UPDATE ON public.uber_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_uber_connections_updated_at();
