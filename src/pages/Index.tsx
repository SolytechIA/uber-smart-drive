import { Link } from "react-router-dom";
import {
  RefreshCw,
  BarChart3,
  Route,
  TrendingUp,
  FileText,
  Brain,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: RefreshCw,
    title: "Sincronização Automática Uber",
    desc: "Suas corridas aparecem automaticamente. Sem digitar nada, sem baixar CSV.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Financeiro Completo",
    desc: "Ganho real, custos, margem e ponto de equilíbrio em tempo real.",
  },
  {
    icon: Route,
    title: "Custo Real por KM",
    desc: "Saiba exatamente quanto você gasta por km incluindo combustível e custos fixos.",
  },
  {
    icon: TrendingUp,
    title: "Classificação de Corridas",
    desc: "Boa, média ou ruim? O sistema analisa automaticamente cada corrida.",
  },
  {
    icon: FileText,
    title: "Relatórios Automáticos",
    desc: "Relatórios diários, semanais e mensais gerados automaticamente.",
  },
  {
    icon: Brain,
    title: "Análise Inteligente com IA",
    desc: "Recomendações personalizadas para ganhar mais amanhã.",
  },
];

const proFeatures = [
  "Sincronização automática Uber",
  "Dashboards completos em tempo real",
  "Custo real por km e por corrida",
  "Classificação automática de corridas",
  "Histórico ilimitado de corridas",
  "Importação de todo histórico Uber",
  "Análise com Inteligência Artificial",
  "Relatórios diários, semanais e mensais",
];

const trialFeatures = [
  "Todos os recursos do Drive Pro",
  "Sem cartão de crédito",
  "Cancele quando quiser",
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#planos" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Planos
            </a>
            <Link to="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Entrar
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="gradient" size="sm" className="hidden sm:inline-flex">
              <Link to="/cadastro">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 dark:[background:var(--gradient-bg)]" />
        <div className="container relative py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary">
              <span className="gradient-text font-semibold">Novo</span>
              <span className="ml-2 text-foreground/80">Análise por Inteligência Artificial</span>
            </Badge>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Pare de adivinhar.
              <br />
              <span className="gradient-text">Comece a lucrar.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              O único copiloto financeiro inteligente para motoristas Uber.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="gradient" size="lg" className="w-full sm:w-auto">
                <Link to="/cadastro">
                  Começar grátis por 7 dias
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito · Cancele quando quiser</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20 md:py-28">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold md:text-5xl">
            Tudo que você precisa para <span className="gradient-text">ganhar mais</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Dados reais, decisões inteligentes. Direto do seu app Uber para o seu bolso.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Card
              key={f.title}
              className="group relative overflow-hidden border-border/60 p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-glow animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-bg-soft">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="container py-20 md:py-28">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold md:text-5xl">
            Planos <span className="gradient-text">simples e justos</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Comece grátis. Pague apenas se valer a pena.</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {/* Free Trial */}
          <Card className="relative flex flex-col p-8 shadow-card">
            <div className="mb-6">
              <h3 className="font-display text-xl font-semibold">Free Trial</h3>
              <p className="mt-1 text-sm text-muted-foreground">7 dias para testar tudo</p>
            </div>
            <div className="mb-6">
              <span className="font-display text-5xl font-bold">Grátis</span>
              <span className="ml-2 text-muted-foreground">/ 7 dias</span>
            </div>
            <ul className="mb-8 flex-1 space-y-3">
              {trialFeatures.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link to="/cadastro">Começar grátis</Link>
            </Button>
          </Card>

          {/* Pro */}
          <Card className="relative flex flex-col overflow-hidden border-primary/40 p-8 shadow-glow">
            <div className="absolute inset-x-0 top-0 h-1 gradient-bg" />
            <Badge className="absolute right-4 top-4 gradient-bg border-0 text-primary-foreground">
              Plano completo
            </Badge>
            <div className="mb-6">
              <h3 className="font-display text-xl font-semibold gradient-text">Drive Pro</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tudo. Sempre.</p>
            </div>
            <div className="mb-6">
              <span className="font-display text-5xl font-bold">R$ 27,90</span>
              <span className="ml-2 text-muted-foreground">/ mês</span>
            </div>
            <ul className="mb-8 flex-1 space-y-3">
              {proFeatures.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="gradient" size="lg" className="w-full">
              <Link to="/cadastro">Assinar agora</Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">© 2026 SolyTech. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
