import { Link } from "react-router-dom";
import {
  BarChart3,
  Activity,
  FileText,
  Brain,
  Target,
  Wallet,
  Sparkles,
  Check,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MP_SUBSCRIBE_URL } from "@/hooks/usePlanStatus";

const features = [
  { icon: Wallet, title: "Dashboard Financeiro", desc: "Acompanhe receitas, despesas, resultado líquido e extrato analítico em um só lugar." },
  { icon: Activity, title: "Dashboard Operacional", desc: "Registre corridas de qualquer plataforma e acompanhe sua operação diária." },
  { icon: Target, title: "Painel de Cards", desc: "Veja indicadores financeiros e operacionais que ajudam a medir performance e identificar melhorias." },
  { icon: BarChart3, title: "Gráficos Financeiros", desc: "Analise evolução do resultado, composição de receitas e custos e ticket médio por plataforma." },
  { icon: TrendingUp, title: "Gráficos de Performance", desc: "Compare R$/hora, R$/km, qualidade das corridas e eficiência operacional por período." },
  { icon: Brain, title: "Análise por IA", desc: "Receba recomendações práticas, projeções e sinais ocultos para agir com mais inteligência." },
];

const steps = [
  { n: "1", title: "Configure seu veículo e parâmetros de custo", desc: "Informe seus custos fixos, metas e dados do veículo. O Drive IA calcula projeções de custo para apoiar sua operação." },
  { n: "2", title: "Registre suas corridas e lançamentos", desc: "Adicione corridas rapidamente de qualquer plataforma, lance receitas extras e despesas avulsas com poucos toques, mesmo em movimento." },
  { n: "3", title: "Receba análises e acompanhe seu resultado", desc: "Nossa IA analisa seu histórico e entrega recomendações personalizadas. Acompanhe seu demonstrativo financeiro completo com receitas, despesas e resultado líquido real." },
];

