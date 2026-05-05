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

interface PayloadDia {
  periodo?: "dia";
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
  r_km_bom?: number;
  r_km_medio?: number;
  ticket_minimo?: number;
}

interface PayloadSemana {
  periodo: "semana";
  rotulo_periodo: string; // ex: "28/04 a 04/05"
  total_corridas: number;
  ganho_bruto: number;
  ganho_real: number;
  r_por_hora: number;
  r_por_km: number;
  km_total: number;
  horas: number;
  meta_semanal: number;
  percentual_meta: number;
  melhor_dia: { rotulo: string; valor: number };
  pior_dia: { rotulo: string; valor: number };
  hora_pico: string; // ex: "18h-20h"
  rkm_hora_pico: number;
  // comparativo
  semana_anterior: {
    corridas: number;
    ganho_real: number;
    r_por_hora: number;
    r_por_km: number;
  };
  projecao_semanal: number;
  r_km_bom?: number;
  r_km_medio?: number;
}

interface PayloadMes {
  periodo: "mes";
  rotulo_periodo: string; // "Abril 2026"
  total_corridas: number;
  ganho_bruto: number;
  ganho_real: number;
  r_por_hora: number;
  r_por_km: number;
  percentual_meta: number;
  meta_mensal: number;
  dias_trabalhados: number;
  top3_dias: Array<{ rotulo: string; valor: number }>;
  hora_pico: string;
  melhor_dia_semana: string; // ex: "Sexta"
  km_total: number;
  km_vazio_total: number;
  ganho_perdido_deslocamentos_longos: number;
  mes_anterior: {
    corridas: number;
    ganho_real: number;
    r_por_hora: number;
    r_por_km: number;
    dias_trabalhados: number;
  };
  r_km_bom?: number;
  r_km_medio?: number;
}

type Payload = PayloadDia | PayloadSemana | PayloadMes;

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildPromptDia(d: PayloadDia): string {
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
✅ Baseado na meta configurada de R$ ${fmt(rkmBom)}/km real, recomende o tipo de corrida ideal para atingir ou superar esta meta. Use este valor como referência — NÃO invente valores de R$/km.
⚠️ [comportamento específico a evitar — pode citar o piso de R$ ${fmt(rkmMedio)}/km como limite mínimo aceitável]

## PROJEÇÃO DO MÊS
Apenas números e projeção — não repetir análise do dia. 1 parágrafo com projeção realista e ação concreta necessária.

## DICA ESTRATÉGICA
1 dica NOVA não mencionada nas seções anteriores, específica e aplicável amanhã.

Máximo 380 palavras totais. Linguagem direta e motivadora.`;
}

function buildPromptSemana(d: PayloadSemana): string {
  return `Você é um analista de renda para motoristas Uber. Análise SEMANAL.

DADOS DA SEMANA (${d.rotulo_periodo}):
- Corridas: ${d.total_corridas} | Ganho real: R$ ${fmt(d.ganho_real)} | Ganho bruto: R$ ${fmt(d.ganho_bruto)}
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Horas: ${fmt(d.horas)}h | Km: ${fmt(d.km_total)}
- Meta semanal: R$ ${fmt(d.meta_semanal)} (${fmt(d.percentual_meta)}%)
- Melhor dia: ${d.melhor_dia.rotulo} (R$ ${fmt(d.melhor_dia.valor)}) | Pior dia: ${d.pior_dia.rotulo} (R$ ${fmt(d.pior_dia.valor)})
- Horário mais rentável: ${d.hora_pico} (R$ ${fmt(d.rkm_hora_pico)}/km real)
- Projeção se mantiver ritmo: R$ ${fmt(d.projecao_semanal)}

SEMANA ANTERIOR (comparativo):
- Corridas: ${d.semana_anterior.corridas} | Ganho real: R$ ${fmt(d.semana_anterior.ganho_real)} | R$/h: R$ ${fmt(d.semana_anterior.r_por_hora)} | R$/km: R$ ${fmt(d.semana_anterior.r_por_km)}

Gere 4 seções distintas (NÃO repita entre elas):

## RESUMO DO DIA
Resumo NARRATIVO da semana (2 parágrafos). Comece com "Nesta semana você realizou ${d.total_corridas} corridas com ganho real de R$ ${fmt(d.ganho_real)}." Cite o melhor dia, o horário pico e um padrão observado nos dados. Compare com a semana anterior (cresceu/caiu em qual métrica). Termine com insight motivacional.

## RECOMENDAÇÕES PARA AMANHÃ
Exatamente 4 itens para a PRÓXIMA SEMANA:
🕐 [horários específicos a priorizar — baseado em ${d.hora_pico}]
📍 [padrão de dia da semana a replicar — baseado em ${d.melhor_dia.rotulo}]
✅ [padrão a manter — baseado no que funcionou]
⚠️ [comportamento a evitar — baseado no pior dia ou métrica caída]

## PROJEÇÃO DO MÊS
1 parágrafo: projeção semanal R$ ${fmt(d.projecao_semanal)} e ação concreta. Não repita análise da semana.

## DICA ESTRATÉGICA
1 dica nova específica para próxima semana.

Máximo 380 palavras. Linguagem direta.`;
}

function buildPromptMes(d: PayloadMes): string {
  const top3 = d.top3_dias.map((t) => `${t.rotulo} (R$ ${fmt(t.valor)})`).join(", ");
  return `Você é um analista de renda para motoristas Uber. Análise MENSAL profunda.

DADOS DO MÊS (${d.rotulo_periodo}):
- Dias trabalhados: ${d.dias_trabalhados} | Corridas: ${d.total_corridas}
- Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)}
- Meta mensal: R$ ${fmt(d.meta_mensal)} (${fmt(d.percentual_meta)}%)
- R$/hora médio: R$ ${fmt(d.r_por_hora)} | R$/km médio: R$ ${fmt(d.r_por_km)}
- Km total: ${fmt(d.km_total)} (vazio: ${fmt(d.km_vazio_total)})
- Top 3 melhores dias: ${top3}
- Horário mais lucrativo: ${d.hora_pico}
- Dia da semana mais rentável: ${d.melhor_dia_semana}
- Estimativa de ganho perdido em deslocamentos longos (>5km): R$ ${fmt(d.ganho_perdido_deslocamentos_longos)}

