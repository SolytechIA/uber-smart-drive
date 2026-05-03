// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RideInput {
  data_corrida: string;
  horario_inicio: string;
  horario_fim?: string;
  origem_rua?: string;
  origem_bairro?: string;
  destino_rua?: string;
  destino_bairro?: string;
  km_passageiro: number;
  km_deslocamento: number;
  valor_bruto: number;
  duracao_minutos?: number;
}

function calcCustoCombustivel(v: any, kmTotal: number): number {
  if (!v || !kmTotal) return 0;
  const tipo = (v.combustivel || "").toLowerCase();
  if (tipo === "eletrico" || tipo === "elétrico") {
    const cons = Number(v.consumo_km_kwh) || 0;
    const preco = Number(v.preco_kwh) || 0;
    return cons > 0 ? (kmTotal / cons) * preco : 0;
  }
  if (tipo === "gnv") {
    const cons = Number(v.consumo_km_litro) || 0;
    const preco = Number(v.preco_combustivel) || 0;
    return cons > 0 ? (kmTotal / cons) * preco : 0;
  }
  // flex/gasolina/álcool
  const cons = Number(v.consumo_gasolina) || Number(v.consumo_km_litro) || 0;
  const preco = Number(v.preco_gasolina) || Number(v.preco_combustivel) || 0;
  return cons > 0 ? (kmTotal / cons) * preco : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization") || "";
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { user_email?: string; rides?: RideInput[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.user_email || !Array.isArray(body.rides)) {
    return new Response(JSON.stringify({ error: "missing user_email or rides" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", body.user_email)
    .maybeSingle();

  if (userErr || !userRow) {
    return new Response(JSON.stringify({ error: "user not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userRow.id;

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of body.rides) {
    try {
      const { data: existing } = await supabase
        .from("rides")
        .select("id")
        .eq("user_id", userId)
        .eq("data_corrida", r.data_corrida)
        .eq("horario_inicio", r.horario_inicio)
        .eq("valor_bruto", r.valor_bruto)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const kmPax = Number(r.km_passageiro) || 0;
      const kmDesl = Number(r.km_deslocamento) || 0;
      const kmTotal = kmPax + kmDesl;
      const custoComb = calcCustoCombustivel(vehicle, kmTotal);
      const ganhoReal = (Number(r.valor_bruto) || 0) - custoComb;
      const rPorKmReal = kmPax > 0 ? ganhoReal / kmPax : 0;

      const { error: insErr } = await supabase.from("rides").insert({
        user_id: userId,
        data_corrida: r.data_corrida,
        horario_inicio: r.horario_inicio,
        horario_fim: r.horario_fim ?? null,
        rua_origem: r.origem_rua ?? null,
        bairro_origem: r.origem_bairro ?? null,
        rua_destino: r.destino_rua ?? null,
        bairro_destino: r.destino_bairro ?? null,
        km_passageiro: kmPax,
        km_deslocamento: kmDesl,
        km_total: kmTotal,
        valor_bruto: r.valor_bruto,
        duracao_minutos: r.duracao_minutos ?? null,
        custo_combustivel_corrida: custoComb,
        ganho_real_corrida: ganhoReal,
        r_por_km_real: rPorKmReal,
        plataforma: "Uber",
        origem: "uber_sync",
      });

      if (insErr) {
        errors.push(insErr.message);
      } else {
        inserted++;
      }
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  await supabase
    .from("uber_connections")
    .update({ ultima_sincronizacao: new Date().toISOString() })
    .eq("user_id", userId);

  return new Response(JSON.stringify({ inserted, skipped, errors }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
