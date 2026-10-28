interface Dependencies {
  authenticate: (token: string) => Promise<boolean>;
  authorizedTarget: (token: string, userId: string) => Promise<boolean>;
  confirmEmail: (userId: string) => Promise<boolean>;
}

export function createConfirmEmailHandler(deps: Dependencies, corsHeaders: Record<string, string>) {
  return async (req: Request): Promise<Response> => {
    const reply = (status: number, body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return reply(405, { error: "Método não permitido." });
    const token = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return reply(401, { error: "Faça login para continuar." });
    try {
      if (!(await deps.authenticate(token))) return reply(401, { error: "Sessão inválida. Entre novamente." });
      const body: unknown = await req.json().catch(() => null);
      const userId = body && typeof body === "object" && "user_id" in body ? body.user_id : undefined;
      if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return reply(400, { error: "Usuário inválido." });
      }
      if (!(await deps.authorizedTarget(token, userId))) return reply(403, { error: "Ação permitida somente a administradores para usuários cadastrados." });
      if (!(await deps.confirmEmail(userId))) return reply(500, { error: "Não foi possível confirmar o email. Tente novamente." });
      return reply(200, { success: true, user_id: userId });
    } catch {
      return reply(500, { error: "Não foi possível confirmar o email. Tente novamente." });
    }
  };
}