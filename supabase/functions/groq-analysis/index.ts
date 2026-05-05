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

// ─── SYSTEM PROMPT (papel fixo da IA) ────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Drive IA — copiloto financeiro de motoristas Uber no Brasil.

Seu papel é analisar os dados reais de corridas e entregar insights que façam o motorista ganhar mais. Você conhece a rotina na pele: o trânsito nas madrugadas, o dilema de aceitar ou recusar uma corrida longa, a frustração de chegar perto da meta e não bater. Fale como quem entende isso.

TOM E ESTILO:
Seja direto como um parceiro experiente, não como um relatório corporativo. Use os números para contar uma história sobre o dia — o que aconteceu, o que funcionou, o que custou dinheiro. Motivação real vem de dados concretos: mostrar que das 11h às 13h o motorista rendeu R$ 2,72/km enquanto a média foi R$ 1,90/km é muito mais motivador do que "você está no caminho certo".

REGRAS INEGOCIÁVEIS:
— Cada seção traz informação nova. Nenhuma frase se repete em seções diferentes.
— Cite sempre valores em R$, horários e dias reais dos dados fornecidos.
— Nunca use: "é importante reconhecer", "é fundamental", "é motivador", "é crucial", "com esses dados em mente", "você está no caminho certo", "com dedicação", "esforço foi significativo", "ajustar estratégias conforme necessário", "monitorar constantemente", "base sólida".
— Nunca sugira apps concorrentes (99, inDriver), delivery ou mudança de profissão.
— Nunca use alarmismo: "queda drástica", "resultado preocupante", "muito abaixo do esperado".
— A análise comportamental (🔴🟡🟢) usa EXCLUSIVAMENTE os valores fornecidos no prompt — nunca invente ou substitua esses números.

FORMATO DE SAÍDA OBRIGATÓRIO:
Use exatamente estes 4 cabeçalhos, nesta ordem, sem cabeçalhos extras:
## RESUMO DO DIA
## RECOMENDAÇÕES PARA AMANHÃ
## PROJEÇÃO DO MÊS
## DICA ESTRATÉGICA`;

// ─── CONTEXTO TEMPORAL ───────────────────────────────────────────────────────

function instrucaoContextoMes(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "mes_passado") {
    return `CONTEXTO: Você está analisando ${periodo_ref}, um mês COMPLETAMENTE ENCERRADO. O mês atual é ${periodo_atual}.
Use linguagem de passado para tudo que se refere a ${periodo_ref}: "você realizou", "rendeu", "o padrão que se destacou foi", "o que pesou foi".
Não projete futuro para ${periodo_ref} — esse mês acabou.
Na seção PROJEÇÃO DO MÊS, escreva as lições de ${periodo_ref} que o motorista deve aplicar AGORA em ${periodo_atual}, com ações concretas para esta semana.`;
  }
  if (ctx === "mes_atual_iniciante") {
    return `CONTEXTO: ${periodo_atual} está começando — apenas ${dias} dias registrados. Base de dados ainda pequena.
Foque no ritmo atual: se mantiver essa média, vai bater a meta? O que acelerar já nesta semana?
Tom encorajador e prospectivo. Não compare negativamente com o mês anterior.`;
  }
  if (ctx === "mes_atual_andamento") {
    return `CONTEXTO: ${periodo_atual} em andamento com ${dias} dias registrados — dados suficientes para análise real.
Combine o que já aconteceu com projeção honesta de fechamento. A meta é alcançável nesse ritmo? O que precisa mudar?`;
  }
  if (ctx === "mes_atual_concluido") {
    return `CONTEXTO: ${periodo_atual} praticamente encerrado (${dias} dias trabalhados).
Análise completa de resultados. Na seção PROJEÇÃO DO MÊS, prepare 2-3 recomendações concretas para o próximo mês.`;
  }
  return `CONTEXTO: Análise do mês ${periodo_ref}.`;
}

