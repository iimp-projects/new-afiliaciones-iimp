import confetti from "canvas-confetti";

const CONFETTI_COLORS = ["#C5A059", "#E8D09E", "#D6A84A", "#2F3136", "#F7F8FA"];

/**
 * Dispara la celebración de confetti una única vez por envío exitoso.
 * `firedRef` actúa como guard para impedir disparos repetidos (re-renders,
 * Strict Mode, etc.). Respeta `prefers-reduced-motion`.
 */
export function fireSubmissionConfetti(firedRef: { current: boolean }): void {
  if (firedRef.current) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  firedRef.current = true;

  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 150 };
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = window.setInterval(function () {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return window.clearInterval(interval);
    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      colors: CONFETTI_COLORS,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      colors: CONFETTI_COLORS,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}
