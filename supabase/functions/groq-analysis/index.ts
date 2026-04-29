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
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildPrompt(d: Payload): string {
  return `Você é um analista especializado em otimização de renda para motoristas de aplicativo no Brasil. Analise os dados abaixo e gere uma análise personalizada, direta e útil em português brasileiro.

DADOS DO DIA:
- Data: ${d.data_hoje}
- Corridas realizadas: ${d.total_corridas}
- Ganho bruto total: R$ ${fmt(d.ganho_bruto)}
- Custo total (combustível + fixo proporcional): R$ ${fmt(d.custo_total)}
- Ganho real (bruto - custos): R$ ${fmt(d.ganho_real)}
- Meta diária configurada: R$ ${fmt(d.meta_diaria)}
- Percentual da meta atingido: ${fmt(d.percentual_meta)}%
- Km total rodado (com e sem passageiro): ${fmt(d.km_total)}
- Km rodado vazio (deslocamento): ${fmt(d.km_deslocamento_total)}
- Horas ao volante: ${fmt(d.horas)}h
- R$/hora do dia: R$ ${fmt(d.r_por_hora)}
- R$/km do dia: R$ ${fmt(d.r_por_km)}
- Ticket médio por corrida: R$ ${fmt(d.ticket_medio)}
- Corridas BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins}
- Horário da primeira corrida: ${d.hora_inicio}
- Horário da última corrida: ${d.hora_fim}
- Corrida mais rentável: R$ ${fmt(d.corrida_melhor.valor)} (${fmt(d.corrida_melhor.km)}km, ${d.corrida_melhor.origem}→${d.corrida_melhor.destino})
- Corrida menos rentável: R$ ${fmt(d.corrida_pior.valor)} (${fmt(d.corrida_pior.km)}km, ${d.corrida_pior.origem}→${d.corrida_pior.destino})
- Projeção de fechamento do mês: R$ ${fmt(d.projecao_mensal)}
- Meta mensal: R$ ${fmt(d.meta_mensal)}
- Dias restantes no mês: ${d.dias_restantes_mes}
- Valor faltante para meta mensal: R$ ${fmt(d.valor_faltante_meta)}
- Valor necessário por dia para atingir meta: R$ ${fmt(d.valor_necessario_por_dia)}

Gere exatamente 4 seções com os títulos abaixo:

## RESUMO DO DIA
(2-3 parágrafos narrativos com análise do desempenho, pontos positivos e o que pode melhorar. Use os dados reais.)

## RECOMENDAÇÕES PARA AMANHÃ
(4 itens obrigatórios em tópicos)
🕐 Melhores horários para trabalhar
📍 Regiões/bairros a priorizar
✅ Tipo de corrida para aceitar
⚠️ O que evitar

## PROJEÇÃO DO MÊS
(Análise da projeção mensal comparando com a meta, o que precisa fazer nos dias restantes)

## DICA ESTRATÉGICA DO DIA
(Uma dica prática e específica que o motorista pode aplicar amanhã imediatamente, baseada nos dados)

Seja direto, use linguagem simples e motivadora. Máximo 500 palavras no total.`;
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
    ["dica_estrategica", /##\s*DICA ESTRAT[ÉE]GICA DO DIA\s*([\s\S]*?)$/i],
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
