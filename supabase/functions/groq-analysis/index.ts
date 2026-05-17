const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── INTERFACES ───────────────────────────────────────────────────────────────

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
  nome_motorista?: string;
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
  projecao_mensal: number | null;
  meta_mensal: number;
  dias_restantes_mes: number;
  valor_faltante_meta: number;
  valor_necessario_por_dia: number;
  dias_com_corridas_mes?: number;
  r_km_bom?: number;
  r_km_medio?: number;
  ticket_minimo?: number;
  tempo_medio_entre_corridas?: number;
  maior_intervalo_sem_corrida?: number;
  corridas_por_hora_efetiva?: number;
  pct_tempo_online_sem_corrida?: number;
  consumo_medio_km_l?: number;
  preco_combustivel?: number;
  tipo_combustivel?: string;
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
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function fmtHHMM(horasDecimal: number): string {
  if (!horasDecimal || horasDecimal <= 0) return "0:00";
  const h = Math.floor(horasDecimal);
  const m = Math.round((horasDecimal - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Drive IA — o coach de performance de motoristas de app mais direto e perspicaz do Brasil. Fale como um técnico esportivo no intervalo do jogo: sem rodeios, sem repetir o que o motorista já sabe, revelando o que ele não percebeu.

REGRAS ABSOLUTAS — NUNCA VIOLE:

FORMATO:
- Use bullets curtos (máx 2 linhas por bullet). PROIBIDO parágrafos corridos.
- Cada seção: máx 4 bullets ou 3 bullets + 1 frase de abertura impactante.
- PROIBIDO listar dados que o motorista já vê no dashboard (valores, totais, contagens).
- Use SEMPRE "você", "seu", "sua". NUNCA terceira pessoa.
- Use o nome do motorista apenas na primeira frase da análise completa. Depois só "você".
- Horas SEMPRE no formato hh:mm (ex: 1:23, não 1,38h).

CONTEÚDO:
- Cada bullet deve conter UMA descoberta que o motorista não chegaria sozinho.
- Se houver histórico anterior, OBRIGATORIAMENTE compare: "Na semana passada X, hoje Y — diferença de Z%".
- A última linha de TODA análise deve ser: "⚡ Ação para agora:" seguida de 1 ação executável imediata.
- A dica estratégica deve cruzar pelo menos 2 variáveis que parecem não ter relação direta.

TOM por seção:
- RESUMO: analítico, sem elogios. Cada frase = uma revelação.
- RECOMENDAÇÕES: imperativo direto. "Faça X porque Y — vale R$ Z."
- PROJEÇÃO: honesto, sem drama. Números reais, cenário alcançável.
- DICA ESTRATÉGICA: surpreendente. Se não fizer o motorista pensar "caramba, não tinha notado", reescreva.

FORMATO DE SAÍDA: use exatamente os cabeçalhos ## fornecidos em cada prompt. Nunca invente cabeçalhos diferentes.

REGRAS DE LINGUAGEM (OBRIGATÓRIAS):
- Nunca repita o mesmo valor numérico mais de 2x no mesmo bloco.
- Nunca use frases genéricas como "o que é alto para", "o que pode indicar", "o que é alcançável se".
- Seja direto e afirmativo.
- Cada recomendação deve ter: O QUÊ fazer + POR QUÊ esse número importa + QUANTO vale em reais.
- Máximo 2 linhas por recomendação.
- Na Dica Estratégica: identificar o COMPORTAMENTO específico que diferenciou o melhor do pior momento do dia.
- Não usar porcentagens genéricas. Use dados reais.
- A seção "Ação para agora" deve ser uma instrução única, curta (máx 1 linha), acionável imediatamente e sem condicionais.
- Nunca encerrar com: "dependendo da demanda", "se você conseguir", "considerando que".
- Termine sempre com afirmação concreta.
- Tom: direto, como gestor de operações que quer resultado real.
- Não é coach de vida. É analista de dados que respeita o tempo do motorista.
- NUNCA use a palavra "vale" seguida de valor monetário (ex: "vale R$ 488", "vale aprox."). O impacto financeiro deve ser integrado naturalmente na frase como análise, não como rótulo.
- Quando os dados do dia forem limitados (1 corrida, < 30 min online), reconheça isso em 1 frase e foque 100% das recomendações no que é possível concluir com os dados disponíveis. Não invente padrões que não existem.

REGRAS DE QUALIDADE DA ANÁLISE:
- Não reescreva os dados que já estão no dashboard. Interprete o que os dados significam.
- Não use frases como "isso mostra", "isso indica", "é importante destacar", "é fundamental", "há espaço para melhoria", "com ajustes estratégicos". Isso é genérico e reduz valor percebido.
- Não elogie, motive ou console sem evidência concreta nos dados.
- Se citar um número, explique por que ele importa operacionalmente.
- Evite duplicidade de ideia entre RESUMO, RECOMENDAÇÕES, PROJEÇÃO e DICA ESTRATÉGICA. Cada seção deve acrescentar algo novo.
- Nunca repetir a mesma recomendação em mais de uma seção.
- Nunca transformar os blocos ELIMINAR, MANTER e MELHORAR em lista de conselhos genéricos. Eles devem aparecer como padrões descobertos nos dados.
- Quando houver contexto temporal de período passado, fale do período no passado e extraia lições para o período atual.
- Quando o período estiver em andamento, priorize leitura de ritmo, tendência e alavanca de melhoria.
- Se faltar dado para alguma inferência, não invente. Omita a inferência e siga para outra descoberta real.
- O motorista deve terminar a leitura pensando: "isso eu não tinha percebido sozinho".
- A análise deve soar como inteligência operacional premium, não como resumo automático.`;

function buildHistoricoTexto(historico: any, historicoSemanal?: any): string {
  let out = "";
  if (Array.isArray(historico) && historico.length > 0) {
    const linhas = historico
      .map((h: any) => {
        const ganho = typeof h?.ganho_real === "number" ? h.ganho_real.toFixed(2) : "—";
        const corridas = h?.corridas ?? "—";
        const resumo = (h?.resumo || "").toString().replace(/\s+/g, " ").trim();
        return `- ${h?.data || "?"}: ${corridas} corridas, R$${ganho} ganho. Resumo: ${resumo}`;
      })
      .join("\n");
    out += `\n\nHISTÓRICO DE ANÁLISES ANTERIORES (use para comparar evolução/regressão):\n${linhas}`;
  }
  if (Array.isArray(historicoSemanal) && historicoSemanal.length > 0) {
    const linhas = historicoSemanal
      .map((h: any) => {
        const ganho = typeof h?.ganho_real === "number" ? h.ganho_real.toFixed(2) : "—";
        const rh = typeof h?.r_por_hora === "number" ? h.r_por_hora.toFixed(2) : "—";
        return `- Semana de ${h?.data || "?"}: ${h?.corridas ?? "—"} corridas, R$${ganho} ganho real, R$${rh}/h`;
      })
      .join("\n");
    out += `\n\nSEMANAS ANTERIORES (contexto de tendência):\n${linhas}`;
  }
  return out;
}

// ─── CONTEXTO TEMPORAL ───────────────────────────────────────────────────────

function instrucaoContextoMes(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "mes_passado") {
    return `CONTEXTO TEMPORAL: ${periodo_ref} está COMPLETAMENTE ENCERRADO. Use apenas linguagem de passado para ele.
O mês atual é ${periodo_atual}. Qualquer recomendação de ação futura deve referenciar ${periodo_atual} explicitamente.
Na seção PROJEÇÃO DO MÊS: escreva "O que ${periodo_ref} revelou para ${periodo_atual}:" seguido de descobertas concretas extraídas dos dados — não conselhos genéricos.`;
  }
  if (ctx === "mes_atual_iniciante") {
    return `CONTEXTO TEMPORAL: ${periodo_atual} está começando — ${dias} dias registrados. Dados ainda limitados.
Analise o ritmo atual sem comparar negativamente com meses anteriores. O que esses primeiros dias revelam sobre o padrão que está se formando?`;
  }
  if (ctx === "mes_atual_andamento") {
    return `CONTEXTO TEMPORAL: ${periodo_atual} em andamento — ${dias} dias registrados. Dados suficientes para análise real.
O mês está na metade do caminho: o que os dados já mostram sobre o que vai definir o fechamento?`;
  }
  if (ctx === "mes_atual_concluido") {
    return `CONTEXTO TEMPORAL: ${periodo_atual} praticamente encerrado — ${dias} dias trabalhados.
Análise de fechamento: o que o mês inteiro revelou? Na seção PROJEÇÃO DO MÊS, prepare o próximo mês com base nas descobertas deste.`;
  }
  return `CONTEXTO TEMPORAL: Análise do mês ${periodo_ref}.`;
}

function instrucaoContextoSemana(ctx: string, periodo_ref: string, periodo_atual: string, dias: number): string {
  if (ctx === "semana_passada") {
    return `CONTEXTO TEMPORAL: A semana ${periodo_ref} encerrou. A semana atual é ${periodo_atual}.
Use passado para ${periodo_ref}. O que essa semana revelou que muda o comportamento a partir de hoje?`;
  }
  if (ctx === "semana_atual_iniciante") {
    return `CONTEXTO TEMPORAL: Semana recém começada — ${dias} dias registrados. Que padrão inicial está se formando e o que ele sugere para os próximos dias?`;
  }
  return `CONTEXTO TEMPORAL: Semana em andamento — ${dias} dias. O que os dados já mostram sobre como esta semana vai fechar?`;
}

function instrucaoContextoDia(ctx: string, periodo_ref: string, periodo_atual: string): string {
  if (ctx === "dia_passado") {
    return `CONTEXTO TEMPORAL: Você está analisando ${periodo_ref}, dia já encerrado. Hoje é ${periodo_atual}.
Use passado para ${periodo_ref}. Na seção PROJEÇÃO DO MÊS, o acumulado é até ${periodo_atual}.`;
  }
  return `CONTEXTO TEMPORAL: Análise do dia ${periodo_atual}.`;
}

// ─── BLOCO COMPORTAMENTAL ────────────────────────────────────────────────────

function blocoAnalisePersonalizada(ap?: AnalisePersonalizada): string {
  if (!ap) return "";
  return `
DADOS COMPORTAMENTAIS CALCULADOS — use na seção DICA ESTRATÉGICA:
Comportamento a eliminar: "${ap.eliminar.titulo}" — ${ap.eliminar.descricao} — impacto nos dados: R$ ${fmt(ap.eliminar.impacto_rs)}
Comportamento que está funcionando: "${ap.manter.titulo}" — ${ap.manter.descricao} — diferença identificada: R$ ${fmt(ap.manter.impacto_rs)}
Oportunidade não aproveitada: "${ap.melhorar.titulo}" — ${ap.melhorar.descricao} — potencial calculado: R$ ${fmt(ap.melhorar.impacto_rs)}

INSTRUÇÃO PARA OS 3 BLOCOS: NÃO escreva como lista de tarefas ou instruções. Escreva cada um como uma descoberta — algo que o motorista não percebeu e que os dados revelam. O valor em R$ é a evidência, não o título. A frase deve fazer o motorista pensar "caramba, não tinha notado isso".`;
}

// ─── PROMPTS ─────────────────────────────────────────────────────────────────

function buildPromptDia(d: PayloadDia): string {
  const rkmBom = Number(d.r_km_bom || 0);
  const rkmMedio = Number(d.r_km_medio || 0);
  const ticketMin = Number(d.ticket_minimo || 0);
  const pctVazio = d.km_total > 0 ? fmt((d.km_deslocamento_total / d.km_total) * 100) : "0,00";
  const ctx = instrucaoContextoDia(
    d.contexto_temporal || "dia_atual",
    d.periodo_referencia || d.data_hoje,
    d.periodo_atual || d.data_hoje,
  );

  const nomeMotorista = d.nome_motorista ? d.nome_motorista : "o motorista";

  const tempoOcioso = d.tempo_medio_entre_corridas
    ? `Intervalo médio entre corridas: ${d.tempo_medio_entre_corridas.toFixed(0)} min | Maior pausa: ${(d.maior_intervalo_sem_corrida || 0).toFixed(0)} min`
    : "";
  const eficiencia = d.corridas_por_hora_efetiva
    ? `Corridas por hora efetiva: ${d.corridas_por_hora_efetiva.toFixed(1)} | Tempo online sem corrida: ${(d.pct_tempo_online_sem_corrida || 0).toFixed(0)}%`
    : "";

  return `${ctx}
NOME DO MOTORISTA: ${nomeMotorista} — use o nome naturalmente na análise, onde soar genuíno. Não em toda frase.

DADOS BRUTOS DO DIA — ${d.data_hoje}:
Corridas: ${d.total_corridas} (BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins})
Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Custos: R$ ${fmt(d.custo_total)} | Ganho real: R$ ${fmt(d.ganho_real)}
Meta diária: R$ ${fmt(d.meta_diaria)} → ${fmt(d.percentual_meta)}% atingida
Km rodados: ${fmt(d.km_total)} | Km vazio (deslocamento sem passageiro): ${fmt(d.km_deslocamento_total)} km = ${pctVazio}% do total
${d.consumo_medio_km_l ? `Dados do veículo cadastrado: consumo médio ${fmt(d.consumo_medio_km_l)} km/l | preço combustível R$ ${fmt(d.preco_combustivel || 0)}/l${d.tipo_combustivel ? ` | combustível: ${d.tipo_combustivel}` : ""}` : "Dados do veículo: não cadastrados pelo motorista."}
${d.consumo_medio_km_l && d.preco_combustivel ? `Custo real por km rodado: R$ ${fmt(d.preco_combustivel / d.consumo_medio_km_l)} | Custo estimado do deslocamento vazio hoje: R$ ${fmt((d.km_deslocamento_total || 0) * (d.preco_combustivel / d.consumo_medio_km_l))}` : ""}
REGRA ANTI-ALUCINAÇÃO: Use APENAS os dados fornecidos acima para cálculos de combustível. Se "Dados do veículo: não cadastrados", NÃO estime consumo nem preço — diga apenas "configure seu veículo em Config para cálculos precisos de combustível".
Horas trabalhadas: ${fmtHHMM(d.horas)}
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km médio: R$ ${fmt(d.r_por_km)} | Ticket médio: R$ ${fmt(d.ticket_medio)}
Parâmetros configurados pelo motorista: BOA ≥ R$ ${fmt(rkmBom)}/km | MÉDIA ≥ R$ ${fmt(rkmMedio)}/km${ticketMin > 0 ? ` | ticket mínimo: R$ ${fmt(ticketMin)}` : ""}
Janela de trabalho: ${d.hora_inicio} → ${d.hora_fim}
${tempoOcioso ? `Tempo ocioso: ${tempoOcioso}` : ""}
${eficiencia ? `Eficiência de jornada: ${eficiencia}` : ""}
Melhor corrida: R$ ${fmt(d.corrida_melhor.valor)} | ${d.corrida_melhor.origem} → ${d.corrida_melhor.destino} | ${fmt(d.corrida_melhor.km)} km
Pior corrida: R$ ${fmt(d.corrida_pior.valor)} | ${d.corrida_pior.origem} → ${d.corrida_pior.destino} | ${fmt(d.corrida_pior.km)} km
Acumulado no mês: R$ ${fmt(d.ganho_real)} | Meta mensal: R$ ${fmt(d.meta_mensal)}
${
  d.projecao_mensal != null && d.projecao_mensal > 0
    ? `Projeção atual: R$ ${fmt(d.projecao_mensal)}\nFaltam R$ ${fmt(d.valor_faltante_meta)} em ${d.dias_restantes_mes} dia(s) → necessário R$ ${fmt(d.valor_necessario_por_dia)}/dia`
    : `Dias com corridas no mês: ${d.dias_com_corridas_mes ?? 0} — dados insuficientes para projeção confiável.`
}
${blocoAnalisePersonalizada(d.analise_personalizada)}

MISSÃO: Encontre o que o motorista NÃO percebeu hoje. Ele já sabe quanto ganhou. Descubra o POR QUÊ e o QUANTO ficou na mesa.

SEMENTE PSICOLÓGICA — inclua no resumo ou nas recomendações, de forma natural (não forçada):
O motorista que gera análise perto do fim do dia ainda pode agir. Se o dia ainda não acabou, destaque UMA oportunidade concreta para a próxima hora. Se o dia encerrou, mostre quanto teria mudado com 1 corrida a mais no horário de pico identificado. O objetivo é fazer o motorista pensar: "vou gerar isso todo dia antes de encerrar."

## RESUMO DO DIA
Formato: 1 frase de abertura impactante (o que os números escondem) + 3 bullets de revelação.
Cada bullet deve responder uma destas perguntas com os dados reais:
• Os ${d.km_deslocamento_total ? fmt(d.km_deslocamento_total) : "?"}km vazios (${pctVazio}% do total) custaram quanto em combustível? Isso é normal ou alto para este motorista?
• A diferença entre corridas BOA e MÉDIA em R$/km — quanto isso representa em reais no total do dia?
• O tempo entre corridas — havia janelas ociosas que coincidem com horários de alta demanda?
• Se houve intervalo longo sem corrida: em qual horário foi? O que estava acontecendo?

## RECOMENDAÇÕES PARA AMANHÃ
Formato: exatamente 4 bullets numerados. Cada um: 1 ação + motivo em dados.
Estrutura de cada bullet: "N. [Verbo de ação] [especificidade] — porque [dado do dia]."
PROIBIDO recomendação que qualquer motorista poderia receber sem ler esta análise.

## PROJEÇÃO DO MÊS
Formato: 3 bullets.
• Bullet 1: projeção realista com o ritmo atual (não repita o número que o motorista já vê).
• Bullet 2: o que precisaria mudar para fechar a meta — expresso em corridas/dia ou horas/dia, não em R$.
• Bullet 3: com base no que hoje revelou, isso é alcançável? Seja honesto em 1 frase.

## DICA ESTRATÉGICA
Formato: 1 bullet de abertura (o insight) + 2 bullets de evidência + 1 bullet de implicação financeira.
Cruzar obrigatoriamente pelo menos 2 destas variáveis: horário × classificação, km_vazio × período do dia, intervalo entre corridas × valor da corrida seguinte, janela de trabalho × R$/km.
Exemplo do padrão esperado: "Suas 3 corridas BOA aconteceram nas 40 min após as pausas curtas (≤5 min). Após pausas longas (+15 min), R$/km caiu 32%. Cada pausa longa desnecessária custou R$ X em média."

${blocoAnalisePersonalizada(d.analise_personalizada)}

Última linha — "⚡ Ação para agora:" seguida de UMA ação hiper-específica que só faz sentido após ler esta análise.`;
}

function buildPromptSemana(d: PayloadSemana): string {
  const semDadosComparativo = d.semana_anterior.corridas < 5;
  const diferencaGanho = d.ganho_real - d.semana_anterior.ganho_real;
  const pctVariacao =
    d.semana_anterior.ganho_real > 0 ? fmt((diferencaGanho / d.semana_anterior.ganho_real) * 100) : "N/A";
  const difCorridas = d.total_corridas - d.semana_anterior.corridas;
  const ctx = instrucaoContextoSemana(
    d.contexto_temporal || "semana_atual_andamento",
    d.periodo_referencia || d.rotulo_periodo,
    d.periodo_atual || "esta semana",
    d.dias_com_corridas || 0,
  );
  const nomeMotorista = d.nome_motorista ? d.nome_motorista : "o motorista";

  return `${ctx}
NOME DO MOTORISTA: ${nomeMotorista} — use o nome naturalmente na análise, onde soar genuíno. Não em toda frase.

DADOS BRUTOS DA SEMANA — ${d.rotulo_periodo}:
Corridas: ${d.total_corridas} | Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)}
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Horas: ${fmtHHMM(d.horas)} | Km: ${fmt(d.km_total)}
Meta semanal: R$ ${fmt(d.meta_semanal)} → ${fmt(d.percentual_meta)}% atingida
Melhor dia: ${d.melhor_dia.rotulo} — R$ ${fmt(d.melhor_dia.valor)}
Pior dia: ${d.pior_dia.rotulo} — R$ ${fmt(d.pior_dia.valor)}
Diferença melhor/pior dia: R$ ${fmt(d.melhor_dia.valor - d.pior_dia.valor)}
Horário mais rentável: ${d.hora_pico} → R$ ${fmt(d.rkm_hora_pico)}/km
${
  !semDadosComparativo
    ? `Semana anterior: ${d.semana_anterior.corridas} corridas | R$ ${fmt(d.semana_anterior.ganho_real)} real | R$/h ${fmt(d.semana_anterior.r_por_hora)} | R$/km ${fmt(d.semana_anterior.r_por_km)}
Variação no ganho real: ${diferencaGanho >= 0 ? "+" : ""}R$ ${fmt(diferencaGanho)} (${pctVariacao}%) | Corridas a mais/menos: ${difCorridas >= 0 ? "+" : ""}${difCorridas}`
    : "Semana anterior: dados insuficientes para comparativo."
}
${blocoAnalisePersonalizada(d.analise_personalizada)}

