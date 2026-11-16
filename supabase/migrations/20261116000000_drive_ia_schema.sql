-- =====================================================================
-- DRIVE IA — esquema completo do banco (projeto Supabase próprio)
-- Consolida as 19 migrações originais do Lovable e acrescenta:
--   * corridas por print (categoria, preço dinâmico, anti-duplicidade)
--   * hodômetro por jornada (km vazio rateado)
--   * seguro por km com passageiro (valor líquido automático)
--   * referência padronizada no limite de análises
-- Pode ser executado mais de uma vez sem erro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- USERS (perfil; 1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nome text,
  telefone text,
  cidade text,
  estado char(2),
  sexo text,
  ano_nascimento smallint,
  telefone_verificado boolean not null default false,
  plano text not null default 'trial'
    constraint users_plano_check check (plano in ('trial','pro','expired')),
  trial_expira_em timestamptz,
  ativo boolean not null default true,
  is_admin boolean not null default false,
  aceite_privacidade boolean not null default false,
  aceite_privacidade_em timestamptz,
  mp_subscription_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- VEHICLES (veículo e custos; 1 por usuário)
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade
    constraint vehicles_user_id_unique unique,
  marca text,
  modelo text,
  ano integer,
  placa text,
  tipo_posse text
    constraint vehicles_tipo_posse_check check (
      tipo_posse is null or tipo_posse in
      ('proprio_quitado','financiado','alugado_diaria','alugado_semana')),
  valor_parcela_ou_diaria numeric,
  combustivel text
    constraint vehicles_combustivel_check check (
      combustivel in ('gasolina','etanol','flex','gnv','diesel','eletrico','hibrido')),
  consumo_km_litro numeric,
  preco_combustivel numeric,
  capacidade_tanque numeric,
  consumo_km_kwh numeric,
  preco_kwh numeric,
  custo_ipva_mensal numeric,
  custo_seguro_mensal numeric,
  custo_manutencao_mensal numeric,
  custo_lavagem_mensal numeric,
  percentual_celular_trabalho numeric,
  valor_plano_celular numeric,
  outros_custos_label text,
  outros_custos_valor numeric,
  taxa_uber_percent numeric not null default 25,
  dias_trabalhados_mes integer not null default 22,
  preco_gasolina numeric,
  preco_alcool numeric,
  consumo_gasolina numeric,
  consumo_alcool numeric,
  preco_gasolina_reserva numeric,
  consumo_gasolina_reserva numeric,
  -- NOVO: seguro da plataforma descontado por km rodado com passageiro (R$/km)
  seguro_por_km numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- GOALS (metas e faixas de classificação; 1 por usuário)
-- ---------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade
    constraint goals_user_id_unique unique,
  meta_diaria numeric,
  meta_semanal numeric,
  meta_mensal numeric,
  horas_meta_dia numeric,
  km_max_deslocamento numeric,
  valor_minimo_corrida numeric,
  r_por_km_minimo numeric,
  km_vazio_max_percent numeric,
  r_km_bom numeric,
  r_km_medio numeric,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RIDES (corridas)
-- ---------------------------------------------------------------------
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  uber_ride_uuid text,
  plataforma text not null default 'Uber',
  -- NOVO: categoria da corrida (Uber X, Prioridade, Comfort...)
  categoria text,
  horario_inicio timestamptz,
  horario_fim timestamptz,
  duracao_minutos numeric,
  valor_bruto numeric,
  -- NOVO: parcela do valor que veio de preço dinâmico
  preco_dinamico numeric,
  -- NOVO: seguro descontado nesta corrida (km_passageiro x seguro_por_km)
  seguro_corrida numeric,
  valor_liquido numeric,
  km_passageiro numeric,
  km_deslocamento numeric,
  -- NOVO: true enquanto o km de deslocamento é estimativa (média/rateio do hodômetro)
  km_deslocamento_estimado boolean not null default false,
  km_total numeric,
  rua_origem text,
  bairro_origem text,
  rua_destino text,
  bairro_destino text,
  classificacao text
    constraint rides_classificacao_check check (
      classificacao is null or classificacao in ('BOA','MEDIA','RUIM')),
  custo_combustivel_corrida numeric,
  ganho_real_corrida numeric,
  r_por_km_real numeric,
  data_corrida date,
  fonte text
    constraint rides_fonte_check check (fonte in ('manual','print','uber_api')),
  origem text not null default 'manual',
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rides_user_data
  on public.rides (user_id, data_corrida desc);

-- Anti-duplicidade das corridas lidas por print: o mesmo motorista não
-- termina duas corridas no mesmo minuto com o mesmo valor.
create unique index if not exists rides_print_dedupe
  on public.rides (user_id, plataforma, horario_fim, valor_bruto)
  where fonte = 'print';

-- ---------------------------------------------------------------------
-- SUBSCRIPTIONS (histórico de plano; só o servidor escreve)
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plano text not null
    constraint subscriptions_plano_check check (plano in ('trial','pro','expired','cancelado')),
  status text not null
    constraint subscriptions_status_check check (status in ('ativo','cancelado','expirado')),
  data_inicio timestamptz not null default now(),
  data_renovacao timestamptz,
  valor numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- JORNADAS (cronômetro de trabalho)
-- ---------------------------------------------------------------------
create table if not exists public.jornadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_jornada date not null,
  inicio timestamptz not null,
  fim timestamptz,
  duracao_minutos numeric generated always as (
    case when fim is not null
      then extract(epoch from (fim - inicio)) / 60
      else null end
  ) stored,
  -- NOVO: hodômetro ao iniciar e ao pausar/encerrar (km)
  odometro_inicio numeric,
  odometro_fim numeric,
  created_at timestamptz not null default now(),
  constraint jornadas_odometro_check check (
    odometro_inicio is null or odometro_fim is null or odometro_fim >= odometro_inicio)
);

