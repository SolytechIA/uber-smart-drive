import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Veículo" },
  { n: 2, label: "Custos" },
  { n: 3, label: "Metas" },
];

export function StepProgress({ current }: { current: number }) {
  const pct = ((current - 1) / (STEPS.length - 1)) * 100;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Etapa {current} de {STEPS.length}</span>
        <span>{Math.round((current / STEPS.length) * 100)}%</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full transition-all duration-500 [background:var(--gradient-primary)]"
          style={{ width: `${(current / STEPS.length) * 100}%` }}
        />
      </div>
      <div className="relative mt-4 flex justify-between">
        <div className="absolute left-0 right-0 top-4 -z-10 h-0.5 bg-border" />
        <div
          className="absolute left-0 top-4 -z-10 h-0.5 transition-all duration-500 [background:var(--gradient-primary)]"
          style={{ width: `${pct}%` }}
        />
        {STEPS.map((s) => {
          const done = s.n < current;
          const active = s.n === current;
          return (
            <div key={s.n} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  done && "border-transparent text-primary-foreground [background:var(--gradient-primary)]",
                  active && "border-primary bg-background text-primary shadow-glow",
                  !done && !active && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
