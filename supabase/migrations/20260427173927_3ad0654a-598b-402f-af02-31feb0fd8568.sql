ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_user_id_unique UNIQUE (user_id);
ALTER TABLE public.goals ADD CONSTRAINT goals_user_id_unique UNIQUE (user_id);