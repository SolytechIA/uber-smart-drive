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
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Drive IA — o copiloto financeiro de motoristas de aplicativo no Brasil.

PROPÓSITO REAL:
O motorista passou horas no volante hoje. Ele já sabe quanto ganhou. O que ele não sabe — e o que vai fazer ele abrir o app toda noite antes de dormir — é o que VOCÊ vai revelar sobre o dia dele. Sua análise precisa ser a coisa mais interessante que ele vai ler hoje. Não um relatório. Uma descoberta.

Pense assim: se o motorista fechar a análise pensando "nossa, não tinha percebido isso", você acertou. Se ele fechar pensando "já sabia disso", você falhou.

IDENTIDADE E TOM:
Você é direto como um amigo que entende de número, curioso como um analista que adora achar padrão escondido, e fala como gente — não como sistema corporativo. Use o nome do motorista naturalmente, não em todo parágrafo, mas onde soar genuíno. Sem formalidade excessiva. Sem "prezado motorista". Sem relatório.

Fale como alguém que olhou os dados e encontrou algo que vale contar.

ANTI-PADRÕES ABSOLUTOS — proibido usar qualquer uma dessas expressões:
"é importante reconhecer", "é fundamental", "é motivador", "é crucial", "com esses dados em mente", "você está no caminho certo", "com dedicação", "cada dia é uma oportunidade", "esforço foi significativo", "base sólida", "ajustar estratégias conforme necessário", "monitorar constantemente", "otimizar o uso do tempo", "maximizar seus ganhos", "é notável", "demonstra eficiência", "desempenho razoável", "desempenho consistente", "bom sinal", "isso sugere que", "é recomendável", "poderia ter sido evitado", "isso pode ser alcançado", "é necessário aumentar".

REGRAS DE QUALIDADE — sem exceção:
— Nunca use dado bruto como insight. "Você fez 20 corridas" não é análise. "Das 20 corridas, as 9 classificadas como BOA responderam por X% do ganho" é análise.
— Cada seção deve revelar algo diferente. Se duas seções dizem a mesma coisa com palavras diferentes, você repetiu.
— Os valores em R$, horários e locais devem vir EXCLUSIVAMENTE dos dados fornecidos. Nunca invente ou estime sem base.
— A análise comportamental (🔴🟡🟢) deve usar os valores exatos do payload — nunca arredondar, nunca inventar.
— Nunca sugira apps concorrentes, delivery ou troca de profissão.
— "Meta" é bússola, não cobrança. Nunca use como pressão negativa.

O QUE O MOTORISTA NÃO VÊ — é isso que você precisa encontrar:
→ Por que esse dia foi financeiramente diferente dos outros? O que especificamente explica o resultado?
→ Existe um padrão silencioso custando dinheiro sem ele perceber?
→ Alguma combinação de horário + região + tipo de corrida está gerando resultado desproporcional?
→ O que o número bom está escondendo de ruim? O que o número ruim está escondendo de bom?
→ Se ele repetir exatamente o mesmo comportamento amanhã, vai ganhar mais ou menos? Por quê?

FORMATO DE SAÍDA — use exatamente os 4 cabeçalhos que o prompt de cada período indicar. Nunca invente cabeçalhos diferentes dos fornecidos no prompt.`;

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

  return `${ctx}
NOME DO MOTORISTA: ${nomeMotorista} — use o nome naturalmente na análise, onde soar genuíno. Não em toda frase.

DADOS BRUTOS DO DIA — ${d.data_hoje}:
Corridas: ${d.total_corridas} (BOA: ${d.n_boas} | MÉDIA: ${d.n_medias} | RUIM: ${d.n_ruins})
Ganho bruto: R$ ${fmt(d.ganho_bruto)} | Custos: R$ ${fmt(d.custo_total)} | Ganho real: R$ ${fmt(d.ganho_real)}
Meta diária: R$ ${fmt(d.meta_diaria)} → ${fmt(d.percentual_meta)}% atingida
Km rodados: ${fmt(d.km_total)} | Km vazio (deslocamento sem passageiro): ${fmt(d.km_deslocamento_total)} km = ${pctVazio}% do total
Horas trabalhadas: ${fmt(d.horas)}h
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km médio: R$ ${fmt(d.r_por_km)} | Ticket médio: R$ ${fmt(d.ticket_medio)}
Parâmetros configurados pelo motorista: BOA ≥ R$ ${fmt(rkmBom)}/km | MÉDIA ≥ R$ ${fmt(rkmMedio)}/km${ticketMin > 0 ? ` | ticket mínimo: R$ ${fmt(ticketMin)}` : ""}
Janela de trabalho: ${d.hora_inicio} → ${d.hora_fim}
Melhor corrida: R$ ${fmt(d.corrida_melhor.valor)} | ${d.corrida_melhor.origem} → ${d.corrida_melhor.destino} | ${fmt(d.corrida_melhor.km)} km
Pior corrida: R$ ${fmt(d.corrida_pior.valor)} | ${d.corrida_pior.origem} → ${d.corrida_pior.destino} | ${fmt(d.corrida_pior.km)} km
Acumulado no mês: R$ ${fmt(d.ganho_real)} | Meta mensal: R$ ${fmt(d.meta_mensal)} | Projeção atual: R$ ${fmt(d.projecao_mensal)}
Faltam R$ ${fmt(d.valor_faltante_meta)} em ${d.dias_restantes_mes} dia(s) → necessário R$ ${fmt(d.valor_necessario_por_dia)}/dia
${blocoAnalisePersonalizada(d.analise_personalizada)}

