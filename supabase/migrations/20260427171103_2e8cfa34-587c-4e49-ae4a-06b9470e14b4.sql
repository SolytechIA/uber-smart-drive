
-- =========================================
-- TABLE: users (perfis)
-- =========================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  cidade TEXT,
  plano TEXT NOT NULL DEFAULT 'free_trial' CHECK (plano IN ('free_trial','pro')),
  trial_expira_em TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uber_cookie TEXT,
  uber_csrf_token TEXT,
  uber_earnings_seed TEXT,
  uber_conectado BOOLEAN NOT NULL DEFAULT false,
  uber_ultimo_sync TIMESTAMPTZ
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =========================================
-- TABLE: vehicles
-- =========================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  marca TEXT,
  modelo TEXT,
  ano INTEGER,
  placa TEXT,
  tipo_posse TEXT CHECK (tipo_posse IN ('proprio_quitado','financiado','alugado_diaria','alugado_semanal')),
  valor_parcela_ou_diaria NUMERIC,
  combustivel TEXT CHECK (combustivel IN ('gasolina','etanol','flex','gnv','diesel','eletrico','hibrido')),
  consumo_km_litro NUMERIC,
  preco_combustivel NUMERIC,
  capacidade_tanque NUMERIC,
  consumo_km_kwh NUMERIC,
  preco_kwh NUMERIC,
  custo_ipva_mensal NUMERIC,
  custo_seguro_mensal NUMERIC,
  custo_manutencao_mensal NUMERIC,
  custo_lavagem_mensal NUMERIC,
  percentual_celular_trabalho NUMERIC,
  valor_plano_celular NUMERIC,
  outros_custos_label TEXT,
  outros_custos_valor NUMERIC,
  taxa_uber_percent NUMERIC NOT NULL DEFAULT 25,
  dias_trabalhados_mes INTEGER NOT NULL DEFAULT 22,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- TABLE: goals
-- =========================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meta_diaria NUMERIC,
  meta_semanal NUMERIC,
  meta_mensal NUMERIC,
  horas_meta_dia NUMERIC,
  km_max_deslocamento NUMERIC,
  valor_minimo_corrida NUMERIC,
  r_por_km_minimo NUMERIC,
  km_vazio_max_percent NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- TABLE: rides
-- =========================================
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  uber_ride_uuid TEXT,
  plataforma TEXT NOT NULL DEFAULT 'Uber',
  horario_inicio TIMESTAMPTZ,
  horario_fim TIMESTAMPTZ,
  duracao_minutos NUMERIC,
  valor_bruto NUMERIC,
  valor_liquido NUMERIC,
  km_passageiro NUMERIC,
  km_deslocamento NUMERIC,
  km_total NUMERIC,
  bairro_origem TEXT,
  bairro_destino TEXT,
  classificacao TEXT CHECK (classificacao IN ('boa','media','ruim')),
  custo_combustivel_corrida NUMERIC,
  ganho_real_corrida NUMERIC,
  r_por_km_real NUMERIC,
  data_corrida DATE,
  fonte TEXT CHECK (fonte IN ('uber_api','manual')),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rides" ON public.rides
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rides_user_data ON public.rides(user_id, data_corrida DESC);

-- =========================================
-- TABLE: subscriptions
-- =========================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plano TEXT NOT NULL CHECK (plano IN ('free_trial','pro')),
  status TEXT NOT NULL CHECK (status IN ('ativo','cancelado','expirado')),
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_renovacao TIMESTAMPTZ,
  valor NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================
-- TRIGGER: handle_new_user
-- Cria registro em public.users após signup
-- Define is_admin=true automaticamente para gonzaga.fs27@gmail.com
-- =========================================
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
    'free_trial',
    now() + interval '7 days',
    (NEW.email = 'gonzaga.fs27@gmail.com')
  );

  INSERT INTO public.subscriptions (user_id, plano, status, data_inicio, data_renovacao, valor)
  VALUES (NEW.id, 'free_trial', 'ativo', now(), now() + interval '7 days', 0);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