const faqs: { q: string; a: string }[] = [
  { q: "O período gratuito exige cartão de crédito?", a: "Não. O trial de 7 dias é 100% gratuito e não requer nenhum dado de pagamento. Basta criar sua conta e começar a usar imediatamente." },
  { q: "Como funciona o pagamento do Plano Pro?", a: "O pagamento é recorrente mensal via Pix ou cartão de crédito, processado com segurança pelo Mercado Pago. Você pode cancelar a qualquer momento, sem multa." },
  { q: "O que muda quando o período gratuito terminar?", a: "Ao final dos 7 dias, o acesso ao Drive IA é pausado até você assinar o Plano Pro. Seus dados ficam salvos e ficam disponíveis integralmente assim que você ativar a assinatura." },
  { q: "O que acontece com meus dados se eu cancelar?", a: "Seus dados ficam armazenados com segurança por 30 dias após o cancelamento. Durante esse período você pode reativar sua conta e retomar exatamente de onde parou." },
  { q: "Por que a análise por IA tem limite de 1 por hora?", a: "A análise é gerada por inteligência artificial com base em todos os seus dados do período e requer processamento computacional. O intervalo de 1 hora garante qualidade na resposta e disponibilidade para todos os usuários." },
  { q: "Meus dados ficam seguros?", a: "Sim. Todos os seus dados são armazenados com criptografia e nunca são compartilhados com terceiros. Você pode solicitar a exclusão dos seus dados a qualquer momento pelo e-mail contato.solytech@gmail.com." },
  { q: "O Drive IA funciona para outros aplicativos além da Uber?", a: "Sim. O Drive IA foi desenvolvido para motoristas de aplicativo em geral. Funciona com Uber, 99, InDrive, corridas particulares e qualquer outra plataforma. Ao registrar a corrida, você escolhe a plataforma usada e o sistema organiza seus resultados automaticamente." },
  { q: "Como registro minhas corridas no Drive IA?", a: "De forma simples e rápida, pelo botão de adicionar na tela principal. Informe a plataforma, horário, valor, km e origem/destino. Leva menos de 30 segundos." },
  { q: "Posso lançar outras receitas além de corridas?", a: "Sim. Você pode lançar gorjetas, corridas particulares, transferências e outras receitas diretamente no demonstrativo financeiro." },
  { q: "Como funciona o controle de despesas?", a: "Você pode acompanhar parâmetros de custo na configuração e lançar despesas efetivas no financeiro, como combustível, estacionamento, pedágio, manutenção, passe da plataforma e outros gastos do dia a dia." },
  { q: "O que é o Demonstrativo Financeiro?", a: "É um resumo completo das suas receitas e despesas no período, com visão analítica por conta e extrato detalhado de todos os lançamentos." },
  { q: "Posso lançar provisões futuras?", a: "Sim. O sistema permite lançar receitas e despesas futuras para facilitar o planejamento e a projeção do período." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Você pode cancelar sua assinatura a qualquer momento diretamente pelo Mercado Pago, sem burocracia e sem multa. O acesso continua ativo até o fim do período pago." },
  { q: "Como entro em contato com o suporte?", a: "O suporte é realizado exclusivamente por e-mail através do endereço contato.solytech@gmail.com. Respondemos em até 1 dia útil." },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <a href="#planos" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Planos</a>
            <a href="#faq" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">FAQ</a>
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm" className="gradient-bg">Começar grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            <Badge variant="outline" className="mb-4 w-fit border-primary/30 bg-primary/5 text-primary">
              Uber · 99 · InDrive · Qualquer plataforma
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Transforme cada corrida em <span className="gradient-text">resultado real</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Painel inteligente para motoristas de aplicativo. Funciona com Uber, 99, InDrive e qualquer plataforma. Controle suas receitas, acompanhe suas despesas, visualize seu resultado e tome decisões com inteligência artificial.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Cadastre-se, registre corridas, receitas e despesas, e acompanhe sua operação financeira com clareza.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/cadastro">
                <Button size="lg" className="w-full gradient-bg sm:w-auto">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Ver como funciona
                </Button>
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Veja suas receitas, despesas, gráficos e análise da IA em um só lugar.
            </p>
          </div>

          {/* Mock visual */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card/60 p-6 shadow-2xl backdrop-blur">
              <div className="absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-primary/40 to-accent/40 opacity-60 blur-2xl" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Hoje</span>
                  <Badge className="bg-primary/15 text-primary">Pro</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Receita bruta</p>
                    <p className="text-2xl font-bold gradient-text">R$ 312,40</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Corridas</p>
                    <p className="text-2xl font-bold">14</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">R$/km</p>
                    <p className="text-2xl font-bold">2,18</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">R$/hora</p>
                    <p className="text-2xl font-bold">38,90</p>
                  </Card>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Brain className="h-4 w-4" /> Análise IA
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Você bateu 87% da meta diária. Concentre-se entre 18h e 21h
                    para maximizar seu R$/hora.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Como o Drive IA funciona</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <Card key={s.n} className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-bg text-2xl font-bold text-primary-foreground shadow-glow">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section className="border-t border-border/40 bg-card/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
            Tudo que você precisa em um só lugar
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="p-6 transition hover:border-primary/40 hover:shadow-glow">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
            Benefícios
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              "Controle suas receitas e despesas com clareza.",
              "Lance corridas, receitas e despesas em poucos segundos.",
              "Visualize seu desempenho por período, por plataforma e por categoria.",
              "Veja seu demonstrativo financeiro com extrato analítico detalhado.",
              "Tome decisões melhores com apoio da inteligência artificial.",
              "Planeje seu dia com base em metas, gráficos e projeções.",
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Escolha seu plano</h2>
          <p className="mt-3 text-center text-muted-foreground">Comece grátis. Sem cartão de crédito.</p>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* TRIAL */}
            <Card className="flex flex-col p-8">
              <Badge variant="secondary" className="w-fit">Grátis</Badge>
              <h3 className="mt-4 text-2xl font-bold">Free Trial</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-bold">R$ 0</span>
                <span className="text-muted-foreground">por 7 dias</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Comece sem cartão de crédito e teste o Drive IA completo.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {[
                  "Dashboard Financeiro e Operacional.",
                  "Painel de Cards com indicadores de performance.",
                  "Gráficos Financeiros.",
                  "Gráficos de Performance.",
                  "Análise por IA: 1 análise por dia.",
                  "Cadastro de veículo e parâmetros de custo.",
                  "Lançamento de Receitas e Despesas.",
                  "Metas personalizadas.",
                  "Suporte por e-mail.",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Link to="/cadastro">
                  <Button className="w-full" size="lg">Começar grátis agora</Button>
                </Link>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Sem necessidade de cartão de crédito.
                </p>
              </div>
            </Card>

            {/* PRO */}
            <div className="relative rounded-xl p-[2px]" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
              <Card className="flex h-full flex-col p-8">
                <Badge className="w-fit bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                  Mais popular
                </Badge>
                <h3 className="mt-4 text-2xl font-bold">Plano Pro</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-bold gradient-text">R$ 37,00</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Pix ou cartão de crédito recorrente.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tudo do período gratuito, com uso contínuo e histórico completo.
                </p>
                <ul className="mt-6 space-y-2 text-sm">
                  {[
                    "Tudo do plano gratuito",
                    "Acesso ilimitado após os 7 dias",
                    "Histórico completo sem limite",
                    "Análises por IA ilimitadas, com 1 por hora",
                    "Gráficos Financeiros e de Performance completos",
                    "Painel de Cards com visão consolidada",
                    "Novos recursos em primeira mão",
                    "Suporte prioritário por e-mail",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <a href={MP_SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full gradient-bg" size="lg">
                      Assinar agora — R$ 37,00/mês
                    </Button>
                  </a>
                  <p className="mt-2 text-center text-xs text-muted-foreground">Cancele quando quiser.</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/40 bg-card/30 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div
            className="rounded-2xl p-10 text-center text-primary-foreground shadow-glow md:p-14"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Comece a lucrar mais hoje mesmo
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base opacity-90">
              7 dias grátis, sem cartão de crédito. Junte-se aos motoristas que já controlam sua renda com IA.
            </p>
            <Link to="/cadastro">
              <Button size="lg" variant="secondary" className="mt-8">
                Criar minha conta grátis <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <Logo size="sm" />
          <p className="text-center">© 2026 Drive IA — Desenvolvido pela SolyTech Soluções em IA</p>
          <div className="flex items-center gap-4">
            <Link to="/privacidade" className="hover:text-foreground">Política de Privacidade</Link>
            <a href="mailto:contato.solytech@gmail.com" className="hover:text-foreground">
              contato.solytech@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