MISSÃO: O motorista já viu os cards com os números desta semana. Ele sabe que fez ${d.total_corridas} corridas e ganhou R$ ${fmt(d.ganho_real)}. O que ele ainda NÃO sabe — e você precisa encontrar nos dados?

## RESUMO DA SEMANA
Não liste o que aconteceu. Explique o que os dados revelam sobre COMO esta semana foi construída. 
O que fez o ${d.melhor_dia.rotulo} (R$ ${fmt(d.melhor_dia.valor)}) ser tão diferente do ${d.pior_dia.rotulo} (R$ ${fmt(d.pior_dia.valor)}) — diferença de R$ ${fmt(d.melhor_dia.valor - d.pior_dia.valor)}? 
O horário ${d.hora_pico} rendeu R$ ${fmt(d.rkm_hora_pico)}/km contra uma média de R$ ${fmt(d.r_por_km)}/km — esse diferencial foi aproveitado ou desperdiçado? ${!semDadosComparativo ? `Mais ${Math.abs(difCorridas)} corridas que a semana passada geraram ${diferencaGanho >= 0 ? "mais" : "menos"} R$ ${fmt(Math.abs(diferencaGanho))} — o que isso diz sobre eficiência real?` : ""} Dois parágrafos densos. Cada frase deve ser uma análise, não uma descrição.