create index if not exists idx_jornadas_user_data
  on public.jornadas (user_id, data_jornada);

-- ---------------------------------------------------------------------
-- ANALISES_GERADAS (histórico das análises de IA)
-- ---------------------------------------------------------------------
create table if not exists public.analises_geradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo text not null
    constraint analises_geradas_periodo_check check (periodo in ('dia','semana','mes')),
  data_referencia date not null,
  payload jsonb not null,
  resumo_dia text not null,
  recomendacoes text not null,
  projecao_mes text not null,
  dica_estrategica text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_analises_user_periodo
  on public.analises_geradas (user_id, periodo, data_referencia desc);

-- ---------------------------------------------------------------------
-- ANALISE_RATE_LIMIT (intervalo mínimo entre análises)
-- periodo_referencia PADRONIZADO: dia/semana = AAAA-MM-DD, mes = AAAA-MM
-- ---------------------------------------------------------------------
create table if not exists public.analise_rate_limit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo text not null
    constraint analise_rate_limit_periodo_chk check (periodo in ('dia','semana','mes')),
  periodo_referencia text not null
    constraint analise_rate_limit_ref_formato check (
      periodo_referencia ~ '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'),
  ultima_analise timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analise_rate_limit_uniq unique (user_id, periodo, periodo_referencia)
);

-- ---------------------------------------------------------------------
-- UBER_PASSES (passes de taxa zero comprados na plataforma)
-- ---------------------------------------------------------------------
create table if not exists public.uber_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null
    constraint uber_passes_tipo_check check (tipo in ('tempo','ganhos')),
  duracao_horas numeric,
  teto_ganhos numeric,
  valor_pago numeric not null,
  iniciado_em timestamptz not null,
  encerrado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_uber_passes_user_iniciado
  on public.uber_passes (user_id, iniciado_em desc);

-- ---------------------------------------------------------------------
-- LANCAMENTOS (ganhos e custos avulsos: promoções, gorjetas, despesas)
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null
    constraint lancamentos_tipo_check check (tipo in ('ganho','custo')),
  conta text not null,
  descricao text,
  valor numeric(10,2) not null,
  data date not null,
  -- NOVO: horário e origem, para não duplicar promoções lidas por print
  horario timestamptz,
  fonte text not null default 'manual'
    constraint lancamentos_fonte_check check (fonte in ('manual','print')),
  created_at timestamptz not null default now()
);

create index if not exists idx_lancamentos_user_data
  on public.lancamentos (user_id, data desc);

create unique index if not exists lancamentos_print_dedupe
  on public.lancamentos (user_id, conta, horario, valor)
  where fonte = 'print';

-- =====================================================================
-- FUNÇÕES
-- =====================================================================

