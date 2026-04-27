import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SuccessScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const duration = 1200;
    const end = Date.now() + duration;
    const colors = ["#6C63FF", "#4ECDC4", "#ffffff"];
    const tick = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(tick);
    };
    tick();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 text-center animate-fade-in shadow-glow">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full [background:var(--gradient-primary-soft)]">
          <CheckCircle2 className="h-12 w-12 text-primary" strokeWidth={2.2} />
        </div>
        <h1 className="font-display text-3xl font-bold">Tudo pronto!</h1>
        <p className="mt-3 text-muted-foreground">
          Agora vamos conectar sua conta Uber para sincronizar suas corridas automaticamente.
        </p>
        <div className="mt-6 space-y-3">
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={() => navigate("/configuracoes/conectar-uber")}
          >
            Conectar minha conta Uber
          </Button>
          <button
            type="button"
            onClick={() => navigate("/dashboard/operacional")}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Fazer isso depois
          </button>
        </div>
      </Card>
    </div>
  );
}
