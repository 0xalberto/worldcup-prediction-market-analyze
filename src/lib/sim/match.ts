import type { Team } from './types';
import { HOST_BONUS } from './elo';
import { lambdaFor, samplePoisson } from './goals';
import type { XoshiroRNG } from './rng';
import {
  currentAbsences,
  teamPenalty,
  isEngineAbsencesEnabled,
  DEFAULT_ABSENCE_WEIGHTS,
  type Stage,
} from './absences';
import { liveSuspensions } from './state';

/**
 * Recent-form blend (Tier 1 #2, calibrated 2026-05-17 via backtest sweep).
 *
 * Idea: eloratings.net's K-factor is calibrated for the full mix of
 * friendlies + qualifiers + tournaments, so it updates slowly. A team
 * that has clearly leveled up in the last 12 months (e.g. Argentina
 * 2021→2022: +107 ELO from Copa America + unbeaten run) gets too little
 * credit. We add a small extra adjustment proportional to the 12-month
 * delta, capped to avoid outliers blowing up.
 *
 *   ELO_eff = ELO + clamp(α · (ELO − ELO_1y_ago), ±RECENT_CAP_ELO)
 *
 * Sweep on WCs 2014/2018/2022 (n=192) selected (α=0.2, lookback=1y) as
 * the empirical optimum, improving accuracy +1.6pp with no Brier
 * regression. Effect size is small - direction is the signal.
 */
export const RECENT_ALPHA = 0.20;
const RECENT_CAP_ELO = 150;

export function recentFormAdjustment(team: Team): number {
  if (team.elo_1y_ago == null) return 0;
  const adj = RECENT_ALPHA * (team.elo - team.elo_1y_ago);
  return Math.max(-RECENT_CAP_ELO, Math.min(RECENT_CAP_ELO, adj));
}

/**
 * Per-team ELO penalty from documented current absences (Tier 1 #4a).
 * Stage-aware: a player marked "applies_from_stage: sf" only penalizes
 * SF onwards. Currently uses DEFAULT_ABSENCE_WEIGHTS - to be replaced by
 * calibration sweep result (Tier 1 #4a calibration).
 */
export function absenceAdjustment(team: Team, stage: Stage = 'group'): number {
  if (!isEngineAbsencesEnabled()) return 0;
  // Pre-tournament absences (injuries snapshot from transfermarkt) +
  // live in-tournament suspensions derived from card events. Both feed the
  // same criticality / penalty pipeline.
  const list = [...currentAbsences(team.id), ...liveSuspensions(team.id)];
  if (list.length === 0) return 0;
  return teamPenalty(list, DEFAULT_ABSENCE_WEIGHTS, stage);
}

/** Effective ELO for live simulation = base ELO + recent-form + absences. */
export function effectiveElo(team: Team, stage: Stage = 'group'): number {
  return team.elo + recentFormAdjustment(team) + absenceAdjustment(team, stage);
}

/**
 * Decide host-side bonus when the "home" team (per the fixture) is a host nation.
 * Hosts: USA, Mexico, Canada. They play their group matches on home soil.
 *
 * Simplified rule: host team gets +100 in any of its matches; non-host opponent gets 0.
 * In knockout, all matches are effectively neutral (no host bonus).
 *
 * The bonus value was empirically sweeped (Tier 1 #1) - the current +100 is
 * neither helpful nor harmful on the WC 2014/2018/2022 backtest set (n=28
 * host-involving matches, within noise). Kept at 100 pending more data.
 */
export function hostBonus(team: Team, isKnockout: boolean): number {
  if (isKnockout) return 0;
  return team.is_host ? HOST_BONUS : 0;
}

/**
 * Post-extra-time fatigue penalty (Tier 1 #5).
 * A team that won its previous knockout match in extra time / penalties played
 * ~30 min more than a rival who won in regulation. We multiply that team's λ
 * by FATIGUE_LAMBDA_FACTOR in their next match. Magnitude conservative - feel
 * free to recalibrate against backtest data once carryover is wired there.
 */
export const FATIGUE_LAMBDA_FACTOR = 0.92;

/** Sample a regulation-time score (goals_a, goals_b) for a match between teams a and b. */
export function sampleScore(
  a: Team,
  b: Team,
  rng: XoshiroRNG,
  isKnockout: boolean,
  stage: Stage = 'group',
  fatigueA: boolean = false,
  fatigueB: boolean = false,
): { ga: number; gb: number } {
  const eloA = effectiveElo(a, stage);
  const eloB = effectiveElo(b, stage);
  const bonusA = hostBonus(a, isKnockout);
  const bonusB = hostBonus(b, isKnockout);
  let lambdaA = lambdaFor(eloA, eloB, bonusA);
  let lambdaB = lambdaFor(eloB, eloA, bonusB);
  if (fatigueA) lambdaA *= FATIGUE_LAMBDA_FACTOR;
  if (fatigueB) lambdaB *= FATIGUE_LAMBDA_FACTOR;
  return {
    ga: samplePoisson(lambdaA, rng),
    gb: samplePoisson(lambdaB, rng),
  };
}
