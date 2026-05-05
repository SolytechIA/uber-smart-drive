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

const REGRAS_GERAIS = `IDENTIDADE: Você é o Drive IA, copiloto financeiro de motoristas Uber no Brasil. Fale como um analista experiente que conhece a rotina na pele — direto, específico, baseado em dados.

ESTILO DE ESCRITA OBRIGATÓRIO:
- Comece frases com dados concretos, não com avaliações: ERRADO: "É importante reconhecer que o resultado foi bom." CERTO: "R$ 230,54 com 82% da meta batida — acima da média dos últimos 7 dias."
- Motivação vem de dados, não de elogios: ERRADO: "Você está no caminho certo!" CERTO: "Seu R$/km de R$ 1,90 na faixa das 8h supera em 22% a média do dia — esse padrão é replicável."
- Seja cirúrgico: cite horários exatos, bairros reais, valores em R$ dos dados recebidos.
- Cada seção traz informação NOVA — zero repetição entre seções.
- Encerre sempre com UMA ação específica e imediatamente executável.

FRASES ABSOLUTAMENTE PROIBIDAS (se escrever qualquer uma dessas, recomece o parágrafo):
"é importante reconhecer", "é fundamental manter", "é motivador", "é crucial", "com esses dados em mente", "você está no caminho certo", "com dedicação", "cada dia é uma oportunidade", "esforço foi significativo", "base sólida para crescimento", "ajustar estratégias conforme necessário", "monitorar constantemente".

OUTRAS REGRAS:
- NUNCA sugira outras plataformas (99, inDriver), delivery ou mudança de profissão.
- NUNCA use alarmismo: "queda drástica", "preocupante", "muito abaixo".
- Formato obrigatório: use exatamente ## RESUMO DO DIA, ## RECOMENDAÇÕES PARA AMANHÃ, ## PROJEÇÃO DO MÊS, ## DICA ESTRATÉGICA. Sem outros cabeçalhos.`;

function instrucaoContextoMes(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "mes_passado") {
    return `CONTEXTO TEMPORAL — ATENÇÃO CRÍTICA: ${periodo_ref} JÁ ENCERROU COMPLETAMENTE. Você está analisando história, não futuro.
REGRA ABSOLUTA: NÃO use frases como "para alcançar a meta", "é possível melhorar", "é hora de planejar" referentes a ${periodo_ref} — esse mês acabou.
USE LINGUAGEM DE PASSADO EXCLUSIVAMENTE para ${periodo_ref}: "você realizou", "rendeu", "o padrão foi", "funcionou", "não funcionou".
O mês atual é ${periodo_atual} — apenas nas seções de recomendação use linguagem de futuro, sempre referenciando ${periodo_atual} explicitamente.
Na seção ## PROJEÇÃO DO MÊS, escreva "Lições de ${periodo_ref} para ${periodo_atual}:" seguido de 3 ações concretas que o motorista deve executar ESTA SEMANA em ${periodo_atual}.`;
  }
  if (ctx === "mes_atual_iniciante") {
    return `CONTEXTO TEMPORAL — INÍCIO DE MÊS:
${periodo_atual} está começando (${dias} dias registrados). É normal ter poucos dados.
NÃO compare negativamente com o mês anterior — base insuficiente.
Foque em: ritmo atual, se vai atingir a meta mantendo esse ritmo, e 2 ações concretas para acelerar nesta semana.
Tom: encorajador e prospectivo — o mês acabou de começar.`;
  }
  if (ctx === "mes_atual_andamento") {
    return `CONTEXTO TEMPORAL — MÊS EM ANDAMENTO:
${periodo_atual} está em curso com ${dias} dias registrados — dados suficientes para análise real.
Combine análise do que já aconteceu com projeção realista de fechamento.
Seja direto: a meta é alcançável nesse ritmo? O que precisa mudar?`;
  }
  if (ctx === "mes_atual_concluido") {
    return `CONTEXTO TEMPORAL — MÊS PRATICAMENTE ENCERRADO:
${periodo_atual} está se encerrando (${dias} dias trabalhados).
Faça análise completa de resultados, compare com o mês anterior de forma equilibrada.
Na seção ## PROJEÇÃO DO MÊS, prepare 2 recomendações concretas para o próximo mês.`;
  }
  return "";
}

