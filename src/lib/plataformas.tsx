// Cores reais de cada plataforma (usado em selects, badges e bolinhas)
export const PLATAFORMA_COLOR: Record<string, string> = {
  Uber: "#000000",
  "99": "#FFCC00",
  InDrive: "#00C566",
  Particular: "#9CA3AF",
  Outras: "#8B5CF6",
};

export const PLATAFORMAS_LIST: { value: string; label: string }[] = [
  { value: "Uber", label: "Uber" },
  { value: "99", label: "99" },
  { value: "InDrive", label: "InDrive" },
  { value: "Particular", label: "Particular" },
  { value: "Outras", label: "Outras" },
];

export function plataformaColor(p: string | null | undefined): string {
  if (!p) return PLATAFORMA_COLOR.Outras;
  return PLATAFORMA_COLOR[p] ?? PLATAFORMA_COLOR.Outras;
}

interface DotProps {
  plataforma?: string | null;
  size?: number;
  className?: string;
}

export function PlataformaDot({ plataforma, size = 10, className = "" }: DotProps) {
  const color = plataformaColor(plataforma);
  const ring = plataforma === "Uber" ? "0 0 0 1px rgba(255,255,255,0.4)" : undefined;
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: ring,
      }}
    />
  );
}
