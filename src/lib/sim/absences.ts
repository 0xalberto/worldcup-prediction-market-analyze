/**
 * Player-absences module (Tier 1 #4a, pre-tournament snapshot).
 *
 * Translates a list of absent key players into a team-level ELO penalty
 * via per-player "criticality" scoring. Captures information the ELO+Poisson
 * model can't see (injuries, suspensions, federation bans, late withdrawals).
 *
 *   criticality = α·(minutes_qual / 720)
 *               + β·(market_value_mil / 150)
 *               + γ·((pos_mult − 1.0) / 0.5)            ∈ [0, 1]
 *
 *   per-player ELO penalty = −5 − 75·criticality
 *   per-team ELO penalty   = Σ penalty, clamped to [−ABSENCE_CAP, 0]
 *
 * Normalization references are fixed constants so criticality is
 * comparable across eras (1990s star ≠ 2020s star in nominal € but
 * each was the top of their league of nations).
 */
import absencesData from '@/data/absences.json';

export type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'WG' | 'ATT';
/** Matches the fixture stage values used by match-stats / tournament. */
export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';

export interface Absence {
  player: string;
  position: Position;
  minutes_qual: number;
  market_value_mil: number;
  reason: string;
  /** If set, the absence only applies from this stage onwards. Default: group. */
  applies_from_stage?: Stage;
}

export interface AbsenceWeights {
  alpha: number;   // weight on minutes
  beta: number;    // weight on market value
  gamma: number;   // weight on positional multiplier
}

/**
 * Default weights from the calibration sweep run 2026-05-17 on WC 2014/18/22.
 * Sweep result: ALL combos regressed Brier on the affected subset (n=14).
 * Same outcome pattern as Tier 1 #1 (host bonus) - historical signal too
 * sparse, with FRA 2022 winning DESPITE Benzema/Pogba/Kanté absences
 * dominating the small sample.
 *
 * Choice: value-dominant (β=0.8, γ=0.2, α=0). β=1.0 was the best individual
 * cell but ignoring position is theoretically wrong (a top-rated GK is more
 * critical than a same-value striker with a backup). α=0 since "qualifier
 * minutes" was the worst signal in the sweep - many key players rotate in
 * qualifiers without being less critical at the tournament.
 *
 * Magnitude unchanged: per-player penalty up to -80, team cap -150. The
 * absences module is plumbed end-to-end but the runtime impact in the live
 * engine is zero until `current` in absences.json is populated by the
 * scraper (currently empty). Backtest can opt in via `absenceWeights`.
 */
export const DEFAULT_ABSENCE_WEIGHTS: AbsenceWeights = { alpha: 0.0, beta: 0.8, gamma: 0.2 };

const POSITION_MULTIPLIER: Record<Position, number> = {
  GK: 1.5,
  CB: 1.3,
  FB: 1.1,
  DM: 1.1,
  CM: 1.1,
  AM: 1.0,
  WG: 1.0,
  ATT: 1.0,
};

const MINUTES_REF = 720;       // 8 qualifier matches × 90 min
const VALUE_REF_MIL = 150;     // global top market value tier (Mbappé/Haaland-era reference)
const POS_OFFSET_DENOM = 0.5;  // (max_mult − base_mult) so GK → 1.0, ATT → 0.0
const PER_PLAYER_BASE = 5;
const PER_PLAYER_RANGE = 75;
const TEAM_PENALTY_CAP = 150;  // no team can lose more than 150 ELO from absences

/**
 * Engine-side toggle. When false, `absenceAdjustment` in match.ts returns 0,
 * effectively disabling the absences penalty in the simulator. UI lookups
 * (currentAbsences) IGNORE this flag - the absences list keeps rendering so
 * users can see the data even when running the "no-injuries" scenario.
 *
 * Used by the worker to run two passes per Monte Carlo: with absences (default)
 * and without (counterfactual showing what we'd predict if every flagged
 * injury were fake/precautionary - a real concern in the pre-tournament window).
 */
let _engineAbsencesEnabled = true;
export function setEngineAbsencesEnabled(v: boolean): void {
  _engineAbsencesEnabled = v;
}
export function isEngineAbsencesEnabled(): boolean {
  return _engineAbsencesEnabled;
}

/** Stage ordering used to decide whether an absence applies "from stage X onwards". */
const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'];

function stageIndex(s: Stage): number {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

/** Returns true if this absence is in effect during the given stage. */
export function appliesAtStage(absence: Absence, stage: Stage): boolean {
  const from = absence.applies_from_stage ?? 'group';
  return stageIndex(stage) >= stageIndex(from);
}

/** Per-player criticality ∈ [0, 1]. */
export function criticality(a: Absence, w: AbsenceWeights): number {
  const minutesNorm = Math.min(1, a.minutes_qual / MINUTES_REF);
  const valueNorm = Math.min(1, a.market_value_mil / VALUE_REF_MIL);
  const posMult = POSITION_MULTIPLIER[a.position] ?? 1.0;
  const posOffset = (posMult - 1.0) / POS_OFFSET_DENOM;  // [0, 1] for ATT..GK
  const raw = w.alpha * minutesNorm + w.beta * valueNorm + w.gamma * posOffset;
  return Math.max(0, Math.min(1, raw));
}

/** Per-player ELO penalty (negative). */
export function playerPenalty(a: Absence, w: AbsenceWeights): number {
  return -(PER_PLAYER_BASE + PER_PLAYER_RANGE * criticality(a, w));
}

/** Sum of per-player penalties for a team, clamped to [-cap, 0]. */
export function teamPenalty(
  absences: Absence[],
  w: AbsenceWeights,
  stage: Stage = 'group',
): number {
  const active = absences.filter((a) => appliesAtStage(a, stage));
  const raw = active.reduce((sum, a) => sum + playerPenalty(a, w), 0);
  return Math.max(-TEAM_PENALTY_CAP, raw);
}

/** Shape of src/data/absences.json. */
interface AbsencesFile {
  _meta: Record<string, unknown>;
  historical: Record<string, Record<string, Absence[]>>;  // year → team_id → absences
  current: Record<string, Absence[] | unknown>;            // team_id → absences (live data)
}

const file = absencesData as unknown as AbsencesFile;

/** Look up historical absences for a (year, team_id) pair. */
export function historicalAbsences(year: number, teamId: string): Absence[] {
  return file.historical?.[String(year)]?.[teamId] ?? [];
}

/** Look up current (live) absences for a team_id (used by match.ts at runtime). */
export function currentAbsences(teamId: string): Absence[] {
  const v = file.current?.[teamId];
  if (Array.isArray(v)) return v as Absence[];
  return [];
}