## RECOMENDAÇÕES PARA A PRÓXIMA SEMANA
Quatro recomendações diretas dos padrões desta semana — genérico não serve. 
Use os dados: horário pico ${d.hora_pico} a R$ ${fmt(d.rkm_hora_pico)}/km, melhor dia ${d.melhor_dia.rotulo}, pior dia ${d.pior_dia.rotulo}, diferença entre eles R$ ${fmt(d.melhor_dia.valor - d.pior_dia.valor)}.

## PROJEÇÃO DO MÊS
No ritmo desta semana, onde o mês vai fechar? Qual variável específica tem mais poder de mudar essa projeção? Se o padrão do ${d.melhor_dia.rotulo} for replicado mais vezes, quanto muda o fechamento? 
Termine com uma ação para os próximos 3 dias.

## DICA ESTRATÉGICA
Um insight que só aparece quando você olha para a semana inteira — não para dias isolados. 
Algo que cruza dois dados que parecem não ter relação direta.

${blocoAnalisePersonalizada(d.analise_personalizada)}

Última linha — "Ação para esta semana:" seguida de UMA ação específica que só faz sentido após ler esta análise semanal.`;
}

function buildPromptMes(d: PayloadMes): string {
  const top3 = d.top3_dias.map((t) => `${t.rotulo} (R$ ${fmt(t.valor)})`).join(", ");
  const pctVazio = fmt((d.km_vazio_total / (d.km_total || 1)) * 100);
  const mediaTop3 = d.top3_dias.length > 0 ? d.top3_dias.reduce((s, t) => s + t.valor, 0) / d.top3_dias.length : 0;
  const diferencaMesAnterior = d.ganho_real - d.mes_anterior.ganho_real;
  const ehPassado = d.contexto_temporal === "mes_passado";
  const ctx = instrucaoContextoMes(
    d.contexto_temporal || "mes_atual_andamento",
    d.periodo_referencia || d.rotulo_periodo,
    d.periodo_atual || "este mês",
    d.dias_com_corridas || d.dias_trabalhados,
  );
  const nomeMotorista = d.nome_motorista ? d.nome_motorista : "o motorista";

  return `${ctx}
