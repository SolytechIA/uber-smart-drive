import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Field } from "./Field";
import type { CostsData, VehicleData } from "./types";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  data: CostsData;
  vehicle: VehicleData;
  onChange: (patch: Partial<CostsData>) => void;
  errors: Record<string, string>;
}

export function StepCosts({ data, vehicle, onChange, errors }: Props) {
  const ipvaMensal = (data.ipva_anual_input ?? 0) / 12;
  const celularTrabalho = ((data.valor_plano_celular ?? 0) * data.percentual_celular_trabalho) / 100;

  // valor mensal estimado do veículo (parcela/aluguel)
  const veiculoMensal = useMemo(() => {
    const v = vehicle.valor_parcela_ou_diaria ?? 0;
    if (vehicle.tipo_posse === "financiado") return v;
    if (vehicle.tipo_posse === "diaria") return v * data.dias_trabalhados_mes;
    if (vehicle.tipo_posse === "semanal") return v * 4.33;
    return 0;
  }, [vehicle, data.dias_trabalhados_mes]);

  const totalMensal =
    ipvaMensal +
    (data.custo_seguro_mensal ?? 0) +
    (data.custo_manutencao_mensal ?? 0) +
    (data.custo_lavagem_mensal ?? 0) +
    celularTrabalho +
    (data.outros_custos_valor ?? 0) +
    veiculoMensal;

  const totalDia = data.dias_trabalhados_mes > 0 ? totalMensal / data.dias_trabalhados_mes : 0;

  return (
    <div className="grid gap-6 animate-fade-in lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <header>
          <h2 className="font-display text-2xl font-bold">Seus custos mensais</h2>
          <p className="text-sm text-muted-foreground">Vamos calcular o que você realmente gasta para trabalhar</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="IPVA anual (R$)" hint={data.ipva_anual_input ? `= ${fmt(ipvaMensal)} por mês` : undefined}>
            <Input type="number" step="0.01" min={0} placeholder="0,00"
              value={data.ipva_anual_input ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                onChange({ ipva_anual_input: v, custo_ipva_mensal: v ? v / 12 : null });
              }} />
          </Field>

          <Field label="Seguro mensal (R$)">
            <Input type="number" step="0.01" min={0} placeholder="0,00"
              value={data.custo_seguro_mensal ?? ""}
              onChange={(e) => onChange({ custo_seguro_mensal: e.target.value ? Number(e.target.value) : null })} />
          </Field>

          <Field
            label="Manutenção média mensal (R$)"
            tooltip="Inclua revisões, troca de óleo, pneus, filtros. Divida o gasto anual por 12."
          >
            <Input type="number" step="0.01" min={0} placeholder="0,00"
              value={data.custo_manutencao_mensal ?? ""}
              onChange={(e) => onChange({ custo_manutencao_mensal: e.target.value ? Number(e.target.value) : null })} />
          </Field>

          <Field label="Lavagem/higienização mensal (R$)">
            <Input type="number" step="0.01" min={0} placeholder="0,00"
              value={data.custo_lavagem_mensal ?? ""}
              onChange={(e) => onChange({ custo_lavagem_mensal: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>

        <Card className="space-y-3 p-4">
          <Field label="Plano de celular — valor total (R$)">
            <Input type="number" step="0.01" min={0} placeholder="0,00"
              value={data.valor_plano_celular ?? ""}
              onChange={(e) => onChange({ valor_plano_celular: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">% dedicado ao trabalho</span>
              <span className="font-mono text-primary">{data.percentual_celular_trabalho}%</span>
            </div>
            <Slider
              value={[data.percentual_celular_trabalho]}
              max={100}
              step={5}
              onValueChange={(v) => onChange({ percentual_celular_trabalho: v[0] })}
            />
            {data.valor_plano_celular ? (
              <p className="mt-2 text-xs text-muted-foreground">
                = <span className="font-medium text-foreground">{fmt(celularTrabalho)}</span> por mês para o trabalho
              </p>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Taxa da Uber sobre corridas (%)" tooltip="Percentual que a Uber retém de cada corrida. O padrão é 25%, mas pode variar.">
            <Input type="number" step="0.1" min={0} max={100} placeholder="25"
              value={data.taxa_uber_percent}
              onChange={(e) => onChange({ taxa_uber_percent: e.target.value ? Number(e.target.value) : 0 })} />
          </Field>

          <Field label="Dias trabalhados por mês">
            <Select value={data.dias_trabalhados_mes.toString()} onValueChange={(v) => onChange({ dias_trabalhados_mes: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={d.toString()}>{d} dias</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Outros custos (opcional)</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Input placeholder="Descrição (ex: aluguel garagem)"
              maxLength={80}
              value={data.outros_custos_label}
              onChange={(e) => onChange({ outros_custos_label: e.target.value })} />
            <Input type="number" step="0.01" min={0} placeholder="R$ 0,00"
              value={data.outros_custos_valor ?? ""}
              onChange={(e) => onChange({ outros_custos_valor: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>

      {/* resumo lateral */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Card className="space-y-3 p-5 [background:var(--gradient-primary-soft)] border-primary/30">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Custo fixo total</p>
          <p className="font-display text-3xl font-bold gradient-text">{fmt(totalMensal)}</p>
          <p className="text-xs text-muted-foreground">por mês</p>
          <div className="border-t border-border/60 pt-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Por dia trabalhado: </span>
              <span className="font-semibold">{fmt(totalDia)}</span>
            </p>
          </div>
          {veiculoMensal > 0 && (
            <p className="text-xs text-muted-foreground">
              Inclui {fmt(veiculoMensal)} de veículo
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}