function instrucaoContextoSemana(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "semana_passada") {
    return `CONTEXTO TEMPORAL — SEMANA PASSADA:
A semana ${periodo_ref} já encerrou. A semana atual é ${periodo_atual}.
USE LINGUAGEM DE PASSADO para ${periodo_ref}. Extraia lições concretas para aplicar nesta semana.`;
  }
  if (ctx === "semana_atual_iniciante") {
    return `CONTEXTO TEMPORAL — INÍCIO DE SEMANA:
A semana mal começou (${dias} dias). NÃO compare negativamente com a semana passada.
Foque em ritmo atual e o que fazer nos próximos dias para fechar bem.`;
  }
  return `CONTEXTO TEMPORAL — SEMANA EM ANDAMENTO:
${dias} dias registrados nesta semana. Combine análise do realizado com projeção de fechamento.`;
}

function instrucaoContextoDia(ctx: string, periodo_ref: string, periodo_atual: string): string {
  if (ctx === "dia_passado") {
    return `CONTEXTO TEMPORAL — DIA PASSADO:
Você está analisando ${periodo_ref} (dia já encerrado). Hoje é ${periodo_atual}.
USE LINGUAGEM DE PASSADO para ${periodo_ref}. Extraia lições aplicáveis a partir de hoje.
Na seção ## PROJEÇÃO DO MÊS, use o ganho acumulado até hoje (${periodo_atual}), não até ${periodo_ref}.`;
  }
  return `CONTEXTO TEMPORAL — DIA ATUAL: ${periodo_atual}.`;
}

function blocoAnalisePersonalizada(ap?: AnalisePersonalizada): string {
  if (!ap) return "";
  return `
DADOS PARA "Sua Análise Personalizada" — USE EXATAMENTE ESTES VALORES (não invente, não substitua):
🔴 ELIMINAR — ${ap.eliminar.titulo}: ${ap.eliminar.descricao} → impacto: R$ ${fmt(ap.eliminar.impacto_rs)}
🟡 MANTER — ${ap.manter.titulo}: ${ap.manter.descricao} → ganho extra: R$ ${fmt(ap.manter.impacto_rs)}
🟢 MELHORAR — ${ap.melhorar.titulo}: ${ap.melhorar.descricao} → potencial: R$ ${fmt(ap.melhorar.impacto_rs)}

Na seção ## DICA ESTRATÉGICA, integre esses 3 blocos em texto fluido (NÃO copie literal — reescreva com os valores em R$).
Cada bloco em 1 frase. Termine com UMA ação específica para amanhã.`;
}