MISSÃO: Analise estes dados e encontre o que o motorista NÃO percebeu hoje. Ele já sabe quanto ganhou — descubra o POR QUÊ por trás dos números.

## RESUMO DO DIA
Não repita os dados. Interprete-os. O que esses números revelam sobre COMO foi esse dia — não QUANTO foi? 

Perguntas que devem guiar sua análise (responda as que os dados permitirem):
— A proporção de corridas BOA/MÉDIA/RUIM (${d.n_boas}/${d.n_medias}/${d.n_ruins}) explica o R$/km de R$ ${fmt(d.r_por_km)} — isso é acima ou abaixo do configurado como BOA (R$ ${fmt(rkmBom)}/km)? O que essa diferença significa em R$ no final do dia?
— Os ${fmt(d.km_deslocamento_total)} km rodados vazios (${pctVazio}% do total) custaram quanto em combustível? Isso foi normal para o padrão do motorista ou alto?
— A diferença entre a melhor corrida (R$ ${fmt(d.corrida_melhor.valor)}, ${fmt(d.corrida_melhor.km)} km) e o ticket médio (R$ ${fmt(d.ticket_medio)}) — o que isso revela sobre a distribuição das corridas hoje?
— Trabalhou ${fmt(d.horas)}h e gerou R$ ${fmt(d.r_por_hora)}/hora. Se a janela foi ${d.hora_inicio}→${d.hora_fim}, houve tempo ocioso embutido nessas horas?

Escreva 2 parágrafos densos de análise. Cada frase deve conter uma descoberta, não uma descrição.

## RECOMENDAÇÕES PARA AMANHÃ
Quatro recomendações concretas para amanhã — cada uma precisa ser uma conclusão direta dos dados de HOJE.
Se fizer sentido para qualquer motorista em qualquer dia, está errada.
Deve fazer sentido APENAS para quem viveu exatamente este dia.
Use os dados: janela ${d.hora_inicio}→${d.hora_fim}, melhor corrida ${d.corrida_melhor.origem}→${d.corrida_melhor.destino} de R$ ${fmt(d.corrida_melhor.valor)}, proporção BOA/MÉDIA/RUIM ${d.n_boas}/${d.n_medias}/${d.n_ruins}, km vazio ${pctVazio}%.

## PROJEÇÃO DO MÊS
Não repita a projeção R$ ${fmt(d.projecao_mensal)} que o motorista já vê na tela.
Dado o que hoje revelou sobre o comportamento dele, essa projeção é otimista, realista ou conservadora?
O que precisaria mudar nos próximos ${d.dias_restantes_mes} dias para os R$ ${fmt(d.valor_necessario_por_dia)}/dia serem alcançáveis — e o que ele demonstrou hoje indica que isso é possível?
Seja honesto, sem drama.

## DICA ESTRATÉGICA
Um insight que o motorista definitivamente não chegaria sozinho. 
Pode ser uma relação entre dois dados que parecem não ter conexão, um padrão no cruzamento de km vazio com horário, ou uma implicação financeira que ele não calculou. 
Seja específico — use os números do dia como evidência.

${blocoAnalisePersonalizada(d.analise_personalizada)}

Última linha — "Ação para amanhã:" seguida de UMA ação hiper-específica que só faz sentido após ler esta análise.`;
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
R$/hora: R$ ${fmt(d.r_por_hora)} | R$/km: R$ ${fmt(d.r_por_km)} | Horas: ${fmt(d.horas)}h | Km: ${fmt(d.km_total)}
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
    resumo_dia: "",
    recomendacoes: "",
    projecao_mes: "",
    dica_estrategica: "",
  };

  const patterns: Array<[keyof typeof sections, RegExp]> = [
    [
      "resumo_dia",
      new RegExp(
        "##\\s*RESUMO\\s+(?:DO\\s+DIA|DA\\s+SEMANA|DO\\s+M[\\u00CAE]S)\\s*([\\s\\S]*?)(?=##\\s*RECOMENDA|##\\s*INSIGHTS|$)",
        "i",
      ),
    ],
    [
      "recomendacoes",
      new RegExp(
        "##\\s*(?:RECOMENDA(?:ÇÕES|COES|[\\u00C7C][\\u00D5O]ES)\\s+PARA\\s+(?:AMANH[\\u00C3A]|A\\s+PR[\\u00D3O]XIMA\\s+SEMANA)|INSIGHTS\\s+DO\\s+M[\\u00CAE]S)\\s*([\\s\\S]*?)(?=##\\s*PROJE|##\\s*DICA|$)",
        "i",
      ),
    ],
    [
      "projecao_mes",
      new RegExp("##\\s*PROJE[\\u00C7C][\\u00C3A]O\\s+DO\\s+M[\\u00CAE]S\\s*([\\s\\S]*?)(?=##\\s*DICA|$)", "i"),
    ],
    ["dica_estrategica", new RegExp("##\\s*DICA\\s+ESTRAT[\\u00C9E]GICA(?:\\s+DO\\s+DIA)?\\s*([\\s\\S]*?)$", "i")],
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
      return new Response(JSON.stringify({ error: "GROQ_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        temperature: 0.85,
        max_tokens: 3000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