function instrucaoContextoSemana(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "semana_passada") {
    return `CONTEXTO: A semana ${periodo_ref} já encerrou. A semana atual é ${periodo_atual}.
Use passado para ${periodo_ref}. Extraia lições diretas para aplicar nesta semana — o que replicar, o que corrigir.`;
  }
  if (ctx === "semana_atual_iniciante") {
    return `CONTEXTO: Semana recém começada (${dias} dias registrados). Foque no ritmo e no que fazer para fechar bem os próximos dias.`;
  }
  return `CONTEXTO: Semana em andamento com ${dias} dias. Combine o que já aconteceu com o que ainda dá para fazer esta semana.`;
}

function instrucaoContextoDia(ctx: string, periodo_ref: string, periodo_atual: string): string {
  if (ctx === "dia_passado") {
    return `CONTEXTO: Você está analisando ${periodo_ref}, um dia já encerrado. Hoje é ${periodo_atual}.
Use passado para ${periodo_ref}. Na seção PROJEÇÃO DO MÊS, use o ganho acumulado até ${periodo_atual}.`;
  }
  return `CONTEXTO: Análise do dia ${periodo_atual}.`;
}

// ─── BLOCO COMPORTAMENTAL ────────────────────────────────────────────────────

function blocoAnalisePersonalizada(ap?: AnalisePersonalizada): string {
  if (!ap) return "";
  return `
ANÁLISE COMPORTAMENTAL — use estes valores exatos na seção DICA ESTRATÉGICA (não invente outros):
🔴 ELIMINAR — ${ap.eliminar.titulo}: ${ap.eliminar.descricao} | impacto financeiro: R$ ${fmt(ap.eliminar.impacto_rs)}
🟡 MANTER — ${ap.manter.titulo}: ${ap.manter.descricao} | ganho extra identificado: R$ ${fmt(ap.manter.impacto_rs)}
🟢 MELHORAR — ${ap.melhorar.titulo}: ${ap.melhorar.descricao} | potencial de ganho: R$ ${fmt(ap.melhorar.impacto_rs)}`;
}

// ─── BUILD PROMPTS ────────────────────────────────────────────────────────────