function buildPromptDia(d: PayloadDia): string {
  const rkmBom = Number(d.r_km_bom || 0);
  const rkmMedio = Number(d.r_km_medio || 0);
  const ticketMin = Number(d.ticket_minimo || 0);
  const ctx = instrucaoContextoDia(d.contexto_temporal || "dia_atual", d.periodo_referencia || d.data_hoje, d.periodo_atual || d.data_hoje);

  return `Você é o Drive IA, copiloto financeiro de motoristas Uber no Brasil. Gere uma análise DIÁRIA.

${REGRAS_GERAIS}

${ctx}

DADOS DO DIA:
- Data: ${d.data_hoje}
- Corridas: ${d.total_corridas} (BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins})
- Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Custos: R$ ${fmt(d.custo_total)} | Ganho real: R$ ${fmt(d.ganho_real)}
- Meta diária: R$ ${fmt(d.meta_diaria)} → ${fmt(d.percentual_meta)}% atingida
- Km rodados: ${fmt(d.km_total)} (vazio: ${fmt(d.km_deslocamento_total)}) | Horas: ${fmt(d.horas)}h
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km real: R$ ${fmt(d.r_por_km)} | Ticket médio: R$ ${fmt(d.ticket_medio)}
- Parâmetros configurados: R$/km BOA ≥ R$ ${fmt(rkmBom)} | R$/km MÉDIA ≥ R$ ${fmt(rkmMedio)}${ticketMin > 0 ? ` | ticket mínimo R$ ${fmt(ticketMin)}` : ""}
- Janela de trabalho: ${d.hora_inicio} → ${d.hora_fim}
- Melhor corrida: R$ ${fmt(d.corrida_melhor.valor)} (${d.corrida_melhor.origem} → ${d.corrida_melhor.destino}, ${fmt(d.corrida_melhor.km)} km)
- Pior corrida: R$ ${fmt(d.corrida_pior.valor)} (${d.corrida_pior.origem} → ${d.corrida_pior.destino}, ${fmt(d.corrida_pior.km)} km)
- Acumulado no mês: R$ ${fmt(d.ganho_real)} de R$ ${fmt(d.meta_mensal)} | Projeção: R$ ${fmt(d.projecao_mensal)} | Faltam R$ ${fmt(d.valor_faltante_meta)} em ${d.dias_restantes_mes} dia(s) → R$ ${fmt(d.valor_necessario_por_dia)}/dia
${blocoAnalisePersonalizada(d.analise_personalizada)}

INSTRUÇÕES DE CONTEÚDO POR SEÇÃO:

## RESUMO DO DIA
Escreva 2 parágrafos analíticos sobre este dia específico.
Parágrafo 1: performance objetiva — cite corridas, ganho real, % da meta, R$/hora, R$/km. Compare com os parâmetros configurados (R$ ${fmt(rkmBom)}/km para BOA). Seja preciso.
Parágrafo 2: o que se destacou neste dia (positivo ou negativo) com base nos dados reais. Se foi bom, explique o porquê com dados. Se foi ruim, aponte o fator principal sem alarmismo. Encerre com perspectiva construtiva baseada nos números.

## RECOMENDAÇÕES PARA AMANHÃ
Exatamente 4 recomendações DIFERENTES entre si, cada uma em 1-2 linhas:
🕐 Horário: baseado na janela ${d.hora_inicio}-${d.hora_fim} — qual faixa maximizar amanhã e por quê (use R$/km como justificativa)
📍 Região/Trajeto: baseado nas corridas de origem ${d.corrida_melhor.origem} — o que replicar
✅ Priorizar: tipo de corrida ideal usando R$ ${fmt(rkmBom)}/km como referência concreta
⚠️ Evitar: comportamento específico identificado nos dados (km vazio, corridas abaixo de R$ ${fmt(rkmMedio)}/km, etc.)

## PROJEÇÃO DO MÊS
1 parágrafo com: acumulado real (R$ ${fmt(d.ganho_real)}), meta (R$ ${fmt(d.meta_mensal)}), projeção no ritmo atual (R$ ${fmt(d.projecao_mensal)}), o que precisa acontecer nos ${d.dias_restantes_mes} dias restantes (R$ ${fmt(d.valor_necessario_por_dia)}/dia). Concreto e realista.

## DICA ESTRATÉGICA
1 parágrafo com dica operacional nova (não repetir o que já foi dito acima).
Em seguida, "Sua Análise Personalizada" com os 3 blocos 🔴🟡🟢 integrados em texto fluido com os valores exatos fornecidos.
Última linha: "Ação para amanhã: [1 ação específica e concreta]."

Máximo 480 palavras no total. Sem introdução antes do ## RESUMO DO DIA.`;
}

