CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    false
  );

  INSERT INTO public.subscriptions (user_id, plano, status, data_inicio, data_renovacao, valor)
  VALUES (NEW.id, 'trial', 'ativo', now(), now() + interval '7 days', 0);

  RETURN NEW;
END;
$$;