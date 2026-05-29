import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StepVehicle } from "./onboarding/StepVehicle";
import { StepCosts } from "./onboarding/StepCosts";
import { StepGoals } from "./onboarding/StepGoals";
import { PerfilTab } from "@/components/configuracoes/PerfilTab";
import {
  initialCosts,
  initialGoals,
  initialVehicle,
  type CostsData,
  type GoalsData,
  type VehicleData,
} from "./onboarding/types";

export default function Configuracoes() {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleData>(initialVehicle);
  const [costs, setCosts] = useState<CostsData>(initialCosts);
  const [goals, setGoals] = useState<GoalsData>(initialGoals);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"vehicle" | "costs" | "goals" | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: v }, { data: g }] = await Promise.all([
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (v) {
        setVehicle({
          marca: v.marca ?? "",
          modelo: v.modelo ?? "",
          ano: v.ano ?? null,
          placa: v.placa ?? "",
          tipo_posse: (v.tipo_posse as VehicleData["tipo_posse"]) ?? "",
          valor_parcela_ou_diaria: v.valor_parcela_ou_diaria ?? null,
          combustivel: (v.combustivel as VehicleData["combustivel"]) ?? "",
          consumo_km_litro: v.consumo_km_litro ?? null,
          preco_combustivel: v.preco_combustivel ?? null,
          capacidade_tanque: v.capacidade_tanque ?? null,
          consumo_km_kwh: v.consumo_km_kwh ?? null,
          preco_kwh: v.preco_kwh ?? null,
          preco_gasolina: (v as any).preco_gasolina ?? null,
          preco_alcool: (v as any).preco_alcool ?? null,
          consumo_gasolina: (v as any).consumo_gasolina ?? null,
          consumo_alcool: (v as any).consumo_alcool ?? null,
          preco_gasolina_reserva: (v as any).preco_gasolina_reserva ?? null,
          consumo_gasolina_reserva: (v as any).consumo_gasolina_reserva ?? null,
        });
        setCosts({
          custo_ipva_mensal: v.custo_ipva_mensal ?? null,
          ipva_anual_input: v.custo_ipva_mensal ? Number(v.custo_ipva_mensal) * 12 : null,
          custo_seguro_mensal: v.custo_seguro_mensal ?? null,
          custo_manutencao_mensal: v.custo_manutencao_mensal ?? null,
          custo_lavagem_mensal: v.custo_lavagem_mensal ?? null,
          valor_plano_celular: v.valor_plano_celular ?? null,
          percentual_celular_trabalho: v.percentual_celular_trabalho ?? 100,
          taxa_uber_percent: v.taxa_uber_percent ?? 25,
          outros_custos_label: v.outros_custos_label ?? "",
          outros_custos_valor: v.outros_custos_valor ?? null,
          dias_trabalhados_mes: v.dias_trabalhados_mes ?? 22,
        });
      }
      if (g) {
        setGoals({
          meta_diaria: g.meta_diaria ?? null,
          meta_semanal: g.meta_semanal ?? null,
          meta_mensal: g.meta_mensal ?? null,
          horas_meta_dia: g.horas_meta_dia ?? 8,
          km_max_deslocamento: g.km_max_deslocamento ?? 3,
          valor_minimo_corrida: g.valor_minimo_corrida ?? 8,
          r_por_km_minimo: g.r_por_km_minimo ?? 1.8,
          km_vazio_max_percent: g.km_vazio_max_percent ?? 40,
          r_km_bom: (g as any).r_km_bom ?? g.r_por_km_minimo ?? 1.8,
          r_km_medio: (g as any).r_km_medio ?? 1.3,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveVehicle = async () => {
    if (!user) return;
    setSaving("vehicle");
    const { error } = await supabase.from("vehicles").upsert(
      {
        user_id: user.id,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        placa: vehicle.placa,
        tipo_posse: vehicle.tipo_posse,
        valor_parcela_ou_diaria: vehicle.valor_parcela_ou_diaria,
        combustivel: vehicle.combustivel,
        consumo_km_litro: vehicle.consumo_km_litro,
        preco_combustivel: vehicle.preco_combustivel,
        capacidade_tanque: vehicle.capacidade_tanque,
        consumo_km_kwh: vehicle.consumo_km_kwh,
        preco_kwh: vehicle.preco_kwh,
        preco_gasolina: vehicle.preco_gasolina,
        preco_alcool: vehicle.preco_alcool,
        consumo_gasolina: vehicle.consumo_gasolina,
        consumo_alcool: vehicle.consumo_alcool,
        preco_gasolina_reserva: vehicle.preco_gasolina_reserva,
        consumo_gasolina_reserva: vehicle.consumo_gasolina_reserva,
      } as any,
      { onConflict: "user_id" },
    );
    setSaving(null);
    if (error) return toast.error("Erro ao salvar veículo");
    toast.success("Veículo atualizado");
  };

  const saveCosts = async () => {
    if (!user) return;
    setSaving("costs");
    const { error } = await supabase
      .from("vehicles")
      .update({
        custo_ipva_mensal: costs.custo_ipva_mensal,
        custo_seguro_mensal: costs.custo_seguro_mensal,
        custo_manutencao_mensal: costs.custo_manutencao_mensal,
        custo_lavagem_mensal: costs.custo_lavagem_mensal,
        valor_plano_celular: costs.valor_plano_celular,
        percentual_celular_trabalho: costs.percentual_celular_trabalho,
        taxa_uber_percent: costs.taxa_uber_percent,
        outros_custos_label: costs.outros_custos_label || null,
        outros_custos_valor: costs.outros_custos_valor,
        dias_trabalhados_mes: costs.dias_trabalhados_mes,
      })
      .eq("user_id", user.id);
    setSaving(null);
    if (error) return toast.error("Erro ao salvar custos");
    toast.success("Custos atualizados");
  };

  const saveGoals = async () => {
    if (!user) return;
    setSaving("goals");
    const { error } = await supabase.from("goals").upsert(
      {
        user_id: user.id,
        meta_diaria: goals.meta_diaria,
        meta_semanal: goals.meta_semanal,
        meta_mensal: goals.meta_mensal,
        horas_meta_dia: goals.horas_meta_dia,
        km_max_deslocamento: goals.km_max_deslocamento,
        valor_minimo_corrida: goals.valor_minimo_corrida,
        r_por_km_minimo: goals.r_por_km_minimo,
        km_vazio_max_percent: goals.km_vazio_max_percent,
        r_km_bom: goals.r_km_bom,
        r_km_medio: goals.r_km_medio,
      } as any,
      { onConflict: "user_id" },
    );
    setSaving(null);
    if (error) return toast.error("Erro ao salvar metas");
    toast.success("Metas atualizadas");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border/40 p-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/operacional"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
          <Logo />
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Edite seus dados de veículo, custos e metas a qualquer momento.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : (
          <Tabs defaultValue="perfil" className="w-full">
            <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-5">
              <TabsTrigger value="perfil">Meu Perfil</TabsTrigger>
              <TabsTrigger value="vehicle">Veículo</TabsTrigger>
              <TabsTrigger value="costs">Custos</TabsTrigger>
              <TabsTrigger value="goals">Metas</TabsTrigger>
              <TabsTrigger value="uber">Conectar Uber</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil">
              <PerfilTab />
            </TabsContent>


            <TabsContent value="vehicle">
              <Card className="mt-6 p-6 sm:p-8">
                <StepVehicle
                  data={vehicle}
                  onChange={(p) => setVehicle((v) => ({ ...v, ...p }))}
                  errors={{}}
                />
                <div className="mt-6 flex justify-end border-t border-border/60 pt-6">
                  <Button variant="gradient" onClick={saveVehicle} disabled={saving === "vehicle"}>
                    {saving === "vehicle" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar alterações
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="costs">
              <Card className="mt-6 p-6 sm:p-8 space-y-6">
                <StepCosts
                  data={costs}
                  vehicle={vehicle}
                  onChange={(p) => setCosts((c) => ({ ...c, ...p }))}
                  errors={{}}
                />
                <div className="flex justify-end border-t border-border/60 pt-6">
                  <Button variant="gradient" onClick={saveCosts} disabled={saving === "costs"}>
                    {saving === "costs" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar alterações
                  </Button>
                </div>
                <PassesUberSection />
              </Card>
            </TabsContent>

            <TabsContent value="goals">
              <Card className="mt-6 p-6 sm:p-8">
                <StepGoals
                  data={goals}
                  onChange={(p) => setGoals((g) => ({ ...g, ...p }))}
                  errors={{}}
                />
                <div className="mt-6 flex justify-end border-t border-border/60 pt-6">
                  <Button variant="gradient" onClick={saveGoals} disabled={saving === "goals"}>
                    {saving === "goals" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar alterações
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="uber">
              <ConectarUberTab />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
