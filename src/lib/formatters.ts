/**
 * Converte horas decimais para formato hh:mm
 * Ex: 0.8 → "0:48" | 1.5 → "1:30" | 0.0 → "0:00"
 */
export function formatHorasHHMM(horasDecimal: number): string {
  if (!horasDecimal || horasDecimal <= 0) return "0:00";
  const totalMin = Math.round(horasDecimal * 60);
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  return `${horas}:${String(minutos).padStart(2, "0")}`;
}
