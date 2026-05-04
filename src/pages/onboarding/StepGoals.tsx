import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "./Field";
import type { GoalsData } from "./types";

interface Props {
  data: GoalsData;
  onChange: (patch: Partial<GoalsData>) => void;
  errors: Record<string, string>;
}

export function StepGoals({ data, onChange, errors }: Props) {
  const setDiaria = (v: number | null) => {
    onChange({
      meta_diaria: v,
      meta_semanal: v ? v * 5 : null,
      meta_mensal: v ? v * 25 : null,
    });
  };

  const stepHoras = (delta: number) => {
    const next = Math.max(1, Math.min(24, (data.horas_meta_dia ?? 8) + delta));
    onChange({ horas_meta_dia: next });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h2 className="font-display text-2xl font-bold">Defina suas metas</h2>
        <p className="text-sm text-muted-foreground">Vamos te ajudar a atingi-las</p>
      </header>

      <Field label="Meta de ganho diário (R$)" error={errors.meta_diaria}
        hint="Calculamos automaticamente sua meta semanal e mensal — você pode ajustar.">
        <Input type="number" step="0.01" min={0} placeholder="300,00"
          value={data.meta_diaria ?? ""}
          onChange={(e) => setDiaria(e.target.value ? Number(e.target.value) : null)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta semanal (R$)">
          <Input type="number" step="0.01" min={0} placeholder="1.500,00"
            value={data.meta_semanal ?? ""}
            onChange={(e) => onChange({ meta_semanal: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Meta mensal (R$)">
          <Input type="number" step="0.01" min={0} placeholder="6.600,00"
            value={data.meta_mensal ?? ""}
            onChange={(e) => onChange({ meta_mensal: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      </div>

      <Field label="Meta de horas ao volante por dia">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => stepHoras(-1)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Input type="number" min={1} max={24} className="text-center font-mono"
            value={data.horas_meta_dia ?? ""}
            onChange={(e) => onChange({ horas_meta_dia: e.target.value ? Number(e.target.value) : null })} />
          <Button type="button" variant="outline" size="icon" onClick={() => stepHoras(1)}>
            <Plus className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">horas</span>
        </div>
      </Field>

      <Card className="space-y-4 border-primary/20 bg-secondary/40 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold">Parâmetros de aceite de corrida</h3>
          <p className="text-xs text-muted-foreground">Defina o que é uma boa corrida para você</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Km máx. de deslocamento até o passageiro" hint="Ex: 3 km">
            <Input type="number" step="0.1" min={0} placeholder="3"
              value={data.km_max_deslocamento ?? ""}
              onChange={(e) => onChange({ km_max_deslocamento: e.target.value ? Number(e.target.value) : null })} />
          </Field>

          <Field label="Valor mínimo da corrida (R$)" hint="Ex: R$ 8,00">
            <Input type="number" step="0.01" min={0} placeholder="8,00"
              value={data.valor_minimo_corrida ?? ""}
              onChange={(e) => onChange({ valor_minimo_corrida: e.target.value ? Number(e.target.value) : null })} />
          </Field>

          <Field label="R$/km mínimo aceitável" hint="Ex: R$ 1,80/km">
            <Input type="number" step="0.01" min={0} placeholder="1,80"
              value={data.r_por_km_minimo ?? ""}
              onChange={(e) => onChange({ r_por_km_minimo: e.target.value ? Number(e.target.value) : null })} />
          </Field>

          <Field label="% máximo de km vazio por corrida" hint="Ex: 40%">
            <Input type="number" step="1" min={0} max={100} placeholder="40"
              value={data.km_vazio_max_percent ?? ""}
              onChange={(e) => onChange({ km_vazio_max_percent: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>

        <p className="rounded-md bg-background/50 p-3 text-xs text-muted-foreground">
          Com esses parâmetros, corridas que não se encaixarem serão classificadas como{" "}
          <span className="font-semibold text-destructive">RUINS</span> automaticamente.
        </p>
      </Card>
    </div>
  );
}
