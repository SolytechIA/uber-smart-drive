// Edge function: cria/recria a conta demo2 (demo2@driveia.com / demo456)
// Carlos Souza, motorista experiente em Porto Alegre/RS.
// Histórico desde 01/01/2026 até 04/05/2026 com curva de evolução por mês.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMO_EMAIL = "demo2@driveia.com";
const DEMO_PASSWORD = "demo456";

const BAIRROS = [
  "Moinhos de Vento", "Petrópolis", "Boa Vista", "Centro", "Bela Vista",
  "Menino Deus", "Cristal", "Vila Nova", "Ipanema",
];

const CONSUMO = 13;
const PRECO = 6.20;

interface RideSeed {
  data: string; hora: number; minuto: number; duracao: number;
  valor: number; km_pax: number; km_desl: number; origem: string; destino: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

function classify(valor: number, kmPax: number, kmDesl: number): string {
  const km = kmPax + kmDesl;
  const rkm = km > 0 ? valor / km : 0;
  if (rkm >= 1.9) return "BOA";
  if (rkm >= 1.4) return "MEDIA";
  return "RUIM";
}

interface MonthProfile {
  countMin: number; countMax: number;       // corridas por dia útil
  pBoa: number; pMedia: number;              // distribuição
  weekendBoost: number;                      // multiplicador sex/sab corridas
}

// Janelas de horário rentáveis por dia da semana
function janelas(dow: number): Array<[number, number]> {
  if (dow === 0) return [[9, 13], [17, 22]];                              // dom
  if (dow === 5 || dow === 6) return [[6, 9], [11, 13], [17, 20], [22, 24]]; // sex/sab
  if (dow === 1 || dow === 2) return [[6, 10], [11, 13], [17, 19]];       // seg/ter
  return [[6, 9], [11, 13], [17, 20]];                                    // qua/qui
}

function generateRide(p: MonthProfile, dateStr: string, slot: { h: number; m: number }): RideSeed {
  const r = Math.random();
  let kmPax: number, kmDesl: number, valor: number;
  if (r < p.pBoa) {
    kmPax = rand(2.5, 8); kmDesl = rand(0.2, 1.0);
    valor = (kmPax + kmDesl) * rand(2.1, 3.4);
  } else if (r < p.pBoa + p.pMedia) {
    kmPax = rand(3, 9); kmDesl = rand(0.8, 2.2);
    valor = (kmPax + kmDesl) * rand(1.5, 1.9);
  } else {
    if (Math.random() < 0.5) {
      kmPax = rand(2, 5); kmDesl = rand(3, 6);
      valor = (kmPax + kmDesl) * rand(0.9, 1.3);
    } else {
      kmPax = rand(1, 2.5); kmDesl = rand(0.5, 2);
      valor = rand(7, 11);
    }
  }
  valor = Math.round(valor * 100) / 100;
  kmPax = Math.round(kmPax * 10) / 10;
  kmDesl = Math.round(kmDesl * 10) / 10;
  const duracao = Math.max(5, Math.round(kmPax * rand(2.2, 3.5)));
  return {
    data: dateStr, hora: slot.h, minuto: slot.m, duracao,
    valor, km_pax: kmPax, km_desl: kmDesl,
    origem: pick(BAIRROS), destino: pick(BAIRROS),
  };
}

function generateDay(dateStr: string, dow: number, p: MonthProfile): RideSeed[] {
  let count = randInt(p.countMin, p.countMax);
  if (dow === 5 || dow === 6) count = Math.round(count * p.weekendBoost);
  if (dow === 0) count = Math.max(6, Math.round(count * 0.7));
  const wins = janelas(dow);
  const slots: Array<{ h: number; m: number }> = [];
  for (let i = 0; i < count; i++) {
    const j = wins[i % wins.length];
    slots.push({ h: randInt(j[0], Math.min(j[1] - 1, 23)), m: randInt(0, 59) });
  }
  slots.sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  return slots.map((s) => generateRide(p, dateStr, s));
}

// Perfis por mês conforme spec
const PROFILES: Record<string, { profile: MonthProfile; folgas: number; daysToProcess?: number }> = {
  "2026-01": { profile: { countMin: 10, countMax: 13, pBoa: 0.45, pMedia: 0.30, weekendBoost: 1.4 }, folgas: 13 }, // 31 - 18 = 13
  "2026-02": { profile: { countMin: 12, countMax: 15, pBoa: 0.55, pMedia: 0.28, weekendBoost: 1.5 }, folgas: 8 },  // 28 - 20 = 8
  "2026-03": { profile: { countMin: 14, countMax: 18, pBoa: 0.62, pMedia: 0.26, weekendBoost: 1.5 }, folgas: 8 },  // 31 - 23 = 8
  "2026-04": { profile: { countMin: 15, countMax: 20, pBoa: 0.65, pMedia: 0.25, weekendBoost: 1.5 }, folgas: 6 },  // 30 - 24 = 6
  "2026-05": { profile: { countMin: 13, countMax: 16, pBoa: 0.60, pMedia: 0.25, weekendBoost: 1.5 }, folgas: 0, daysToProcess: 4 },
};

const DIAS_NO_MES: Record<string, number> = {
  "2026-01": 31, "2026-02": 28, "2026-03": 31, "2026-04": 30, "2026-05": 4,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Shared-secret guard.
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

    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { nome: "Carlos Souza", telefone: "51988887777", cidade: "Porto Alegre" },
      });
      if (error) throw error;
      userId = created.user!.id;
    }

    await admin.from("users").upsert({
      id: userId, email: DEMO_EMAIL, nome: "Carlos Souza",
      telefone: "51988887777", cidade: "Porto Alegre",
      plano: "pro", trial_expira_em: null, ativo: true,
      aceite_privacidade: true, aceite_privacidade_em: new Date().toISOString(),
    }, { onConflict: "id" });

    await admin.from("vehicles").delete().eq("user_id", userId);
    await admin.from("vehicles").insert({
      user_id: userId, marca: "Volkswagen", modelo: "Polo", ano: 2021, placa: "DEF2G34",
      tipo_posse: "proprio_quitado", combustivel: "flex",
      consumo_km_litro: CONSUMO, preco_combustivel: PRECO,
      preco_gasolina: PRECO, consumo_gasolina: CONSUMO, capacidade_tanque: 50,
      custo_ipva_mensal: 95, custo_seguro_mensal: 165,
      custo_manutencao_mensal: 100, custo_lavagem_mensal: 90,
      taxa_uber_percent: 25, dias_trabalhados_mes: 22,
    });

    await admin.from("goals").delete().eq("user_id", userId);
    await admin.from("goals").insert({
      user_id: userId,
      meta_diaria: 280, meta_semanal: 1400, meta_mensal: 6160,
      horas_meta_dia: 10, r_km_bom: 1.9, r_km_medio: 1.4,
      r_por_km_minimo: 1.9, valor_minimo_corrida: 9,
      km_max_deslocamento: 4, km_vazio_max_percent: 20,
    });

    await admin.from("rides").delete().eq("user_id", userId);

    // Gera folgas aleatórias por mês
    const folgaSet = new Set<string>();
    for (const ym of Object.keys(PROFILES)) {
      const cfg = PROFILES[ym];
      const dias = DIAS_NO_MES[ym];
      for (let i = 0; i < cfg.folgas; i++) {
        folgaSet.add(`${ym}-${pad2(randInt(1, dias))}`);
      }
    }

    const allRides: any[] = [];
    for (const ym of Object.keys(PROFILES)) {
      const cfg = PROFILES[ym];
      const dias = cfg.daysToProcess ?? DIAS_NO_MES[ym];
      const [yyyy, mm] = ym.split("-").map(Number);
      for (let day = 1; day <= dias; day++) {
        const dateStr = `${ym}-${pad2(day)}`;
        if (folgaSet.has(dateStr)) continue;
        const d = new Date(`${dateStr}T12:00:00`);
        const dow = d.getDay();
        const corridas = generateDay(dateStr, dow, cfg.profile);
        for (const c of corridas) {
          const kmTotal = c.km_pax + c.km_desl;
          const custoComb = (kmTotal / CONSUMO) * PRECO;
          const ganhoReal = c.valor - custoComb;
          const rkmReal = kmTotal > 0 ? ganhoReal / kmTotal : 0;
          const inicio = new Date(`${dateStr}T${pad2(c.hora)}:${pad2(c.minuto)}:00-03:00`);
          const fim = new Date(inicio.getTime() + c.duracao * 60_000);
          allRides.push({
            user_id: userId, plataforma: "Uber", data_corrida: dateStr,
            horario_inicio: inicio.toISOString(), horario_fim: fim.toISOString(),
            duracao_minutos: c.duracao,
            valor_bruto: c.valor, valor_liquido: c.valor,
            km_passageiro: c.km_pax, km_deslocamento: c.km_desl,
            km_total: Math.round(kmTotal * 10) / 10,
            bairro_origem: c.origem, bairro_destino: c.destino,
            classificacao: classify(c.valor, c.km_pax, c.km_desl),
            custo_combustivel_corrida: Math.round(custoComb * 100) / 100,
            ganho_real_corrida: Math.round(ganhoReal * 100) / 100,
            r_por_km_real: Math.round(rkmReal * 100) / 100,
            origem: "manual",
          });
        }
      }
    }

    let inserted = 0;
    for (let i = 0; i < allRides.length; i += 500) {
      const chunk = allRides.slice(i, i + 500);
      const { error } = await admin.from("rides").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }

    return new Response(JSON.stringify({
      ok: true, email: DEMO_EMAIL,
      user_id: userId, rides_inserted: inserted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seed-demo2 error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