NOME DO MOTORISTA: ${nomeMotorista} — use o nome naturalmente na análise, onde soar genuíno. Não em toda frase.

DADOS BRUTOS DO MÊS — ${d.rotulo_periodo}:
Dias trabalhados: ${d.dias_trabalhados} | Corridas: ${d.total_corridas} | Média: ${fmt(d.total_corridas / (d.dias_trabalhados || 1))} corridas/dia
Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Ganho real: R$ ${fmt(d.ganho_real)} | Média diária: R$ ${fmt(d.ganho_real / (d.dias_trabalhados || 1))}
Meta mensal: R$ ${fmt(d.meta_mensal)} → ${fmt(d.percentual_meta)}% atingida
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)}
Km total: ${fmt(d.km_total)} | Km vazio: ${fmt(d.km_vazio_total)} (${pctVazio}% do total)
Top 3 dias: ${top3} | Média dos top 3: R$ ${fmt(mediaTop3)}
Horário mais rentável: ${d.hora_pico} | Melhor dia da semana: ${d.melhor_dia_semana}
Custo dos deslocamentos longos: R$ ${fmt(d.ganho_perdido_deslocamentos_longos)}
Mês anterior: ${d.mes_anterior.corridas} corridas | R$ ${fmt(d.mes_anterior.ganho_real)} real | R$/h ${fmt(d.mes_anterior.r_por_hora)} | R$/km ${fmt(d.mes_anterior.r_por_km)} | ${d.mes_anterior.dias_trabalhados} dias
Variação vs mês anterior: ${diferencaMesAnterior >= 0 ? "+" : ""}R$ ${fmt(diferencaMesAnterior)}
${blocoAnalisePersonalizada(d.analise_personalizada)}

