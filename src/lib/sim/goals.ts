/**
 * Goal-sampling model: independent Poisson with λ derived from ELO difference + home bonus.
 *
 *   λ_A = clamp( BASE + ALPHA · (ELO_A − ELO_B + home_bonus_A) / 100,  MIN, MAX )
 *
 * BASE = 1.30 - mean goals per team in recent World Cup matches.
 * ALPHA = 0.18 - sensitivity to ELO gap (calibrated against historical scoring).
 *
 * Sampling: Knuth's algorithm for λ < 30 (no real match exceeds that),
 * O(λ) expected steps, fast and allocation-free.
 */

import type { XoshiroRNG } from './rng';

export const BASE_LAMBDA = 1.30;
export const ALPHA = 0.18;
const LAMBDA_MIN = 0.15;
const LAMBDA_MAX = 6.0;

export function lambdaFor(eloSelf: number, eloOpp: number, homeBonus = 0): number {
  const raw = BASE_LAMBDA + (ALPHA * (eloSelf - eloOpp + homeBonus)) / 100;
  if (raw < LAMBDA_MIN) return LAMBDA_MIN;
  if (raw > LAMBDA_MAX) return LAMBDA_MAX;
  return raw;
}

/** Sample one Poisson-distributed goal count. Knuth method. */
export function samplePoisson(lambda: number, rng: XoshiroRNG): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  while (true) {
    k++;
    p *= rng.next();
    if (p <= L) return k - 1;
    if (k > 50) return k - 1; // safety cap, should never hit for λ ≤ 6
  }
}