function buildPromptDia(d: PayloadDia): string {
  const rkmBom = Number(d.r_km_bom || 0);
  const rkmMedio = Number(d.r_km_medio || 0);
  const ticketMin = Number(d.ticket_minimo || 0);
  const ctx = instrucaoContextoDia(
    d.contexto_temporal || "dia_atual",
    d.periodo_referencia || d.data_hoje,
    d.periodo_atual || d.data_hoje
  );

  return `${ctx}

DADOS DO DIA — ${d.data_hoje}:
Corridas: ${d.total_corridas} | BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins}
Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Custos: R$ ${fmt(d.custo_total)} | Ganho real: R$ ${fmt(d.ganho_real)}
Meta diária: R$ ${fmt(d.meta_diaria)} (${fmt(d.percentual_meta)}% atingida)
Km rodados: ${fmt(d.km_total)} | Km vazio: ${fmt(d.km_deslocamento_total)} | Horas: ${fmt(d.horas)}h
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Ticket médio: R$ ${fmt(d.ticket_medio)}
Parâmetros do motorista: corrida BOA ≥ R$ ${fmt(rkmBom)}/km | corrida MÉDIA ≥ R$ ${fmt(rkmMedio)}/km${ticketMin > 0 ? ` | ticket mínimo: R$ ${fmt(ticketMin)}` : ""}
Janela de trabalho: ${d.hora_inicio} até ${d.hora_fim}
Melhor corrida: R$ ${fmt(d.corrida_melhor.valor)} — ${d.corrida_melhor.origem} → ${d.corrida_melhor.destino} (${fmt(d.corrida_melhor.km)} km)
Pior corrida: R$ ${fmt(d.corrida_pior.valor)} — ${d.corrida_pior.origem} → ${d.corrida_pior.destino} (${fmt(d.corrida_pior.km)} km)
Mês: acumulado R$ ${fmt(d.ganho_real)} | meta R$ ${fmt(d.meta_mensal)} | projeção R$ ${fmt(d.projecao_mensal)} | faltam R$ ${fmt(d.valor_faltante_meta)} em ${d.dias_restantes_mes} dia(s) = R$ ${fmt(d.valor_necessario_por_dia)}/dia
${blocoAnalisePersonalizada(d.analise_personalizada)}

TAREFA — gere a análise diária em 4 seções:

## RESUMO DO DIA
Dois parágrafos que contam o que aconteceu neste dia de verdade.
Primeiro: os números que definem o dia — ganho real, % da meta, R$/hora, R$/km, distribuição das corridas (${d.n_boas} boas, ${d.n_medias} médias, ${d.n_ruins} ruins). Contextualize: esse R$/km de R$ ${fmt(d.r_por_km)} fica acima ou abaixo do parâmetro BOA de R$ ${fmt(rkmBom)}/km?
Segundo: o que teve de mais relevante — a melhor corrida (R$ ${fmt(d.corrida_melhor.valor)} de ${d.corrida_melhor.origem} para ${d.corrida_melhor.destino}), algum padrão de horário ou região que se destacou, e o que pesou negativamente. Feche com perspectiva concreta baseada nos dados.

## RECOMENDAÇÕES PARA AMANHÃ
Quatro recomendações distintas, cada uma com justificativa baseada nos dados de hoje:
🕐 [horário específico para priorizar amanhã — com R$/km ou R$/hora que justifica]
📍 [região ou tipo de trajeto para buscar — baseado na melhor corrida ou padrão do dia]
✅ [comportamento ou padrão que funcionou hoje e deve ser replicado]
⚠️ [o que evitar — km vazio excessivo, corridas abaixo de R$ ${fmt(rkmMedio)}/km, ou padrão que custou dinheiro]

## PROJEÇÃO DO MÊS
Com R$ ${fmt(d.ganho_real)} acumulados e projeção de R$ ${fmt(d.projecao_mensal)} para o mês, analise de forma honesta: esse ritmo leva à meta de R$ ${fmt(d.meta_mensal)}? Nos ${d.dias_restantes_mes} dias restantes serão necessários R$ ${fmt(d.valor_necessario_por_dia)}/dia — isso é realista dado o desempenho de hoje? Dê uma perspectiva concreta, sem prometer o impossível nem subestimar o potencial.

## DICA ESTRATÉGICA
Uma dica operacional genuína baseada nos padrões deste dia — algo que o motorista provavelmente não percebeu olhando para os números sozinho.
Em seguida, a análise comportamental com os três pontos abaixo, cada um em uma linha, reescrito de forma natural (não copie literal):
🔴 [insight sobre o que eliminar, com o valor de impacto em R$]
🟡 [insight sobre o que manter, com o ganho extra em R$]
🟢 [insight sobre o que melhorar, com o potencial em R$]
Última linha — "Ação para amanhã:" seguida de uma ação específica e imediatamente executável.`;
}

