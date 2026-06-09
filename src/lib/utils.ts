import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(n: number, digits = 2): string {
  return (n * 100).toFixed(digits) + '%';
}

export function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * 95% Wilson score interval for a Monte Carlo Bernoulli estimate.
 *
 * `count` successes out of `n` independent trials gives p = count/n. We return
 * the Wilson bounds rather than Wald (p ± 1.96·SE) because Wilson stays valid
 * at p=0 and p=1 (Wald collapses to a zero-width band there) and is the
 * standard choice for proportions. For p far from the boundaries and large n
 * the two coincide to four decimals - Wilson costs us nothing.
 *
 * Reference: Wilson 1927; Brown, Cai & DasGupta 2001 "Interval Estimation for
 * a Binomial Proportion" recommends Wilson for n ≥ ~40.
 */
export function wilsonCI(
  count: number,
  n: number,
  z = 1.96,
): { p: number; lo: number; hi: number; halfWidth: number } {
  if (n <= 0) return { p: 0, lo: 0, hi: 0, halfWidth: 0 };
  const p = count / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const lo = Math.max(0, center - margin);
  const hi = Math.min(1, center + margin);
  return { p, lo, hi, halfWidth: (hi - lo) / 2 };
}

/** Formats "lo–hi" as a percentage band, e.g. "20.1–21.4%". */
export function formatCIBand(lo: number, hi: number, digits = 1): string {
  return `${(lo * 100).toFixed(digits)}–${(hi * 100).toFixed(digits)}%`;
}

/** Formats "±half" in percentage points, e.g. "±0.27pp". */
export function formatCIHalf(halfWidth: number, digits = 2): string {
  return `±${(halfWidth * 100).toFixed(digits)}pp`;
}
