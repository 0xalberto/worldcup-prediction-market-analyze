import confetti from 'canvas-confetti';

const BRAND_COLORS = [
  'oklch(0.76 0.13 180)',
  'oklch(0.88 0.11 180)',
  'oklch(0.72 0.17 155)',
  'oklch(0.65 0.20 295)',
  'oklch(0.97 0.005 260)',
];

/** Side cannons — same celebration used after a sim finishes or a demo trade lands. */
export function fireConfetti(durationMs = 2000) {
  const end = Date.now() + durationMs;
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors: BRAND_COLORS,
      gravity: 0.9,
      scalar: 1.1,
      drift: 0.5,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors: BRAND_COLORS,
      gravity: 0.9,
      scalar: 1.1,
      drift: -0.5,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