function buildPromptSemana(d: PayloadSemana): string {
  const semDadosComparativo = d.semana_anterior.corridas < 5;
  const ctx = instrucaoContextoSemana(
    d.contexto_temporal || "semana_atual_andamento",
    d.periodo_referencia || d.rotulo_periodo,
    d.periodo_atual || "esta semana",
    d.dias_com_corridas || 0
  );

  return `${ctx}

DADOS DA SEMANA — ${d.rotulo_periodo}:
Corridas: ${d.total_corridas} | Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)}
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Horas: ${fmt(d.horas)}h | Km: ${fmt(d.km_total)}
Meta semanal: R$ ${fmt(d.meta_semanal)} (${fmt(d.percentual_meta)}% atingida)
Melhor dia: ${d.melhor_dia.rotulo} — R$ ${fmt(d.melhor_dia.valor)} | Pior dia: ${d.pior_dia.rotulo} — R$ ${fmt(d.pior_dia.valor)}
Horário mais rentável: ${d.hora_pico} → R$ ${fmt(d.rkm_hora_pico)}/km
${!semDadosComparativo ? `Semana anterior: ${d.semana_anterior.corridas} corridas | R$ ${fmt(d.semana_anterior.ganho_real)} real | R$/h ${fmt(d.semana_anterior.r_por_hora)} | R$/km ${fmt(d.semana_anterior.r_por_km)}` : "Semana anterior: dados insuficientes para comparativo."}
${blocoAnalisePersonalizada(d.analise_personalizada)}

TAREFA — gere a análise semanal em 4 seções:

## RESUMO DO DIA
Dois parágrafos sobre esta semana.
Primeiro: os números centrais — ${d.total_corridas} corridas, R$ ${fmt(d.ganho_real)} de ganho real, ${fmt(d.percentual_meta)}% da meta semanal, R$/hora, R$/km. O destaque da semana foi ${d.melhor_dia.rotulo} com R$ ${fmt(d.melhor_dia.valor)}. O horário ${d.hora_pico} rendeu R$ ${fmt(d.rkm_hora_pico)}/km — o que esse número revela sobre o padrão da semana?
Segundo: ${semDadosComparativo ? "sem comparativo com a semana anterior (dados insuficientes) — analise os padrões internos desta semana: o que funcionou, o que pesou, que dia ou horário merece atenção." : `compare com a semana anterior (R$ ${fmt(d.semana_anterior.ganho_real)}, ${d.semana_anterior.corridas} corridas): o que evoluiu, o que regrediu, e o que explica a diferença.`} Feche com algo concreto que o motorista pode replicar ou corrigir já na próxima semana.

## RECOMENDAÇÕES PARA AMANHÃ
Quatro recomendações para a próxima semana, cada uma com dado que a justifica:
🕐 [horário a priorizar — baseado em ${d.hora_pico} e R$ ${fmt(d.rkm_hora_pico)}/km]
📍 [padrão de dia da semana — o que ${d.melhor_dia.rotulo} teve de diferente, como repetir; o que mudar em ${d.pior_dia.rotulo}]
✅ [comportamento desta semana que gerou resultado acima da média e merece ser mantido]
⚠️ [padrão que reduziu o ganho real esta semana e precisa ser corrigido]

## PROJEÇÃO DO MÊS
No ritmo desta semana — R$ ${fmt(d.r_por_hora)}/hora, ${d.total_corridas} corridas em ${d.dias_com_corridas || 5} dias — qual é a projeção realista de fechamento do mês? A meta mensal de R$ ${fmt(d.meta_semanal * 4)} está ao alcance? O que precisaria mudar concretamente para fechar acima dela? Termine com uma ação para os próximos 2-3 dias.

## DICA ESTRATÉGICA
Um insight sobre padrão desta semana que merece atenção — algo que os números revelam mas que não está óbvio na superfície.
Em seguida, a análise comportamental com os três pontos abaixo, reescritos de forma natural:
🔴 [o que eliminar, com o impacto em R$]
🟡 [o que manter, com o ganho extra em R$]
🟢 [o que melhorar, com o potencial em R$]
Última linha — "Ação para esta semana:" seguida de uma ação específica.`;
}

