/** Opening match: Mexico vs South Africa, 13:00 Mexico City (UTC−6, no DST). */
export const WC2026_KICKOFF_MS = Date.parse('2026-06-11T13:00:00-06:00');

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function getCountdownParts(targetMs: number, nowMs = Date.now()): CountdownParts {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3_600),
    minutes: Math.floor((totalSec % 3_600) / 60),
    seconds: totalSec % 60,
    totalMs,
  };
}
