import type { TooltipProps } from "recharts";

// Custom tooltip that uses semantic tokens so text contrasts in both light & dark themes.
// Sorts payload entries descending by value for consistency with charts.
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  sortDesc = true,
  hideZero = false,
}: TooltipProps<number, string> & {
  formatter?: (v: number, name?: string) => string;
  sortDesc?: boolean;
  hideZero?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  let items = [...payload];
  if (hideZero) items = items.filter((p) => Number(p.value) !== 0);
  if (sortDesc) items.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));

  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
      {label !== undefined && label !== "" && (
        <div className="mb-1 font-medium text-foreground">{label}</div>
      )}
      <ul className="space-y-0.5">
        {items.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: (p.color || p.payload?.color) as string }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto tabular-nums font-semibold text-foreground">
              {formatter ? formatter(Number(p.value), String(p.name)) : String(p.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
