import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePlanStatus, MP_SUBSCRIBE_URL } from "@/hooks/usePlanStatus";
import { useAuth } from "@/contexts/AuthContext";

export default function Planos() {
  const { planType, loading } = usePlanStatus();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const expired = !loading && planType === "expired";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-center font-display text-3xl font-bold md:text-4xl">Escolha seu plano</h1>
        <p className="mt-3 text-center text-muted-foreground">Comece grátis. Sem cartão de crédito.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col p-8">
            <Badge variant="secondary" className="w-fit">Grátis</Badge>
            <h3 className="mt-4 text-2xl font-bold">Free Trial</h3>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-bold">R$ 0</span>
              <span className="text-muted-foreground">7 dias grátis</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {["Dashboard Financeiro e Operacional","Relatórios completos","Análise por IA (1/hora)","Cadastro de veículo e custos","Metas personalizadas","Suporte por e-mail"].map((b)=>(
                <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /><span>{b}</span></li>
              ))}
            </ul>
          </Card>

          <div className="relative rounded-xl p-[2px]" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
            <Card className="flex h-full flex-col p-8">
              <Badge className="w-fit bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">Mais popular</Badge>
              <h3 className="mt-4 text-2xl font-bold">Plano Pro</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-bold gradient-text">R$ 37,00</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Pix ou cartão de crédito recorrente</p>
              <ul className="mt-6 space-y-2 text-sm">
                {["Tudo do período gratuito","Acesso ilimitado após os 7 dias","Histórico completo sem limite","Análise IA ilimitada (1/hora)","Novos recursos em primeira mão","Suporte prioritário"].map((b)=>(
                  <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /><span>{b}</span></li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <a href={MP_SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gradient-bg" size="lg">Assinar agora — R$ 37,00/mês</Button>
                </a>
                <p className="mt-2 text-center text-xs text-muted-foreground">Cancele quando quiser</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={expired}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e)=>e.preventDefault()} onEscapeKeyDown={(e)=>e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Seu período gratuito encerrou</DialogTitle>
            <DialogDescription>
              Assine o Plano Pro para continuar acessando o Drive IA e não perder seu histórico de corridas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <a href={MP_SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gradient-bg">Assinar agora — R$ 37,00/mês</Button>
            </a>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>Sair da conta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
