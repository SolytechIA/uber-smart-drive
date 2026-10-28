import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createConfirmEmailHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const authOptions = { persistSession: false, autoRefreshToken: false };

Deno.serve(createConfirmEmailHandler({
  authenticate: async (token) => {
    const client = createClient(url, anonKey, { auth: authOptions });
    const { data, error } = await client.auth.getUser(token);
    return !error && Boolean(data.user);
  },
  authorizedTarget: async (token, userId) => {
    // Reuse the existing server-side administrator check with the caller's bearer.
    // Never use the privileged client for authorization.
    const client = createClient(url, anonKey, {
      auth: authOptions,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.rpc("admin_list_users");
    return !error && Array.isArray(data) && data.some((user: { id: string }) => user.id === userId);
  },
  confirmEmail: async (userId) => {
    const client = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: authOptions });
    const { data, error } = await client.auth.admin.updateUserById(userId, { email_confirm: true });
    return !error && Boolean(data.user?.email_confirmed_at);
  },
}, corsHeaders));