MISSÃO: O motorista passou o mês inteiro trabalhando e já viu os totais. O que os dados deste mês revelam que ele não conseguiria descobrir sozinho? Qual é o padrão que ficou escondido no meio de 30 dias de rotina?

## RESUMO DO MÊS
Não resuma — interprete. O que os números revelam sobre como este mês foi construído? 
Os top 3 dias (${top3}) respondem por quanto % do ganho total? A média diária de R$ ${fmt(d.ganho_real / (d.dias_trabalhados || 1))} vs a média dos top 3 (R$ ${fmt(mediaTop3)}) — qual é o teto real deste motorista e quantos dias chegaram perto? 
O ${d.melhor_dia_semana} como melhor dia da semana é estrutural ou comportamental? ${ehPassado ? `R$/km ${fmt(d.r_por_km)} vs mês anterior ${fmt(d.mes_anterior.r_por_km)} — eficiência melhorou ou piorou?` : `No ritmo atual de R$ ${fmt(d.r_por_hora)}/hora em ${d.dias_trabalhados} dias, onde fecha o mês?`} Dois ou três parágrafos densos.

## INSIGHTS DO MÊS
Quatro insights baseados nos padrões deste mês — não valem conselhos que qualquer motorista já conhece. 
Use os dados: horário pico ${d.hora_pico}, melhor dia da semana ${d.melhor_dia_semana}, top 3 dias ${top3}, km vazio ${pctVazio}% do total, R$ ${fmt(d.ganho_perdido_deslocamentos_longos)} perdidos em deslocamentos longos.

