import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Field } from "./Field";
import type { VehicleData, Combustivel, TipoPosse } from "./types";

const MARCAS = [
  "BYD",
  "Chevrolet",
  "Fiat",
  "Ford",
  "Geely",
  "Honda",
  "Hyundai",
  "JAC",
  "Jeep",
  "Nissan",
  "Renault",
  "Toyota",
  "Volkswagen",
  "Outras",
];
const ANOS = Array.from({ length: 2026 - 2010 + 1 }, (_, i) => 2026 - i);

const POSSE_OPTS: { v: TipoPosse; label: string }[] = [
  { v: "proprio_quitado", label: "Próprio quitado" },
  { v: "financiado", label: "Financiado" },
  { v: "alugado_diaria", label: "Alugado por diária" },
  { v: "alugado_semana", label: "Alugado por semana" },
];

const COMB_OPTS: { v: Combustivel; label: string; emoji: string }[] = [
  { v: "gasolina", label: "Gasolina", emoji: "⛽" },
  { v: "etanol", label: "Etanol", emoji: "🌽" },
  { v: "flex", label: "Flex", emoji: "🔀" },
  { v: "gnv", label: "GNV", emoji: "💨" },
  { v: "diesel", label: "Diesel", emoji: "🛢️" },
  { v: "eletrico", label: "Elétrico", emoji: "🔋" },
  { v: "hibrido", label: "Híbrido", emoji: "♻️" },
];

function formatPlaca(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (clean.length <= 3) return clean;
  if (/^[A-Z]{3}[0-9][A-Z]/.test(clean)) return clean;
  return clean.slice(0, 3) + "-" + clean.slice(3);
}

interface Props {
  data: VehicleData;
  onChange: (patch: Partial<VehicleData>) => void;
  errors: Record<string, string>;
}

