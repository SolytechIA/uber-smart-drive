REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_plan(uuid, text, timestamptz) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_plan(uuid, text, timestamptz) TO authenticated;