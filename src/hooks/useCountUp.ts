import { useEffect, useState } from "react";

/** Conta de 0 (ou prev) até `value` em ~600ms com easing. */
export function useCountUp(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;
    if (from === to) return;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}