export function StepVehicle({ data, onChange, errors }: Props) {
  const showLiquidoSimples = ["gasolina", "etanol", "diesel"].includes(data.combustivel);
  const showFlex = data.combustivel === "flex";
  const showGNV = data.combustivel === "gnv";
  const showEletrico = data.combustivel === "eletrico";
  const showHibrido = data.combustivel === "hibrido";

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h2 className="font-display text-2xl font-bold">Cadastre seu veículo</h2>
        <p className="text-sm text-muted-foreground">Essas informações calculam seus custos reais</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca" error={errors.marca}>
          <Select value={data.marca} onValueChange={(v) => onChange({ marca: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {MARCAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Modelo" htmlFor="modelo" error={errors.modelo}>
          <Input
            id="modelo"
            placeholder="Ex: Onix, HB20"
            value={data.modelo}
            maxLength={50}
            onChange={(e) => onChange({ modelo: e.target.value })}
          />
        </Field>

        <Field label="Ano" error={errors.ano}>
          <Select value={data.ano?.toString() ?? ""} onValueChange={(v) => onChange({ ano: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Placa" htmlFor="placa" tooltip="Aceita formato antigo (ABC-1234) ou Mercosul (ABC1D234)." error={errors.placa}>
          <Input
            id="placa"
            placeholder="ABC-1234"
            value={data.placa}
            maxLength={8}
            onChange={(e) => onChange({ placa: formatPlaca(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="Tipo de posse" error={errors.tipo_posse}>
        <RadioGroup
          value={data.tipo_posse}
          onValueChange={(v) => onChange({ tipo_posse: v as TipoPosse, valor_parcela_ou_diaria: null })}
          className="grid gap-2 sm:grid-cols-2"
        >
          {POSSE_OPTS.map((o) => (
            <Label
              key={o.v}
              htmlFor={`posse-${o.v}`}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
            >
              <RadioGroupItem id={`posse-${o.v}`} value={o.v} />
              <span className="text-sm font-medium">{o.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </Field>

      {data.tipo_posse === "financiado" && (
        <Field label="Valor da parcela mensal (R$)" error={errors.valor_parcela_ou_diaria}>
          <Input type="number" step="0.01" min={0} placeholder="0,00"
            value={data.valor_parcela_ou_diaria ?? ""}
            onChange={(e) => onChange({ valor_parcela_ou_diaria: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      )}
      {data.tipo_posse === "alugado_diaria" && (
        <Field label="Valor da diária (R$)" error={errors.valor_parcela_ou_diaria}>
          <Input type="number" step="0.01" min={0} placeholder="0,00"
            value={data.valor_parcela_ou_diaria ?? ""}
            onChange={(e) => onChange({ valor_parcela_ou_diaria: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      )}
      {data.tipo_posse === "alugado_semana" && (
        <Field label="Valor semanal (R$)" error={errors.valor_parcela_ou_diaria}>
          <Input type="number" step="0.01" min={0} placeholder="0,00"
            value={data.valor_parcela_ou_diaria ?? ""}
            onChange={(e) => onChange({ valor_parcela_ou_diaria: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      )}

      <Field label="Tipo de combustível" error={errors.combustivel}>
        <RadioGroup
          value={data.combustivel}
          onValueChange={(v) => onChange({ combustivel: v as Combustivel })}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {COMB_OPTS.map((o) => (
            <Label
              key={o.v}
              htmlFor={`comb-${o.v}`}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border bg-card p-3 text-center transition-colors hover:border-primary/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
            >
              <RadioGroupItem id={`comb-${o.v}`} value={o.v} className="sr-only" />
              <span className="text-2xl">{o.emoji}</span>
              <span className="text-xs font-medium">{o.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </Field>

      {showLiquidoSimples && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Consumo médio (km/l)" tooltip="Quantos km seu carro faz com 1 litro." error={errors.consumo_km_litro}>
            <Input type="number" step="0.1" min={0} placeholder="12,5"
              value={data.consumo_km_litro ?? ""}
              onChange={(e) => onChange({ consumo_km_litro: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Preço atual R$/litro" error={errors.preco_combustivel}>
            <Input type="number" step="0.01" min={0} placeholder="5,89"
              value={data.preco_combustivel ?? ""}
              onChange={(e) => onChange({ preco_combustivel: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Capacidade do tanque (litros)">
            <Input type="number" step="1" min={0} placeholder="50"
              value={data.capacidade_tanque ?? ""}
              onChange={(e) => onChange({ capacidade_tanque: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
      )}

      {showFlex && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Combustível Flex — informe ambos preços e consumos</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preço Gasolina R$/litro">
              <Input type="number" step="0.01" min={0} placeholder="5,89"
                value={data.preco_gasolina ?? ""}
                onChange={(e) => onChange({ preco_gasolina: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Preço Álcool R$/litro">
              <Input type="number" step="0.01" min={0} placeholder="3,99"
                value={data.preco_alcool ?? ""}
                onChange={(e) => onChange({ preco_alcool: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Consumo médio km/l (Gasolina)">
              <Input type="number" step="0.1" min={0} placeholder="12,5"
                value={data.consumo_gasolina ?? ""}
                onChange={(e) => onChange({ consumo_gasolina: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Consumo médio km/l (Álcool)">
              <Input type="number" step="0.1" min={0} placeholder="9,0"
                value={data.consumo_alcool ?? ""}
                onChange={(e) => onChange({ consumo_alcool: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Capacidade do tanque (litros)">
              <Input type="number" step="1" min={0} placeholder="50"
                value={data.capacidade_tanque ?? ""}
                onChange={(e) => onChange({ capacidade_tanque: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          </div>
        </div>
      )}

      {showGNV && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">GNV principal + Gasolina como reserva</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preço GNV R$/m³" error={errors.preco_combustivel}>
              <Input type="number" step="0.01" min={0} placeholder="4,29"
                value={data.preco_combustivel ?? ""}
                onChange={(e) => onChange({ preco_combustivel: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Consumo médio (km/m³)" error={errors.consumo_km_litro}>
              <Input type="number" step="0.1" min={0} placeholder="14"
                value={data.consumo_km_litro ?? ""}
                onChange={(e) => onChange({ consumo_km_litro: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Preço Gasolina R$/litro (reserva)">
              <Input type="number" step="0.01" min={0} placeholder="5,89"
                value={data.preco_gasolina_reserva ?? ""}
                onChange={(e) => onChange({ preco_gasolina_reserva: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Consumo km/l (reserva)">
              <Input type="number" step="0.1" min={0} placeholder="11,0"
                value={data.consumo_gasolina_reserva ?? ""}
                onChange={(e) => onChange({ consumo_gasolina_reserva: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          </div>
        </div>
      )}

      {(showEletrico || showHibrido) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Consumo médio (km/kWh)" error={errors.consumo_km_kwh}>
            <Input type="number" step="0.1" min={0} placeholder="6,5"
              value={data.consumo_km_kwh ?? ""}
              onChange={(e) => onChange({ consumo_km_kwh: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Preço da energia R$/kWh" error={errors.preco_kwh}>
            <Input type="number" step="0.01" min={0} placeholder="0,95"
              value={data.preco_kwh ?? ""}
              onChange={(e) => onChange({ preco_kwh: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Capacidade da bateria (kWh)">
            <Input type="number" step="0.1" min={0} placeholder="50"
              value={data.capacidade_tanque ?? ""}
              onChange={(e) => onChange({ capacidade_tanque: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
      )}

      {showHibrido && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Consumo médio (km/l)">
            <Input type="number" step="0.1" min={0} placeholder="14"
              value={data.consumo_km_litro ?? ""}
              onChange={(e) => onChange({ consumo_km_litro: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Preço combustível R$/litro">
            <Input type="number" step="0.01" min={0} placeholder="5,89"
              value={data.preco_combustivel ?? ""}
              onChange={(e) => onChange({ preco_combustivel: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
      )}
    </div>
  );
}