function buildPromptSemana(d: PayloadSemana): string {
  const semDadosComparativo = d.semana_anterior.corridas < 5;
  const ctx = instrucaoContextoSemana(
    d.contexto_temporal || "semana_atual_andamento",
    d.periodo_referencia || d.rotulo_periodo,
    d.periodo_atual || "esta semana",
    d.dias_com_corridas || 0
  );

  return `Você é o Drive IA, copiloto financeiro de motoristas Uber. Gere uma análise SEMANAL.

${REGRAS_GERAIS}

${ctx}
${semDadosComparativo ? "ATENÇÃO: semana anterior com menos de 5 corridas — NÃO faça comparativo com ela." : ""}

DADOS DA SEMANA (${d.rotulo_periodo}):
- Corridas: ${d.total_corridas} | Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)}
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Horas: ${fmt(d.horas)}h | Km: ${fmt(d.km_total)}
- Meta semanal: R$ ${fmt(d.meta_semanal)} → ${fmt(d.percentual_meta)}% atingida
- Melhor dia: ${d.melhor_dia.rotulo} com R$ ${fmt(d.melhor_dia.valor)} | Pior dia: ${d.pior_dia.rotulo} com R$ ${fmt(d.pior_dia.valor)}
- Horário mais rentável: ${d.hora_pico} → R$ ${fmt(d.rkm_hora_pico)}/km
- Projeção semanal: R$ ${fmt(d.projecao_semanal)}
${!semDadosComparativo ? `- Semana anterior: ${d.semana_anterior.corridas} corridas | R$ ${fmt(d.semana_anterior.ganho_real)} real | R$/h ${fmt(d.semana_anterior.r_por_hora)} | R$/km ${fmt(d.semana_anterior.r_por_km)}` : ""}
${blocoAnalisePersonalizada(d.analise_personalizada)}

INSTRUÇÕES DE CONTEÚDO POR SEÇÃO:

## RESUMO DO DIA
Comece EXATAMENTE com: "Nesta semana você realizou ${d.total_corridas} corridas com ganho real de R$ ${fmt(d.ganho_real)}."
Parágrafo 1: dados da semana — corridas, ganho, % meta, R$/hora, R$/km, melhor dia (${d.melhor_dia.rotulo}: R$ ${fmt(d.melhor_dia.valor)}), horário de pico (${d.hora_pico}: R$ ${fmt(d.rkm_hora_pico)}/km). Identifique 1 padrão concreto observado.
Parágrafo 2 (seguindo o CONTEXTO TEMPORAL acima): ${semDadosComparativo ? "sem comparativo — foque nos padrões desta semana e o que fazer para fechar bem." : `compare com a semana anterior (R$ ${fmt(d.semana_anterior.ganho_real)}) de forma equilibrada. Aponte o que evoluiu e o que ainda pode melhorar.`} Encerre motivador com dado concreto.

## RECOMENDAÇÕES PARA AMANHÃ
4 recomendações para a PRÓXIMA SEMANA, cada uma diferente:
🕐 Horário a priorizar: baseado em ${d.hora_pico} → justificativa com R$/km real
📍 Dia da semana a replicar: baseado em ${d.melhor_dia.rotulo} (R$ ${fmt(d.melhor_dia.valor)}) → o que fazer diferente no pior dia (${d.pior_dia.rotulo})
✅ Padrão a manter: 1 comportamento desta semana que gerou resultado acima da média
⚠️ Comportamento a eliminar: 1 padrão específico que reduziu o ganho real desta semana

## PROJEÇÃO DO MÊS
1 parágrafo com análise NOVA — não repita o valor R$ ${fmt(d.projecao_semanal)} que já está no cabeçalho. Responda: no ritmo desta semana (${fmt(d.total_corridas)} corridas, R$ ${fmt(d.r_por_hora)}/h), quantas semanas seriam necessárias para bater a meta mensal de R$ ${fmt(d.meta_semanal * 4)}? O que precisaria mudar especificamente para fechar o mês acima da meta? Termine com UMA ação concreta para os próximos 2 dias.

## DICA ESTRATÉGICA
1 dica operacional nova (não repetir recomendações acima).
"Sua Análise Personalizada" com os 3 blocos 🔴🟡🟢 em texto fluido com valores exatos.
Última linha: "Ação para esta semana: [1 ação específica]."

Máximo 480 palavras. Sem introdução antes do ## RESUMO DO DIA.`;
}

