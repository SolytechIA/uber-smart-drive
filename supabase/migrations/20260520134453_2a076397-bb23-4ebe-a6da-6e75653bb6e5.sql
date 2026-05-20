
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS estado CHAR(2),
  ADD COLUMN IF NOT EXISTS sexo TEXT,
  ADD COLUMN IF NOT EXISTS ano_nascimento SMALLINT,
  ADD COLUMN IF NOT EXISTS telefone_verificado BOOLEAN NOT NULL DEFAULT FALSE;

-- Recreate admin_list_users so the new columns are reflected in the returned row type
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS SETOF public.users
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.users ORDER BY created_at DESC;
END;
$function$;