## PROJEÇÃO DO MÊS
${
  ehPassado
    ? `O que ${d.periodo_referencia} revelou que muda o comportamento em ${d.periodo_atual}: descobertas específicas extraídas dos dados — padrões escondidos, custos que passaram despercebidos, oportunidades não aproveitadas. Três coisas concretas que o motorista não viu.`
    : `Com R$ ${fmt(d.ganho_real)} em ${d.dias_trabalhados} dias (R$ ${fmt(d.ganho_real / (d.dias_trabalhados || 1))}/dia médio), o fechamento mais provável é quanto? A meta de R$ ${fmt(d.meta_mensal)} está ao alcance no ritmo atual? Qual variável específica tem mais poder de mudar essa projeção?`
}

## DICA ESTRATÉGICA
Um padrão que só aparece quando você olha o mês inteiro — não dias isolados. 
Algo que o motorista não perceberia sem cruzar dados de semanas diferentes.

${blocoAnalisePersonalizada(d.analise_personalizada)}

Última linha — "Ação para amanhã:" seguida de UMA ação concreta que só faz sentido após ler esta análise mensal.`;
}

// ─── ORQUESTRAÇÃO ─────────────────────────────────────────────────────────────

function buildPrompt(p: Payload): string {
  if ((p as any).periodo === "semana") return buildPromptSemana(p as PayloadSemana);
  if ((p as any).periodo === "mes") return buildPromptMes(p as PayloadMes);
  return buildPromptDia(p as PayloadDia);
}

function splitSections(text: string) {
  const sections = {
    resumodia: "",
    recomendacoes: "",
    projecaomes: "",
    dicaestrategica: "",
  };

  const patterns: Array<[keyof typeof sections, RegExp]> = [
    ["resumodia", /(?:^|\n)\s*#{0,3}\s*(RESUMO DO DIA|RESUMO DA SEMANA|RESUMO DO M[ÊE]S|INSIGHTS DO M[ÊE]S)\s*\n/i],
    [
      "recomendacoes",
      /(?:^|\n)\s*#{0,3}\s*(RECOMENDA[ÇC][ÕO]ES PARA AMANH[ÃA]|RECOMENDA[ÇC][ÕO]ES PARA A PR[ÓO]XIMA SEMANA|RECOMENDA[ÇC][ÕO]ES)\s*\n/i,
    ],
    ["projecaomes", /(?:^|\n)\s*#{0,3}\s*(PROJE[ÇC][ÃA]O DO M[ÊE]S|PROJE[ÇC][ÃA]O SEMANAL)\s*\n/i],
    ["dicaestrategica", /(?:^|\n)\s*#{0,3}\s*(DICA ESTRAT[ÉE]GICA(?:\s*DO DIA)?|INSIGHTS? DO M[ÊE]S)\s*\n/i],
  ];

  const hits: Array<{ key: keyof typeof sections; start: number }> = [];
  for (const [key, re] of patterns) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      hits.push({ key, start: m.index + m[0].length });
    }
  }
  hits.sort((a, b) => a.start - b.start);

  for (let i = 0; i < hits.length; i++) {
    const nextStart = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const prevNewline = text.lastIndexOf("\n\n", nextStart - 1);
    const cutAt = prevNewline > hits[i].start ? prevNewline : nextStart;
    sections[hits[i].key] = text.slice(hits[i].start, cutAt).trim();
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
      return new Response(JSON.stringify({ error: "GROQ_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload & { historico_analises?: any; historico_semanal?: any };
    const userPrompt = buildPrompt(payload);
    const systemContent =
      SYSTEM_PROMPT + buildHistoricoTexto((payload as any).historico_analises, (payload as any).historico_semanal);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.85,
        max_tokens: 3000,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error:", groqRes.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao chamar Groq", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
