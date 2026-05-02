import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  user_email?: string;
  action?: "activate_pro" | "cancel_pro";
  mp_subscription_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("WEBHOOK_SECRET");
    if (!secret) {
      return json({ error: "WEBHOOK_SECRET not configured" }, 500);
    }
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = (await req.json()) as Payload;
    if (!body.user_email || !body.action) {
      return json({ error: "user_email and action are required" }, 400);
    }
    if (!["activate_pro", "cancel_pro"].includes(body.action)) {
      return json({ error: "invalid action" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const update: Record<string, unknown> =
      body.action === "activate_pro"
        ? {
            plano: "pro",
            trial_expira_em: null,
            mp_subscription_id: body.mp_subscription_id ?? null,
          }
        : {
            plano: "trial",
            trial_expira_em: new Date(
              Date.now() + 3 * 24 * 60 * 60 * 1000
            ).toISOString(),
          };

    const { data, error } = await supabase
      .from("users")
      .update(update)
      .eq("email", body.user_email)
      .select("id");

    if (error) return json({ error: error.message }, 500);
    if (!data || data.length === 0)
      return json({ error: "user not found" }, 404);

    return json({ success: true, updated: data.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
