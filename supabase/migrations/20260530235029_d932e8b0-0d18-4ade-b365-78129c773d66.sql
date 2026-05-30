-- Tighten RLS roles from public to authenticated across user-scoped tables.

-- jornadas
DROP POLICY IF EXISTS "Users manage own jornadas" ON public.jornadas;
CREATE POLICY "Users manage own jornadas" ON public.jornadas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- goals
DROP POLICY IF EXISTS "Users manage own goals" ON public.goals;
CREATE POLICY "Users manage own goals" ON public.goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- rides
DROP POLICY IF EXISTS "Users manage own rides" ON public.rides;
CREATE POLICY "Users manage own rides" ON public.rides
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- vehicles
DROP POLICY IF EXISTS "Users manage own vehicles" ON public.vehicles;
CREATE POLICY "Users manage own vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- analises_geradas
DROP POLICY IF EXISTS "Users manage own analises" ON public.analises_geradas;
CREATE POLICY "Users manage own analises" ON public.analises_geradas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- uber_passes
DROP POLICY IF EXISTS "Users manage own passes" ON public.uber_passes;
CREATE POLICY "Users manage own passes" ON public.uber_passes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- users: keep separate SELECT/INSERT, scope to authenticated
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