function buildPromptMes(d: PayloadMes): string {
  const top3 = d.top3_dias.map((t) => `${t.rotulo} com R$ ${fmt(t.valor)}`).join(", ");
  const ehPassado = d.contexto_temporal === "mes_passado";
  const ctx = instrucaoContextoMes(
    d.contexto_temporal || "mes_atual_andamento",
    d.periodo_referencia || d.rotulo_periodo,
    d.periodo_atual || "este mês",
    d.dias_com_corridas || d.dias_trabalhados
  );

  return `Você é o Drive IA, copiloto financeiro de motoristas Uber. Gere uma análise MENSAL.

${REGRAS_GERAIS}

${ctx}

DADOS DO MÊS (${d.rotulo_periodo}):
- Dias trabalhados: ${d.dias_trabalhados} | Corridas: ${d.total_corridas}
- Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)}
- Meta mensal: R$ ${fmt(d.meta_mensal)} → ${fmt(d.percentual_meta)}% atingida
- R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)}
- Km total: ${fmt(d.km_total)} | Km vazio: ${fmt(d.km_vazio_total)} (${fmt((d.km_vazio_total / (d.km_total || 1)) * 100)}% do total)
- Top 3 dias mais lucrativos: ${top3}
- Horário mais rentável: ${d.hora_pico} | Melhor dia da semana: ${d.melhor_dia_semana}
- Ganho perdido em deslocamentos longos: R$ ${fmt(d.ganho_perdido_deslocamentos_longos)}
- Mês anterior: ${d.mes_anterior.corridas} corridas | R$ ${fmt(d.mes_anterior.ganho_real)} real | R$/h ${fmt(d.mes_anterior.r_por_hora)} | R$/km ${fmt(d.mes_anterior.r_por_km)} | ${d.mes_anterior.dias_trabalhados} dias
${blocoAnalisePersonalizada(d.analise_personalizada)}

INSTRUÇÕES DE CONTEÚDO POR SEÇÃO:

## RESUMO DO DIA
Parágrafo 1: dados completos do mês — ${d.dias_trabalhados} dias, ${d.total_corridas} corridas, R$ ${fmt(d.ganho_bruto)} bruto, R$ ${fmt(d.ganho_real)} real, ${fmt(d.percentual_meta)}% da meta, R$/hora, R$/km. Top 3 dias (${top3}). Horário lucrativo: ${d.hora_pico}. Melhor dia da semana: ${d.melhor_dia_semana}.
Parágrafo 2: ${ehPassado
    ? `análise retrospectiva de ${d.periodo_referencia} — o que funcionou bem, o que limitou o resultado, e como isso se compara ao mês anterior. Use passado. Extraia 1 insight central que o motorista deve carregar para ${d.periodo_atual}.`
    : `análise do andamento — o ritmo atual sustenta a meta? O que está funcionando? O que precisa ajustar antes do fechamento? Seja direto.`}
Encerre com frase motivadora baseada em dado real (ex: "Seu melhor dia foi ${d.top3_dias[0]?.rotulo} com R$ ${fmt(d.top3_dias[0]?.valor)} — esse padrão é replicável.").

## RECOMENDAÇÕES PARA AMANHÃ
4 insights/recomendações concretas baseadas nos dados deste mês:
🕐 Horário: priorizar ${d.hora_pico} → por quê (cite R$/km real desse horário se disponível)
📍 Dia da semana: ${d.melhor_dia_semana} se destacou — como maximizar esse padrão
✅ Priorizar: padrão de corrida identificado nos top 3 dias que deve ser replicado
⚠️ Evitar: deslocamentos vazios (${fmt(d.km_vazio_total)} km = ${fmt((d.km_vazio_total / (d.km_total || 1)) * 100)}% do total) — custo estimado: R$ ${fmt(d.ganho_perdido_deslocamentos_longos)}

## PROJEÇÃO DO MÊS
${ehPassado
    ? `Título interno: "Lições de ${d.periodo_referencia} para ${d.periodo_atual}". Escreva 1 parágrafo com 2-3 ações concretas que o motorista deve implementar AGORA em ${d.periodo_atual} baseadas no que os dados de ${d.periodo_referencia} revelaram.`
    : `1 parágrafo com: projeção realista de fechamento, se a meta de R$ ${fmt(d.meta_mensal)} é alcançável, e o que precisa acontecer de concreto para chegar lá.`}

## DICA ESTRATÉGICA
1 parágrafo com dica de longo prazo baseada no histórico deste mês (não repetir recomendações acima).
"Sua Análise Personalizada" com os 3 blocos 🔴🟡🟢 em texto fluido com valores exatos fornecidos.
Última linha: "Ação para amanhã: [1 ação específica e imediatamente executável]."

Máximo 520 palavras. Sem introdução antes do ## RESUMO DO DIA.`;
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