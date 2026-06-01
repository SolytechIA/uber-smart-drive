import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";

export default function GraficosFinanceiros() {
  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Gráficos Financeiros</h1>
          <p className="text-muted-foreground text-sm mt-1">Visualizações analíticas de ganhos, custos e lucro líquido.</p>
        </div>
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            <p className="text-lg">📈 Em breve</p>
            <p className="text-sm mt-2">Gráficos financeiros detalhados serão adicionados em breve.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
