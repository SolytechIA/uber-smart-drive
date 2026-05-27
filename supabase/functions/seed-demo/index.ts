// Edge function: cria/recria a conta demo (demo@driveia.com / demo123)
// e popula com 65 dias de corridas realistas (01/03/2026 a 04/05/2026).
// Idempotente: pode ser chamada várias vezes — limpa rides anteriores antes de re-popular.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMO_EMAIL = "demo@driveia.com";
const DEMO_PASSWORD = "demo123";

const BAIRROS = [
  "Moinhos de Vento", "Bela Vista", "Petrópolis", "Centro", "Boa Vista",
  "Menino Deus", "Cristal", "Vila Nova", "Ipanema", "Cavalhada",
];

interface RideSeed {
  data: string;
  hora: number;
  minuto: number;
  duracao: number;
  valor: number;
  km_pax: number;
  km_desl: number;
  origem: string;
  destino: string;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }

function classify(valor: number, kmPax: number, kmDesl: number): string {
  const kmTotal = kmPax + kmDesl;
  const rkm = kmTotal > 0 ? valor / kmTotal : 0;
  if (rkm >= 1.8) return "BOA";
  if (rkm >= 1.3) return "MEDIA";
  return "RUIM";
}

// Gera corridas para um dia específico
function generateDay(dateStr: string, dayOfWeek: number): RideSeed[] {
  // dayOfWeek: 0=domingo,1=seg,...,6=sab
  let target: { count: number; brutoMin: number; brutoMax: number };
  let horarios: Array<[number, number]>; // janelas [hora_ini, hora_fim]

  if (dayOfWeek === 0) {
    // domingo
    target = { count: randInt(6, 10), brutoMin: 110, brutoMax: 160 };
    horarios = [[9, 13], [17, 22]];
  } else if (dayOfWeek === 5 || dayOfWeek === 6) {
    // sex/sab — bom
    target = { count: randInt(18, 22), brutoMin: 380, brutoMax: 480 };
    horarios = [[6, 9], [11, 13], [17, 20], [22, 24]];
  } else if (dayOfWeek === 1 || dayOfWeek === 2) {
    // seg/ter — ruim de manhã
    target = { count: randInt(8, 11), brutoMin: 140, brutoMax: 190 };
    horarios = [[6, 10], [11, 13], [17, 19]];
  } else {
    // qua/qui — normal
    target = { count: randInt(12, 16), brutoMin: 220, brutoMax: 320 };
    horarios = [[6, 9], [11, 13], [17, 20]];
  }

  const totalBruto = rand(target.brutoMin, target.brutoMax);
  const corridas: RideSeed[] = [];

  // Distribui corridas pelas janelas
  const slots: Array<{ h: number; m: number }> = [];
  for (let i = 0; i < target.count; i++) {
    const janela = horarios[i % horarios.length];
    const h = randInt(janela[0], Math.min(janela[1] - 1, 23));
    const m = randInt(0, 59);
    slots.push({ h, m });
  }
  slots.sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));

  // Valor médio por corrida; algumas variações (15% ruins, 25% médias, 60% boas)
  const valorMedio = totalBruto / target.count;

  for (let i = 0; i < target.count; i++) {
    const slot = slots[i];
    const r = Math.random();
    let kmPax: number, kmDesl: number, valor: number;

    if (r < 0.6) {
      // BOA — bom R$/km
      kmPax = rand(2.5, 8);
      kmDesl = rand(0.2, 1.2);
      const rkm = rand(2.0, 3.5);
      valor = (kmPax + kmDesl) * rkm;
    } else if (r < 0.85) {
      // MEDIA
      kmPax = rand(3, 10);
      kmDesl = rand(1, 2.5);
      const rkm = rand(1.4, 1.9);
      valor = (kmPax + kmDesl) * rkm;
    } else {
      // RUIM — deslocamento longo ou valor baixo
      if (Math.random() < 0.5) {
        kmPax = rand(2, 5);
        kmDesl = rand(3, 6); // muito vazio
        const rkm = rand(0.8, 1.2);
        valor = (kmPax + kmDesl) * rkm;
      } else {
        kmPax = rand(1, 2.5);
        kmDesl = rand(0.5, 2);
        valor = rand(6, 10); // valor muito baixo
      }
    }

    // Ajuste para chegar perto do total bruto alvo (proporção)
    const fator = valorMedio / Math.max(valor, 1);
    if (fator > 0.5 && fator < 2) valor *= rand(0.85, 1.15) * (fator * 0.4 + 0.6);

    valor = Math.round(valor * 100) / 100;
    kmPax = Math.round(kmPax * 10) / 10;
    kmDesl = Math.round(kmDesl * 10) / 10;
    const duracao = Math.max(5, Math.round(kmPax * rand(2.2, 3.5)));

    corridas.push({
      data: dateStr,
      hora: slot.h,
      minuto: slot.m,
      duracao,
      valor,
      km_pax: kmPax,
      km_desl: kmDesl,
      origem: pick(BAIRROS),
      destino: pick(BAIRROS),
    });
  }

  return corridas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Shared-secret guard: prevents anonymous abuse of this destructive admin endpoint.
    const seedSecret = Deno.env.get("SEED_SECRET");
    if (!seedSecret || req.headers.get("Authorization") !== `Bearer ${seedSecret}`) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Cria ou obtém usuário demo
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      userId = existing.id;
      // reseta senha
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: "João Silva", telefone: "51999990000", cidade: "Porto Alegre" },
      });
      if (cErr) throw cErr;
      userId = created.user!.id;
    }

    // 2) Garante linha em public.users com plano pro (sem expirar)
    await admin.from("users").upsert({
      id: userId,
      email: DEMO_EMAIL,
      nome: "João Silva",
      telefone: "51999990000",
      cidade: "Porto Alegre",
      plano: "pro",
      trial_expira_em: null,
      ativo: true,
      aceite_privacidade: true,
      aceite_privacidade_em: new Date().toISOString(),
    }, { onConflict: "id" });

    // 3) Veículo
    await admin.from("vehicles").delete().eq("user_id", userId);
    await admin.from("vehicles").insert({
      user_id: userId,
      marca: "Hyundai",
      modelo: "HB20",
      ano: 2022,
      placa: "ABC1D23",
      tipo_posse: "proprio_quitado",
      combustivel: "flex",
      consumo_km_litro: 12,
      preco_combustivel: 6.20,
      preco_gasolina: 6.20,
      consumo_gasolina: 12,
      capacidade_tanque: 50,
      custo_ipva_mensal: 85,
      custo_seguro_mensal: 180,
      custo_manutencao_mensal: 120,
      custo_lavagem_mensal: 80,
      taxa_uber_percent: 25,
      dias_trabalhados_mes: 22,
    });

    // 4) Metas
    await admin.from("goals").delete().eq("user_id", userId);
    await admin.from("goals").insert({
      user_id: userId,
      meta_diaria: 280,
      meta_semanal: 1400,
      meta_mensal: 6160,
      horas_meta_dia: 10,
      r_km_bom: 1.8,
      r_km_medio: 1.3,
      r_por_km_minimo: 1.8,
      valor_minimo_corrida: 8,
      km_max_deslocamento: 4,
      km_vazio_max_percent: 20,
    });

    // 5) Limpa corridas e gera 65 dias (01/03/2026 a 04/05/2026)
    await admin.from("rides").delete().eq("user_id", userId);

    const start = new Date("2026-03-01T12:00:00");
    const end = new Date("2026-05-04T12:00:00");
    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Escolhe 4 dias de folga aleatórios por mês (3 meses parciais)
    const folgaSet = new Set<string>();
    const mesesAlvo = [["2026-03", 31], ["2026-04", 30], ["2026-05", 4]] as const;
    for (const [ym, dias] of mesesAlvo) {
      const folgasMes = ym === "2026-05" ? 0 : 4;
      for (let i = 0; i < folgasMes; i++) {
        const d = randInt(1, Number(dias));
        folgaSet.add(`${ym}-${pad2(d)}`);
      }
    }

    const allRides: any[] = [];
    const consumoKmL = 12;
    const precoComb = 6.20;
    const custoFixoMensal = 85 + 180 + 120 + 80; // 465
    const diasTrabMes = 22;
    const custoFixoDia = custoFixoMensal / diasTrabMes;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      if (folgaSet.has(dateStr)) continue;

      const dow = d.getDay();
      const corridas = generateDay(dateStr, dow);
      for (const c of corridas) {
        const kmTotal = c.km_pax + c.km_desl;
        const custoComb = (kmTotal / consumoKmL) * precoComb;
        const ganhoReal = c.valor - custoComb; // sem custo fixo por corrida (esse é diluído)
        const rkmReal = kmTotal > 0 ? ganhoReal / kmTotal : 0;
        const inicio = new Date(`${dateStr}T${pad2(c.hora)}:${pad2(c.minuto)}:00-03:00`);
        const fim = new Date(inicio.getTime() + c.duracao * 60_000);
        allRides.push({
          user_id: userId,
          plataforma: "Uber",
          data_corrida: dateStr,
          horario_inicio: inicio.toISOString(),
          horario_fim: fim.toISOString(),
          duracao_minutos: c.duracao,
          valor_bruto: c.valor,
          valor_liquido: c.valor,
          km_passageiro: c.km_pax,
          km_deslocamento: c.km_desl,
          km_total: Math.round(kmTotal * 10) / 10,
          bairro_origem: c.origem,
          bairro_destino: c.destino,
          classificacao: classify(c.valor, c.km_pax, c.km_desl),
          custo_combustivel_corrida: Math.round(custoComb * 100) / 100,
          ganho_real_corrida: Math.round(ganhoReal * 100) / 100,
          r_por_km_real: Math.round(rkmReal * 100) / 100,
          origem: "manual",
        });
      }
    }

    // Insere em batches de 500
    let inserted = 0;
    for (let i = 0; i < allRides.length; i += 500) {
      const chunk = allRides.slice(i, i + 500);
      const { error } = await admin.from("rides").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        user_id: userId,
        rides_inserted: inserted,
        days_covered: totalDays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("seed-demo error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
