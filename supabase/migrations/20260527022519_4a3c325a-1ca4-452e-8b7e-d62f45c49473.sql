
-- Tighten analise_rate_limit: drop ALL policy, allow only INSERT/SELECT for owner.
-- Server-side enforcement uses service_role to write/upsert.
DROP POLICY IF EXISTS "Users manage own analise_rate_limit" ON public.analise_rate_limit;

CREATE POLICY "Users select own rate limit"
  ON public.analise_rate_limit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own rate limit"
  ON public.analise_rate_limit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Revoke UPDATE/DELETE from authenticated (only service_role can mutate rate-limit rows)
REVOKE UPDATE, DELETE ON public.analise_rate_limit FROM authenticated;
REVOKE UPDATE, DELETE ON public.analise_rate_limit FROM anon;
GRANT ALL ON public.analise_rate_limit TO service_role;
