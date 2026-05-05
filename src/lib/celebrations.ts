import confetti from "canvas-confetti";

export function fireGoalConfetti() {
  const duration = 1500;
  const end = Date.now() + duration;
  const colors = ["#a855f7", "#22d3ee", "#10b981", "#f59e0b"];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60, spread: 55, origin: { x: 0 }, colors,
    });
    confetti({
      particleCount: 4,
      angle: 120, spread: 55, origin: { x: 1 }, colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

const KEY_PREFIX = "driveIA_meta_atingida_";
export function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
export function shouldCelebrateGoal(currentValue: number, goal: number): boolean {
  if (goal <= 0 || currentValue < goal) return false;
  const k = KEY_PREFIX + todayKey();
  if (localStorage.getItem(k)) return false;
  localStorage.setItem(k, "1");
  return true;
}