MÊS ANTERIOR (comparativo):
- Corridas: ${d.mes_anterior.corridas} | Ganho real: R$ ${fmt(d.mes_anterior.ganho_real)} | R$/h: R$ ${fmt(d.mes_anterior.r_por_hora)} | R$/km: R$ ${fmt(d.mes_anterior.r_por_km)} | Dias trab.: ${d.mes_anterior.dias_trabalhados}

Gere 4 seções distintas (NÃO repita entre elas):

## RESUMO DO DIA
Análise NARRATIVA profunda do mês (2-3 parágrafos). Comece com "Em ${d.rotulo_periodo} você trabalhou ${d.dias_trabalhados} dias realizando ${d.total_corridas} corridas com ganho real total de R$ ${fmt(d.ganho_real)}, representando ${fmt(d.percentual_meta)}% da sua meta mensal." Cite os top 3 dias, o horário lucrativo, o dia da semana mais rentável e o impacto dos deslocamentos longos. Compare com mês anterior.

## RECOMENDAÇÕES PARA AMANHÃ
4 insights mensais (Descoberta do mês / Ponto de melhoria / Meta para próximo mês / Padrão a replicar):
🕐 Descoberta do mês — algo concreto descoberto nos dados
📍 Ponto de melhoria — ação concreta
✅ Meta sugerida para o próximo mês — baseada na progressão
⚠️ Padrão a evitar — algo que reduziu seu ganho

## PROJEÇÃO DO MÊS
1 parágrafo curto: o que esperar do próximo mês mantendo padrão atual + 1 ajuste recomendado.

## DICA ESTRATÉGICA
1 dica estratégica de longo prazo (não repetir o que já foi dito).

Máximo 450 palavras. Linguagem direta e analítica.`;
}

function buildPrompt(p: Payload): string {
  if ((p as any).periodo === "semana") return buildPromptSemana(p as PayloadSemana);
  if ((p as any).periodo === "mes") return buildPromptMes(p as PayloadMes);
  return buildPromptDia(p as PayloadDia);
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
        max_tokens: 900,
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