function buildPromptMes(d: PayloadMes): string {
  const top3 = d.top3_dias.map((t) => `${t.rotulo} (R$ ${fmt(t.valor)})`).join(", ");
  const pctVazio = fmt((d.km_vazio_total / (d.km_total || 1)) * 100);
  const ehPassado = d.contexto_temporal === "mes_passado";
  const ctx = instrucaoContextoMes(
    d.contexto_temporal || "mes_atual_andamento",
    d.periodo_referencia || d.rotulo_periodo,
    d.periodo_atual || "este mês",
    d.dias_com_corridas || d.dias_trabalhados
  );

  return `${ctx}

DADOS DO MÊS — ${d.rotulo_periodo}:
Dias trabalhados: ${d.dias_trabalhados} | Corridas: ${d.total_corridas}
Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)}
Meta mensal: R$ ${fmt(d.meta_mensal)} (${fmt(d.percentual_meta)}% atingida)
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)}
Km total: ${fmt(d.km_total)} | Km vazio: ${fmt(d.km_vazio_total)} (${pctVazio}% do total)
Top 3 dias: ${top3}
Horário mais rentável: ${d.hora_pico} | Melhor dia da semana: ${d.melhor_dia_semana}
Custo estimado de deslocamentos longos: R$ ${fmt(d.ganho_perdido_deslocamentos_longos)}
Mês anterior: ${d.mes_anterior.corridas} corridas | R$ ${fmt(d.mes_anterior.ganho_real)} real | R$/h ${fmt(d.mes_anterior.r_por_hora)} | R$/km ${fmt(d.mes_anterior.r_por_km)} | ${d.mes_anterior.dias_trabalhados} dias
${blocoAnalisePersonalizada(d.analise_personalizada)}

TAREFA — gere a análise mensal em 4 seções:

## RESUMO DO DIA
Dois ou três parágrafos que contam a história deste mês.
Primeiro: os números que definem o mês — ${d.dias_trabalhados} dias, ${d.total_corridas} corridas, R$ ${fmt(d.ganho_real)} real, ${fmt(d.percentual_meta)}% da meta. Os três melhores dias foram ${top3}. O horário ${d.hora_pico} se destacou. A ${d.melhor_dia_semana} foi o dia da semana mais rentável.
${ehPassado
  ? `Segundo: retrospectiva honesta de ${d.periodo_referencia} — o que funcionou bem (com números), o que limitou o resultado, e como esse mês se compara ao anterior (R$ ${fmt(d.mes_anterior.ganho_real)}, ${d.mes_anterior.corridas} corridas). Extraia o insight central que o motorista deve carregar para ${d.periodo_atual}.`
  : `Segundo: análise do andamento — o ritmo atual sustenta a meta? Com ${d.dias_trabalhados} dias e R$ ${fmt(d.r_por_hora)}/hora médio, o que os dados indicam sobre o fechamento? Seja direto.`}
Feche com uma observação concreta que coloca o desempenho em perspectiva.

## RECOMENDAÇÕES PARA AMANHÃ
Quatro insights baseados nos padrões deste mês:
🕐 [horário ${d.hora_pico} — por que priorizar, com dado que justifica]
📍 [o padrão da ${d.melhor_dia_semana} — o que tornava esse dia mais rentável e como replicar]
✅ [padrão dos top 3 dias (${top3}) — o que eles têm em comum que merece ser replicado]
⚠️ [${fmt(d.km_vazio_total)} km vazios (${pctVazio}% do total) custaram R$ ${fmt(d.ganho_perdido_deslocamentos_longos)} — como reduzir isso na prática]

## PROJEÇÃO DO MÊS
${ehPassado
  ? `Lições de ${d.periodo_referencia} para aplicar agora em ${d.periodo_atual}: três ações concretas e específicas que os dados deste mês revelaram, escritas de forma direta ("nas próximas semanas, priorize...", "evite aceitar...", "concentre seus horários em...").`
  : `Projeção honesta de fechamento: no ritmo atual de R$ ${fmt(d.r_por_hora)}/hora e R$ ${fmt(d.ganho_real)} já realizados, qual o cenário mais provável de fechamento? A meta de R$ ${fmt(d.meta_mensal)} está ao alcance? O que precisa acontecer concretamente nas próximas semanas para chegar lá.`}

## DICA ESTRATÉGICA
Um insight de médio prazo — um padrão que aparece nos dados deste mês que, se ajustado, pode mudar o resultado consistentemente nos próximos meses.
Em seguida, a análise comportamental com os três pontos abaixo, reescritos de forma natural:
🔴 [o que eliminar, com o impacto em R$]
🟡 [o que manter, com o ganho extra em R$]
🟢 [o que melhorar, com o potencial em R$]
Última linha — "Ação para amanhã:" seguida de uma ação específica e imediatamente executável.`;
}

// ─── ORQUESTRAÇÃO ─────────────────────────────────────────────────────────────

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

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────

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
    const userPrompt = buildPrompt(payload);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.72,
        max_tokens: 1600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
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