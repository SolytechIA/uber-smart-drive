
-- Bug 5A: tipo_posse constraint precisa aceitar os 4 valores da UI
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_tipo_posse_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_tipo_posse_check
  CHECK (tipo_posse IS NULL OR tipo_posse = ANY (ARRAY[
    'proprio_quitado'::text,
    'financiado'::text,
    'alugado_diaria'::text,
    'alugado_semana'::text
  ]));

-- Migra valores antigos (se houver)
UPDATE public.vehicles SET tipo_posse = 'proprio_quitado' WHERE tipo_posse = 'proprio';
UPDATE public.vehicles SET tipo_posse = 'alugado_diaria' WHERE tipo_posse = 'diaria';
UPDATE public.vehicles SET tipo_posse = 'alugado_semana' WHERE tipo_posse IN ('semanal','alugado_semanal');

-- Bug 5B/C: novas colunas para combustíveis Flex e GNV (reserva)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS preco_gasolina numeric,
  ADD COLUMN IF NOT EXISTS preco_alcool numeric,
  ADD COLUMN IF NOT EXISTS consumo_gasolina numeric,
  ADD COLUMN IF NOT EXISTS consumo_alcool numeric,
  ADD COLUMN IF NOT EXISTS preco_gasolina_reserva numeric,
  ADD COLUMN IF NOT EXISTS consumo_gasolina_reserva numeric;

-- Bug 2: parâmetros de classificação por R$/km
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS r_km_bom numeric,
  ADD COLUMN IF NOT EXISTS r_km_medio numeric;

-- Defaults a partir do r_por_km_minimo existente
UPDATE public.goals SET r_km_bom = COALESCE(r_km_bom, r_por_km_minimo, 1.8) WHERE r_km_bom IS NULL;
UPDATE public.goals SET r_km_medio = COALESCE(r_km_medio, GREATEST(r_por_km_minimo - 0.5, r_por_km_minimo * 0.7), 1.3) WHERE r_km_medio IS NULL;
