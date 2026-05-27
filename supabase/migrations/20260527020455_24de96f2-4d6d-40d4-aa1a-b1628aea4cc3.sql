
-- ============ ERRO 1: subscriptions ============
DROP POLICY IF EXISTS "Users insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow insert" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.subscriptions;

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;
GRANT ALL ON public.subscriptions TO service_role;

-- ============ ERRO 2: users (privilege escalation) ============
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on uid" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users update own safe fields" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
  nome,
  telefone,
  cidade,
  estado,
  sexo,
  ano_nascimento,
  telefone_verificado,
  aceite_privacidade,
  aceite_privacidade_em,
  uber_conectado,
  uber_ultimo_sync
) ON public.users TO authenticated;

-- ============ AVISO 3: drop duplicated uber credential columns ============
ALTER TABLE public.users
  DROP COLUMN IF EXISTS uber_cookie,
  DROP COLUMN IF EXISTS uber_csrf_token,
  DROP COLUMN IF EXISTS uber_earnings_seed;

-- ============ AVISO 5: touch trigger does not need DEFINER ============
CREATE OR REPLACE FUNCTION public.touch_uber_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;
