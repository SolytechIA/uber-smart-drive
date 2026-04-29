import { Brain, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";

export default function AnaliseIA() {
  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <header className="relative overflow-hidden rounded-2xl border border-border/50 p-8 text-center" style={{ background: "linear-gradient(135deg, hsl(270 80% 25% / 0.4), hsl(180 80% 25% / 0.4))" }}>
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur animate-pulse">
            <Brain className="h-8 w-8 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">Análise Inteligente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerado por IA com base no seu histórico</p>
        </header>

        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h2 className="text-lg font-semibold">Em breve</h2>
            <p className="text-sm text-muted-foreground">
              A análise inteligente do seu dia será habilitada na próxima entrega (Fase 2).
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
