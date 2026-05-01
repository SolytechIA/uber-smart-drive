const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RideRef {
  valor: number;
  km: number;
  origem: string;
  destino: string;
}

interface Payload {
  total_corridas: number;
  ganho_bruto: number;
  custo_total: number;
  ganho_real: number;
  meta_diaria: number;
  percentual_meta: number;
  km_total: number;
  km_deslocamento_total: number;
  horas: number;
  r_por_hora: number;
  r_por_km: number;
  ticket_medio: number;
  n_boas: number;
  n_medias: number;
  n_ruins: number;
  hora_inicio: string;
  hora_fim: string;
  data_hoje: string;
  corrida_melhor: RideRef;
  corrida_pior: RideRef;
  projecao_mensal: number;
  meta_mensal: number;
  dias_restantes_mes: number;
  valor_faltante_meta: number;
  valor_necessario_por_dia: number;
  // Metas configuradas pelo motorista
  r_km_bom?: number;
  r_km_medio?: number;
  ticket_minimo?: number;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildPrompt(d: Payload): string {
  const rkmBom = Number(d.r_km_bom || 0);
  const rkmMedio = Number(d.r_km_medio || 0);
  const ticketMin = Number(d.ticket_minimo || 0);
  return `Você é um analista especializado em renda para motoristas de aplicativo no Brasil. Com base nos dados abaixo, gere uma análise CONCISA e SEM REPETIÇÕES entre as seções.

DADOS:
- Data: ${d.data_hoje}
- Corridas: ${d.total_corridas} (BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins})
- Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Custo: R$ ${fmt(d.custo_total)} | Ganho real: R$ ${fmt(d.ganho_real)}
- Meta diária: R$ ${fmt(d.meta_diaria)} (${fmt(d.percentual_meta)}% atingida)
- Km total: ${fmt(d.km_total)} (vazio: ${fmt(d.km_deslocamento_total)}) | Horas: ${fmt(d.horas)}h
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km real: R$ ${fmt(d.r_por_km)} | Ticket médio: R$ ${fmt(d.ticket_medio)}
- Meta R$/km configurada (corrida BOA): R$ ${fmt(rkmBom)}
- Meta R$/km mínimo (corrida MÉDIA): R$ ${fmt(rkmMedio)}
${ticketMin > 0 ? `- Ticket mínimo configurado: R$ ${fmt(ticketMin)}\n` : ""}- Janela: ${d.hora_inicio} → ${d.hora_fim}
- Melhor: R$ ${fmt(d.corrida_melhor.valor)} (${d.corrida_melhor.origem}→${d.corrida_melhor.destino}) | Pior: R$ ${fmt(d.corrida_pior.valor)} (${d.corrida_pior.origem}→${d.corrida_pior.destino})
- Mês: realizado R$ ${fmt(d.ganho_real)} de meta R$ ${fmt(d.meta_mensal)} | projeção R$ ${fmt(d.projecao_mensal)} | falta R$ ${fmt(d.valor_faltante_meta)} em ${d.dias_restantes_mes} dia(s) (R$ ${fmt(d.valor_necessario_por_dia)}/dia)

Gere 4 seções distintas e complementares (NÃO repita informações entre elas):

## RESUMO DO DIA
2 parágrafos: desempenho geral e ponto mais relevante do dia. Inclua obrigatoriamente um insight motivacional genuíno adequado ao resultado, que motive o motorista a continuar ou melhorar.

## RECOMENDAÇÕES PARA AMANHÃ
Exatamente 4 tópicos DIFERENTES entre si (sem repetir recomendações entre os 4 itens):
🕐 [horários específicos baseados nos dados]
📍 [regiões/bairros baseados nos dados]
✅ [critério de corrida a aceitar com valor/km específico]
⚠️ [comportamento específico a evitar]

## PROJEÇÃO DO MÊS
Apenas números e projeção — não repetir análise do dia. 1 parágrafo com projeção realista e ação concreta necessária.

## DICA ESTRATÉGICA
1 dica NOVA não mencionada nas seções anteriores, específica e aplicável amanhã.

Máximo 380 palavras totais. Linguagem direta e motivadora.`;
}

function splitSections(text: string) {
  const sections = {
    resumo_dia: "",
    recomendacoes: "",
    projecao_mes: "",
    dica_estrategica: "",
  };

  const patterns: Array<[keyof typeof sections, RegExp]> = [
    ["resumo_dia", /##\s*RESUMO DO DIA\s*([\s\S]*?)(?=##\s*RECOMENDAÇÕES|##\s*RECOMENDACOES|$)/i],
    ["recomendacoes", /##\s*RECOMENDA[ÇC][ÕO]ES PARA AMANH[ÃA]\s*([\s\S]*?)(?=##\s*PROJE[ÇC][ÃA]O|$)/i],
    ["projecao_mes", /##\s*PROJE[ÇC][ÃA]O DO M[ÊE]S\s*([\s\S]*?)(?=##\s*DICA|$)/i],
    ["dica_estrategica", /##\s*DICA ESTRAT[ÉE]GICA(?:\s+DO DIA)?\s*([\s\S]*?)$/i],
  ];

  for (const [key, re] of patterns) {
    const m = text.match(re);
    if (m && m[1]) sections[key] = m[1].trim();
  }
  return sections;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = (await req.json()) as Payload;
    const prompt = buildPrompt(payload);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error:", groqRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Falha ao chamar Groq", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await groqRes.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = splitSections(content);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("groq-analysis error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
