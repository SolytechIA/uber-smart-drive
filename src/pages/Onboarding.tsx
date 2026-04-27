import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StepProgress } from "./onboarding/StepProgress";
import { StepVehicle } from "./onboarding/StepVehicle";
import { StepCosts } from "./onboarding/StepCosts";
import { StepGoals } from "./onboarding/StepGoals";
import { SuccessScreen } from "./onboarding/SuccessScreen";
import {
  initialCosts,
  initialGoals,
  initialVehicle,
  type CostsData,
  type GoalsData,
  type VehicleData,
} from "./onboarding/types";

const PLACA_REGEX = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/;

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleData>(initialVehicle);
  const [costs, setCosts] = useState<CostsData>(initialCosts);
  const [goals, setGoals] = useState<GoalsData>(initialGoals);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!vehicle.marca) e.marca = "Selecione a marca";
      if (!vehicle.modelo.trim()) e.modelo = "Informe o modelo";
      if (!vehicle.ano) e.ano = "Selecione o ano";
      if (!vehicle.placa || !PLACA_REGEX.test(vehicle.placa)) e.placa = "Placa inválida";
      if (!vehicle.tipo_posse) e.tipo_posse = "Escolha um tipo";
      if (
        ["financiado", "diaria", "semanal"].includes(vehicle.tipo_posse) &&
        !vehicle.valor_parcela_ou_diaria
      )
        e.valor_parcela_ou_diaria = "Informe o valor";
      if (!vehicle.combustivel) e.combustivel = "Escolha o combustível";
      const liq = ["gasolina", "etanol", "flex", "diesel", "gnv"].includes(vehicle.combustivel);
      if (liq) {
        if (!vehicle.consumo_km_litro) e.consumo_km_litro = "Informe o consumo";
        if (!vehicle.preco_combustivel) e.preco_combustivel = "Informe o preço";
      }
      if (vehicle.combustivel === "eletrico" || vehicle.combustivel === "hibrido") {
        if (!vehicle.consumo_km_kwh) e.consumo_km_kwh = "Informe o consumo elétrico";
        if (!vehicle.preco_kwh) e.preco_kwh = "Informe o preço da energia";
      }
    }
    if (s === 3) {
      if (!goals.meta_diaria || goals.meta_diaria <= 0) e.meta_diaria = "Defina sua meta diária";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const persistPartial = async () => {
    if (!user) return;
    // Atualiza users com cidade/telefone se vierem (não vem nessa fase)
    // Persistimos parciais já no avanço usando upserts
    if (step === 1) {
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
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    }
    if (step === 2) {
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
      if (error) throw error;
    }
  };

  const handleNext = async () => {
    if (!validateStep(step)) return;
    try {
      setSaving(true);
      await persistPartial();
      setSaving(false);
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSaving(false);
      toast.error("Não foi possível salvar. Tente novamente.");
      console.error(err);
    }
  };

  const handleFinish = async () => {
    if (!validateStep(3) || !user) return;
    try {
      setSaving(true);
      // garante custos/dias salvos no veículo
      await supabase
        .from("vehicles")
        .update({
          dias_trabalhados_mes: costs.dias_trabalhados_mes,
          taxa_uber_percent: costs.taxa_uber_percent,
        })
        .eq("user_id", user.id);

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
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      setSaving(false);
      setDone(true);
    } catch (err) {
      setSaving(false);
      toast.error("Não foi possível salvar suas metas.");
      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 dark:[background:var(--gradient-bg)]" />
      <header className="relative z-10 flex items-center justify-between border-b border-border/40 p-4">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {done ? (
          <SuccessScreen />
        ) : (
          <>
            <StepProgress current={step} />

            <Card className="mt-8 p-6 sm:p-8 shadow-card">
              {step === 1 && (
                <StepVehicle
                  data={vehicle}
                  onChange={(p) => { setVehicle((v) => ({ ...v, ...p })); setErrors({}); }}
                  errors={errors}
                />
              )}
              {step === 2 && (
                <StepCosts
                  data={costs}
                  vehicle={vehicle}
                  onChange={(p) => setCosts((c) => ({ ...c, ...p }))}
                  errors={errors}
                />
              )}
              {step === 3 && (
                <StepGoals
                  data={goals}
                  onChange={(p) => { setGoals((g) => ({ ...g, ...p })); setErrors({}); }}
                  errors={errors}
                />
              )}

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/60 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  disabled={step === 1 || saving}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                {step < 3 ? (
                  <Button type="button" variant="gradient" onClick={handleNext} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" variant="gradient" onClick={handleFinish} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Concluir
                  </Button>
                )}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
