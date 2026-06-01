import { useState } from "react";
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

export function PeriodFilter({ periodo, custom, onChange }: Props) {
  const opts: Periodo[] = ["hoje", "semana", "mes", "acumulado", "personalizado"];
  const range = getPeriodRange(periodo, custom);
  const badgeText =
    periodo === "personalizado" && custom
      ? `${format(custom.from, "dd/MM/yy", { locale: ptBR })} – ${format(custom.to, "dd/MM/yy", { locale: ptBR })}`
      : `${format(range.from, "dd/MM/yy", { locale: ptBR })} – ${format(range.to, "dd/MM/yy", { locale: ptBR })}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {opts.map((o) => (
        <Button
          key={o}
          size="sm"
          variant={periodo === o ? "default" : "outline"}
          onClick={() => onChange(o, custom)}
          className={cn(periodo === o && "gradient-bg")}
        >
          {LABELS[o]}
        </Button>
      ))}
      {periodo === "personalizado" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {custom ? `${format(custom.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(custom.to, "dd/MM/yyyy", { locale: ptBR })}` : "Escolher datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={custom ? { from: custom.from, to: custom.to } : undefined}
              onSelect={(r) => r?.from && r?.to && onChange("personalizado", { from: r.from, to: r.to })}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}
      <Badge variant="outline" className="ml-auto">📅 {badgeText}</Badge>
    </div>
  );
}
