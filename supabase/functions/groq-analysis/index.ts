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

interface BlocoComportamental {
  titulo: string;
  descricao: string;
  impacto_rs: number;
}

interface AnalisePersonalizada {
  eliminar: BlocoComportamental;
  manter: BlocoComportamental;
  melhorar: BlocoComportamental;
}

interface ContextoBase {
  contexto_temporal?: string;
  periodo_referencia?: string;
  periodo_atual?: string;
  dias_com_corridas?: number;
  analise_personalizada?: AnalisePersonalizada;
}

interface PayloadDia extends ContextoBase {
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

interface PayloadSemana extends ContextoBase {
  periodo: "semana";
  rotulo_periodo: string;
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
  hora_pico: string;
  rkm_hora_pico: number;
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

interface PayloadMes extends ContextoBase {
  periodo: "mes";
  rotulo_periodo: string;
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
  melhor_dia_semana: string;
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

const REGRAS_GERAIS = `REGRAS GERAIS OBRIGATÓRIAS (Drive IA — copiloto financeiro do motorista):
- Tom analítico mas acessível, sem jargões financeiros complexos.
- Motivador sem ser falso: NÃO elogie quando o desempenho foi ruim. Reconheça realisticamente.
- Específico: SEMPRE com valores em R$, horários e dias concretos extraídos dos dados.
- Orientado a ação: cada análise termina com UMA ação para amanhã.
- NUNCA sugira outras plataformas, apps concorrentes (99, inDriver, delivery) ou mudança de profissão.
- NUNCA repita as mesmas recomendações genéricas; use os dados reais do payload.
- NUNCA use alarmismo ("queda drástica", "preocupante", "muito abaixo").`;

function instrucaoContextoMes(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "mes_passado") {
    return `CONTEXTO TEMPORAL: Você está analisando ${periodo_ref} como um mês JÁ CONCLUÍDO. O mês atual é ${periodo_atual}.
Analise os dados em retrospectiva: o que funcionou, o que não funcionou, padrões identificados.
Use linguagem de PASSADO ao falar de ${periodo_ref} ("você fez", "rendeu", "funcionou").
Ao final, extraia 2-3 LIÇÕES CONCRETAS que o motorista deve aplicar AGORA em ${periodo_atual}.
Use linguagem de presente/futuro nas recomendações ("aplique", "esta semana", "amanhã").`;
  }
  if (ctx === "mes_atual_iniciante") {
    return `CONTEXTO TEMPORAL: O motorista está NO INÍCIO de ${periodo_atual} com apenas ${dias} dias registrados.
NÃO compare negativamente com o mês anterior — não há base estatística.
Foque em: qual é o ritmo atual, se vai atingir a meta nesse ritmo, e 2 ações concretas para acelerar nesta semana.
Tom: encorajador e prospectivo.`;
  }
  if (ctx === "mes_atual_andamento") {
    return `CONTEXTO TEMPORAL: ${periodo_atual} está EM ANDAMENTO com ${dias} dias registrados.
Combine análise do que já aconteceu com projeção realista de fechamento.
Mostre se a meta é alcançável no ritmo atual e o que precisa mudar.`;
  }
  if (ctx === "mes_atual_concluido") {
    return `CONTEXTO TEMPORAL: ${periodo_atual} está PRATICAMENTE ENCERRADO (${dias} dias trabalhados).
Faça análise completa de resultados, compare com o mês anterior de forma equilibrada, e prepare 2 recomendações para o próximo mês.`;
  }
  return "";
}

function instrucaoContextoSemana(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "semana_passada") {
    return `CONTEXTO TEMPORAL: A semana ${periodo_ref} JÁ TERMINOU. A semana atual é ${periodo_atual}.
Analise em retrospectiva e extraia lições para aplicar nesta semana atual.
Use passado para ${periodo_ref} e presente/futuro para recomendações.`;
  }
  if (ctx === "semana_atual_iniciante") {
    return `CONTEXTO TEMPORAL: Esta semana mal começou (${dias} dias registrados). NÃO compare com a semana passada de forma negativa. Foque em ritmo e ações para os próximos dias.`;
  }
  return `CONTEXTO TEMPORAL: Semana em andamento (${dias} dias registrados). Combine análise + projeção realista de fechamento.`;
}

function instrucaoContextoDia(ctx: string, periodo_ref: string, periodo_atual: string): string {
  if (ctx === "dia_passado") {
    return `CONTEXTO TEMPORAL: Você está analisando o dia ${periodo_ref} (passado). Hoje é ${periodo_atual}.
Use linguagem de passado para ${periodo_ref} e extraia lições aplicáveis a partir de hoje.`;
  }
  return `CONTEXTO TEMPORAL: Análise do dia atual (${periodo_atual}).`;
}

function blocoAnalisePersonalizada(ap?: AnalisePersonalizada): string {
  if (!ap) return "";
  return `
SEÇÃO OBRIGATÓRIA "Sua Análise Personalizada" — use EXATAMENTE estes dados (NÃO invente):

🔴 ELIMINAR — ${ap.eliminar.titulo}
Dado: ${ap.eliminar.descricao}
Impacto financeiro estimado: R$ ${fmt(ap.eliminar.impacto_rs)}

🟡 MANTER — ${ap.manter.titulo}
Dado: ${ap.manter.descricao}
Ganho extra associado: R$ ${fmt(ap.manter.impacto_rs)}

🟢 MELHORAR — ${ap.melhorar.titulo}
Dado: ${ap.melhorar.descricao}
Potencial de ganho: R$ ${fmt(ap.melhorar.impacto_rs)}

No texto da seção, escreva 1 frase para cada bloco usando esses dados (não copie literal — reescreva de forma fluida e mantenha os valores em R$).`;
}

function buildPromptDia(d: PayloadDia): string {
  const rkmBom = Number(d.r_km_bom || 0);
  const rkmMedio = Number(d.r_km_medio || 0);
  const ticketMin = Number(d.ticket_minimo || 0);
  const ctx = instrucaoContextoDia(d.contexto_temporal || "dia_atual", d.periodo_referencia || d.data_hoje, d.periodo_atual || d.data_hoje);
  return `Você é o Drive IA, copiloto financeiro de motoristas Uber no Brasil. Análise DIÁRIA.

${REGRAS_GERAIS}

${ctx}

DADOS:
- Data: ${d.data_hoje}
- Corridas: ${d.total_corridas} (BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins})
- Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Custo: R$ ${fmt(d.custo_total)} | Ganho real: R$ ${fmt(d.ganho_real)}
- Meta diária: R$ ${fmt(d.meta_diaria)} (${fmt(d.percentual_meta)}% atingida)
- Km total: ${fmt(d.km_total)} (vazio: ${fmt(d.km_deslocamento_total)}) | Horas: ${fmt(d.horas)}h
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km real: R$ ${fmt(d.r_por_km)} | Ticket médio: R$ ${fmt(d.ticket_medio)}
- Meta R$/km BOA: R$ ${fmt(rkmBom)} | piso MÉDIA: R$ ${fmt(rkmMedio)}${ticketMin > 0 ? ` | ticket mínimo: R$ ${fmt(ticketMin)}` : ""}
- Janela: ${d.hora_inicio} → ${d.hora_fim}
- Melhor: R$ ${fmt(d.corrida_melhor.valor)} (${d.corrida_melhor.origem}→${d.corrida_melhor.destino}) | Pior: R$ ${fmt(d.corrida_pior.valor)} (${d.corrida_pior.origem}→${d.corrida_pior.destino})
- Mês: realizado R$ ${fmt(d.ganho_real)} de meta R$ ${fmt(d.meta_mensal)} | projeção R$ ${fmt(d.projecao_mensal)} | falta R$ ${fmt(d.valor_faltante_meta)} em ${d.dias_restantes_mes} dia(s) (R$ ${fmt(d.valor_necessario_por_dia)}/dia)
${blocoAnalisePersonalizada(d.analise_personalizada)}

Gere 4 seções distintas (NÃO repita conteúdo entre elas):

## RESUMO DO DIA
2 parágrafos analíticos. Comece pela performance objetiva (R$, % meta) e termine com insight motivacional GENUÍNO adequado ao resultado.

## RECOMENDAÇÕES PARA AMANHÃ
Exatamente 4 itens diferentes:
🕐 [horário específico baseado nos dados]
📍 [região/bairro baseado nos dados]
✅ [tipo de corrida ideal — usar R$ ${fmt(rkmBom)}/km como referência, NÃO inventar]
⚠️ [comportamento a evitar — pode citar piso de R$ ${fmt(rkmMedio)}/km]

## PROJEÇÃO DO MÊS
1 parágrafo com projeção realista e ação concreta. Sem repetir análise do dia.

## DICA ESTRATÉGICA
1 dica nova + Sua Análise Personalizada (3 blocos 🔴🟡🟢 conforme dados acima, com valores em R$). Termine com UMA ação para amanhã.

Máximo 450 palavras. Linguagem direta e motivadora.`;
}

function buildPromptSemana(d: PayloadSemana): string {
  const semDadosComparativo = d.semana_anterior.corridas < 5;
  const ctx = instrucaoContextoSemana(d.contexto_temporal || "semana_atual_andamento", d.periodo_referencia || d.rotulo_periodo, d.periodo_atual || "esta semana", d.dias_com_corridas || 0);
  return `Você é o Drive IA, copiloto financeiro de motoristas Uber. Análise SEMANAL.

${REGRAS_GERAIS}

${ctx}
${semDadosComparativo ? "- NÃO faça comparativo com a semana anterior (poucos dados)." : "- Comparativo equilibrado com semana anterior é permitido."}

DADOS DA SEMANA (${d.rotulo_periodo}):
- Corridas: ${d.total_corridas} | Ganho real: R$ ${fmt(d.ganho_real)} | Bruto: R$ ${fmt(d.ganho_bruto)}
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Horas: ${fmt(d.horas)}h | Km: ${fmt(d.km_total)}
- Meta semanal: R$ ${fmt(d.meta_semanal)} (${fmt(d.percentual_meta)}%)
- Melhor dia: ${d.melhor_dia.rotulo} (R$ ${fmt(d.melhor_dia.valor)}) | Pior: ${d.pior_dia.rotulo} (R$ ${fmt(d.pior_dia.valor)})
- Horário mais rentável: ${d.hora_pico} (R$ ${fmt(d.rkm_hora_pico)}/km)
- Projeção: R$ ${fmt(d.projecao_semanal)}

SEMANA ANTERIOR: ${d.semana_anterior.corridas} corridas | R$ ${fmt(d.semana_anterior.ganho_real)} real | R$/h ${fmt(d.semana_anterior.r_por_hora)} | R$/km ${fmt(d.semana_anterior.r_por_km)}
${blocoAnalisePersonalizada(d.analise_personalizada)}

Gere 4 seções distintas:

## RESUMO DO DIA
Resumo NARRATIVO da semana (2 parágrafos). Comece com "Nesta semana você realizou ${d.total_corridas} corridas com ganho real de R$ ${fmt(d.ganho_real)}." Cite melhor dia, horário pico e padrão observado. ${semDadosComparativo ? "Não compare com semana anterior." : "Compare com semana anterior."} Termine motivacional.

## RECOMENDAÇÕES PARA AMANHÃ
4 itens para a próxima semana:
🕐 horário a priorizar (baseado em ${d.hora_pico})
📍 padrão de dia da semana a replicar (baseado em ${d.melhor_dia.rotulo})
✅ padrão a manter
⚠️ comportamento a evitar

## PROJEÇÃO DO MÊS
1 parágrafo com projeção R$ ${fmt(d.projecao_semanal)} e ação concreta.

## DICA ESTRATÉGICA
1 dica nova + Sua Análise Personalizada (3 blocos 🔴🟡🟢 com valores em R$). Termine com UMA ação para amanhã.

Máximo 450 palavras.`;
}

function buildPromptMes(d: PayloadMes): string {
  const top3 = d.top3_dias.map((t) => `${t.rotulo} (R$ ${fmt(t.valor)})`).join(", ");
  const ctx = instrucaoContextoMes(d.contexto_temporal || "mes_atual_andamento", d.periodo_referencia || d.rotulo_periodo, d.periodo_atual || "este mês", d.dias_com_corridas || d.dias_trabalhados);
  return `Você é o Drive IA, copiloto financeiro de motoristas Uber. Análise MENSAL.

${REGRAS_GERAIS}

${ctx}

DADOS DO MÊS (${d.rotulo_periodo}):
- Dias trabalhados: ${d.dias_trabalhados} | Corridas: ${d.total_corridas}
- Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Real: R$ ${fmt(d.ganho_real)}
- Meta mensal: R$ ${fmt(d.meta_mensal)} (${fmt(d.percentual_meta)}%)
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)}
- Km total: ${fmt(d.km_total)} (vazio: ${fmt(d.km_vazio_total)})
- Top 3 dias: ${top3}
- Horário lucrativo: ${d.hora_pico} | Dia da semana mais rentável: ${d.melhor_dia_semana}
- Ganho perdido em deslocamentos longos: R$ ${fmt(d.ganho_perdido_deslocamentos_longos)}

MÊS ANTERIOR: ${d.mes_anterior.corridas} corridas | R$ ${fmt(d.mes_anterior.ganho_real)} real | R$/h ${fmt(d.mes_anterior.r_por_hora)} | R$/km ${fmt(d.mes_anterior.r_por_km)} | ${d.mes_anterior.dias_trabalhados} dias
${blocoAnalisePersonalizada(d.analise_personalizada)}

Gere 4 seções distintas:

## RESUMO DO DIA
2-3 parágrafos analíticos seguindo o CONTEXTO TEMPORAL acima. Inclua dias, corridas, ganho real, % meta, top 3 dias, horário lucrativo. Termine motivador.

## RECOMENDAÇÕES PARA AMANHÃ
4 itens específicos:
🕐 horário (baseado em ${d.hora_pico})
📍 dia da semana / região (baseado em ${d.melhor_dia_semana})
✅ tipo de corrida a priorizar
⚠️ comportamento a evitar

## PROJEÇÃO DO MÊS
1 parágrafo com projeção/lições + ajuste prático recomendado.

## DICA ESTRATÉGICA
1 dica nova de longo prazo + Sua Análise Personalizada (3 blocos 🔴🟡🟢 com valores em R$). Termine com UMA ação para amanhã.

Máximo 500 palavras.`;
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
        max_tokens: 1100,
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
