-- Drop old check constraints that block new plan values
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_plano_check;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plano_check;

-- Add mp_subscription_id column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mp_subscription_id text;

-- Normalize plan values
UPDATE public.users SET plano = 'trial' WHERE plano = 'free_trial';
UPDATE public.subscriptions SET plano = 'trial' WHERE plano = 'free_trial';

-- Mark expired trials
UPDATE public.users
  SET plano = 'expired'
  WHERE plano = 'trial' AND trial_expira_em IS NOT NULL AND trial_expira_em <= now();

-- Recreate check constraints with new allowed values
ALTER TABLE public.users
  ADD CONSTRAINT users_plano_check CHECK (plano IN ('trial','pro','expired'));
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plano_check CHECK (plano IN ('trial','pro','expired','cancelado'));

-- Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (
    id, email, nome, telefone, cidade,
    plano, trial_expira_em, is_admin
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'telefone', ''),
    COALESCE(NEW.raw_user_meta_data->>'cidade', ''),
    'trial',
    now() + interval '7 days',
    (NEW.email = 'gonzaga.fs27@gmail.com')
  );

  INSERT INTO public.subscriptions (user_id, plano, status, data_inicio, data_renovacao, valor)
  VALUES (NEW.id, 'trial', 'ativo', now(), now() + interval '7 days', 0);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin helper: list all users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.users ORDER BY created_at DESC;
END;
$$;

-- Admin helper: update plan
CREATE OR REPLACE FUNCTION public.admin_update_user_plan(
  target_user_id uuid,
  new_plano text,
  new_trial_expiry timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF new_plano NOT IN ('trial','pro','expired') THEN
    RAISE EXCEPTION 'invalid plano';
  END IF;
  UPDATE public.users
    SET plano = new_plano,
        trial_expira_em = CASE
          WHEN new_plano = 'pro' THEN NULL
          ELSE COALESCE(new_trial_expiry, trial_expira_em)
        END
    WHERE id = target_user_id;
END;
$$;