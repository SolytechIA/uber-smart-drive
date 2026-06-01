import { useEffect, useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { nowInTZ } from "@/lib/financeiro";

export type Periodo = "hoje" | "semana" | "mes" | "acumulado" | "personalizado";

const LABELS: Record<Periodo, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  acumulado: "Acumulado",
  personalizado: "Personalizado",
};

export function getPeriodRange(periodo: Periodo, custom?: { from: Date; to: Date }): { from: Date; to: Date } {
  const n = nowInTZ();
  switch (periodo) {
    case "hoje": return { from: startOfDay(n), to: endOfDay(n) };
    case "semana": return { from: startOfWeek(n, { weekStartsOn: 1 }), to: endOfWeek(n, { weekStartsOn: 1 }) };
    case "mes": return { from: startOfMonth(n), to: endOfMonth(n) };
    case "acumulado": return { from: new Date(2000, 0, 1), to: new Date(2999, 11, 31) };
    case "personalizado":
      return custom ? { from: startOfDay(custom.from), to: endOfDay(custom.to) } : { from: startOfDay(n), to: endOfDay(n) };
  }
}

interface Props {
  periodo: Periodo;
  custom?: { from: Date; to: Date };
  onChange: (p: Periodo, custom?: { from: Date; to: Date }) => void;
}

function CustomPicker({
  custom,
  onApply,
}: {
  custom?: { from: Date; to: Date };
  onApply: (r: { from: Date; to: Date }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date } | undefined>(
    custom ? { from: custom.from, to: custom.to } : undefined,
  );
  useEffect(() => {
    if (open) setDraft(custom ? { from: custom.from, to: custom.to } : undefined);
  }, [open, custom]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {custom
            ? `${format(custom.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(custom.to, "dd/MM/yyyy", { locale: ptBR })}`
            : "Escolher datas"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={draft as any}
          onSelect={(r: any) => setDraft(r || undefined)}
          numberOfMonths={2}
          className="p-3 pointer-events-auto"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
          <div className="text-xs text-muted-foreground">
            {draft?.from && draft?.to
              ? `${format(draft.from, "dd/MM/yyyy", { locale: ptBR })} → ${format(draft.to, "dd/MM/yyyy", { locale: ptBR })}`
              : "Selecione início e fim"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={!draft?.from || !draft?.to}
              onClick={() => {
                if (draft?.from && draft?.to) {
                  onApply({ from: draft.from, to: draft.to });
                  setOpen(false);
                }
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PeriodFilter({ periodo, custom, onChange }: Props) {
  const opts: Periodo[] = ["hoje", "semana", "mes", "acumulado", "personalizado"];
  const range = getPeriodRange(periodo, custom);

  let badgeText: string;
  if (periodo === "acumulado") {
    badgeText = "Acumulado";
  } else if (periodo === "personalizado" && custom) {
    badgeText = `${format(custom.from, "dd/MM/yy", { locale: ptBR })} – ${format(custom.to, "dd/MM/yy", { locale: ptBR })}`;
  } else {
    badgeText = `${format(range.from, "dd/MM/yy", { locale: ptBR })} – ${format(range.to, "dd/MM/yy", { locale: ptBR })}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {opts.map((o) => (
        <Button
          key={o}
          size="sm"
          variant={periodo === o ? "default" : "outline"}
          onClick={() => onChange(o, o === "personalizado" ? custom : undefined)}
          className={cn(periodo === o && "gradient-bg")}
        >
          {LABELS[o]}
        </Button>
      ))}
      {periodo === "personalizado" && (
        <CustomPicker custom={custom} onApply={(r) => onChange("personalizado", r)} />
      )}
      <Badge variant="outline" className="ml-auto">📅 Exibindo: {badgeText}</Badge>
    </div>
  );
}