-- Cria o perfil e o registro de trial quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, nome, telefone, cidade, plano, trial_expira_em, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'telefone', ''),
    coalesce(new.raw_user_meta_data->>'cidade', ''),
    'trial',
    now() + interval '7 days',
    false
  );

  insert into public.subscriptions (user_id, plano, status, data_inicio, data_renovacao, valor)
  values (new.id, 'trial', 'ativo', now(), now() + interval '7 days', 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin: lista todos os usuários
create or replace function public.admin_list_users()
returns setof public.users
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'forbidden';
  end if;
  return query select * from public.users order by created_at desc;
end;
$$;

-- Admin: altera o plano de um usuário (e registra no histórico de assinaturas)
create or replace function public.admin_update_user_plan(
  target_user_id uuid,
  new_plano text,
  new_trial_expiry timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plano_anterior text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'forbidden';
  end if;
  if new_plano not in ('trial','pro','expired') then
    raise exception 'invalid plano';
  end if;

  select plano into plano_anterior from public.users where id = target_user_id;

  update public.users
    set plano = new_plano,
        trial_expira_em = case
          when new_plano = 'pro' then null
          else coalesce(new_trial_expiry, trial_expira_em)
        end
    where id = target_user_id;

  -- Mantém subscriptions coerente com users.plano (antes nunca era atualizada)
  if found and plano_anterior is distinct from new_plano then
    update public.subscriptions
      set status = 'expirado'
      where user_id = target_user_id and status = 'ativo';
    insert into public.subscriptions (user_id, plano, status, data_inicio, data_renovacao, valor)
    values (
      target_user_id, new_plano,
      case when new_plano = 'expired' then 'expirado' else 'ativo' end,
      now(),
      case when new_plano = 'trial' then new_trial_expiry else null end,
      0
    );
  end if;
end;
$$;

-- =====================================================================
-- SEGURANÇA: RLS em todas as tabelas + permissões explícitas
-- (não depende da opção "Automatically expose new tables")
-- =====================================================================
alter table public.users              enable row level security;
alter table public.vehicles           enable row level security;
alter table public.goals              enable row level security;
alter table public.rides              enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.jornadas           enable row level security;
alter table public.analises_geradas   enable row level security;
alter table public.analise_rate_limit enable row level security;
alter table public.uber_passes        enable row level security;
alter table public.lancamentos        enable row level security;

-- Zera permissões de quem não está logado e de usuários logados, e concede só o necessário
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage on schema public to anon, authenticated, service_role;

-- users: lê e cria o próprio perfil; altera apenas campos seguros
grant select, insert on public.users to authenticated;
grant update (nome, telefone, cidade, estado, sexo, ano_nascimento,
              telefone_verificado, aceite_privacidade, aceite_privacidade_em)
  on public.users to authenticated;

grant select, insert, update, delete on public.vehicles         to authenticated;
grant select, insert, update, delete on public.goals            to authenticated;
grant select, insert, update, delete on public.rides            to authenticated;
grant select, insert, update, delete on public.jornadas         to authenticated;
grant select, insert, update, delete on public.analises_geradas to authenticated;
grant select, insert, update, delete on public.uber_passes      to authenticated;
grant select, insert, update, delete on public.lancamentos      to authenticated;
grant select                         on public.subscriptions    to authenticated;
grant select, insert                 on public.analise_rate_limit to authenticated;

-- Políticas (recriadas para o script ser reexecutável)
drop policy if exists "Users can view own profile"   on public.users;
drop policy if exists "Users can insert own profile" on public.users;
drop policy if exists "Users update own safe fields" on public.users;
create policy "Users can view own profile" on public.users
  for select to authenticated using (auth.uid() = id);
create policy "Users can insert own profile" on public.users
  for insert to authenticated with check (auth.uid() = id);
create policy "Users update own safe fields" on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users manage own vehicles" on public.vehicles;
create policy "Users manage own vehicles" on public.vehicles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own goals" on public.goals;
create policy "Users manage own goals" on public.goals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own rides" on public.rides;
create policy "Users manage own rides" on public.rides
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view own subscriptions" on public.subscriptions;
create policy "Users view own subscriptions" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users manage own jornadas" on public.jornadas;
create policy "Users manage own jornadas" on public.jornadas
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own analises" on public.analises_geradas;
create policy "Users manage own analises" on public.analises_geradas
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users select own rate limit" on public.analise_rate_limit;
drop policy if exists "Users insert own rate limit" on public.analise_rate_limit;
create policy "Users select own rate limit" on public.analise_rate_limit
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own rate limit" on public.analise_rate_limit
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users manage own passes" on public.uber_passes;
create policy "Users manage own passes" on public.uber_passes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own lancamentos" on public.lancamentos;
create policy "Users manage own lancamentos" on public.lancamentos
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Funções: só usuários logados chamam as administrativas (elas conferem is_admin)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_update_user_plan(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user_plan(uuid, text, timestamptz) to authenticated;
