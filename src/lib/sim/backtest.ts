/**
 * Match-level backtest engine.
 *
 * Given pre-tournament ELO and historical match results from WCs 2014/2018/2022,
 * computes per-match predicted probabilities under the current model
 * (ELO + Poisson + host bonus) and aggregates calibration metrics.
 *
 * We score MATCHES, not full tournaments - running the full bracket would
 * require a 32-team engine variant. The match predictor is the atomic
 * operation of the simulator, so its calibration is what matters first.
 *
 * Metrics:
 *   - Brier score (multi-class, lower is better): mean squared error
 *     between predicted probability vector and one-hot observed outcome,
 *     summed over the 3 classes (home/draw/away). Range [0, 2].
 *   - Log loss: −mean(log p_observed). Lower is better. Penalizes
 *     overconfident wrong predictions.
 *   - Top-1 accuracy: fraction of matches where the highest-probability
 *     outcome matches the actual result.
 *
 * Reference values for a 3-class football model:
 *   Random uniform     Brier 0.667  LogLoss 1.099  Acc 33%
 *   Pick favorite only Brier 0.55   LogLoss 0.99   Acc 50%
 *   Solid model (SPI)  Brier 0.45   LogLoss 0.95   Acc 58%
 *   Market consensus   Brier 0.42   LogLoss 0.90   Acc 60%
 */

import { lambdaFor } from './goals';
import { HOST_BONUS } from './elo';
import { shootoutWinProb, shootoutRate, shootoutSampleSize } from './penalties';
import {
  historicalAbsences,
  teamPenalty,
  DEFAULT_ABSENCE_WEIGHTS,
  type AbsenceWeights,
  type Stage as AbsenceStage,
} from './absences';
import backtestData from '@/data/backtest.json';

const MAX_GOALS = 8;  // P(>8 goals at λ=3) ≈ 0.001 - negligible

type Stage = 'group' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';

interface RawMatch {
  date: string;
  stage: Stage;
  home: string;
  away: string;
  gh: number;
  ga: number;
  /** 'home', 'away', or null/undefined if the match wasn't decided on penalties. */
  pen_winner?: 'home' | 'away' | null;
}

interface RawTournament {
  year: number;
  host_id: string;
  host_name: string;
  elo: Record<string, number>;
  /** Optional historical ELO snapshots keyed by `years_before` as string. */
  elo_history?: Record<string, Record<string, number>>;
  matches: RawMatch[];
}

interface BacktestFile {
  _meta: { sources: string[]; fetched_at: string; note: string };
  tournaments: RawTournament[];
}

/** Poisson PMF - small λ regime, no overflow concerns at k ≤ 8. */
function poissonPMF(k: number, lambda: number): number {
  // P(k; λ) = e^(-λ) * λ^k / k!
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

export interface MatchPrediction {
  /** Probability home team wins in regulation. */
  pHome: number;
  /** Probability of regulation draw. */
  pDraw: number;
  /** Probability away team wins in regulation. */
  pAway: number;
  lambdaHome: number;
  lambdaAway: number;
}

export function predictMatch(
  eloHome: number, eloAway: number,
  homeBonus: number, awayBonus: number,
): MatchPrediction {
  const lambdaHome = lambdaFor(eloHome, eloAway, homeBonus);
  const lambdaAway = lambdaFor(eloAway, eloHome, awayBonus);

  // Precompute PMFs once each.
  const pH = new Array(MAX_GOALS + 1);
  const pA = new Array(MAX_GOALS + 1);
  for (let k = 0; k <= MAX_GOALS; k++) {
    pH[k] = poissonPMF(k, lambdaHome);
    pA[k] = poissonPMF(k, lambdaAway);
  }

  let pHome = 0, pDraw = 0, pAway = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const joint = pH[h] * pA[a];
      if (h > a) pHome += joint;
      else if (h === a) pDraw += joint;
      else pAway += joint;
    }
  }
  // Renormalize for the truncated tail (>MAX_GOALS).
  const norm = pHome + pDraw + pAway;
  return {
    pHome: pHome / norm,
    pDraw: pDraw / norm,
    pAway: pAway / norm,
    lambdaHome,
    lambdaAway,
  };
}

export interface ScoredMatch {
  date: string;
  year: number;
  stage: Stage;
  home: string;
  away: string;
  gh: number;
  ga: number;
  pred: MatchPrediction;
  /** 0 = home win, 1 = draw, 2 = away win. */
  observedClass: 0 | 1 | 2;
  brier: number;
  logLoss: number;
  /** Probability the model assigned to the actual result. */
  pActual: number;
  predictedClass: 0 | 1 | 2;
}

export interface Aggregate {
  count: number;
  brier: number;
  logLoss: number;
  accuracy: number;
}

export interface CalibrationBucket {
  /** Center of the bucket (predicted prob). */
  predicted: number;
  /** Mean observed frequency of the predicted class in this bucket. */
  observed: number;
  count: number;
}

export interface BacktestResult {
  perTournament: Array<{ year: number; host: string; aggregate: Aggregate }>;
  overall: Aggregate;
  perStage: Record<Stage, Aggregate>;
  calibration: CalibrationBucket[];
  /** Largest model misses - predicted very low for what actually happened. */
  worstMisses: ScoredMatch[];
  /** Best calls - model assigned high probability to actual outcome. */
  bestCalls: ScoredMatch[];
  scored: ScoredMatch[];
}

export interface BacktestOptions {
  /** ELO points added to the host team when they play (default: HOST_BONUS = 100). */
  hostBonus?: number;
  /** Apply the host bonus in knockout matches too, not only group stage (default: false). */
  applyInKO?: boolean;
  /**
   * Recent-form weighting. ELO_eff = ELO + clamp(α · (ELO − ELO_X_years_ago), ±150).
   * α = 0 disables (default). Lookback range must exist in the dataset.
   */
  recentAlpha?: number;
  /** Lookback window in years for the ELO delta (default: 1). */
  recentLookbackYears?: number;
  /**
   * Player-absences weighting (Tier 1 #4a). If provided, looks up
   * historical absences for each (year, team_id) and subtracts a per-team
   * ELO penalty based on the criticality formula in absences.ts.
   * Pass `null` (or omit) to disable. Default disabled so legacy backtests
   * keep their baseline numbers.
   */
  absenceWeights?: AbsenceWeights | null;
}

/** Cap on the |α·Δ| adjustment to avoid outliers blowing up predictions. */
const RECENT_CAP_ELO = 150;

function recentFormAdjustment(
  teamId: string,
  baseElo: number,
  history: Record<string, Record<string, number>> | undefined,
  alpha: number,
  lookbackYears: number,
): number {
  if (alpha === 0 || !history) return 0;
  const snap = history[String(lookbackYears)];
  if (!snap) return 0;
  const past = snap[teamId];
  if (past === undefined) return 0;  // team didn't exist / not in older snapshot
  const delta = baseElo - past;
  const adj = alpha * delta;
  return Math.max(-RECENT_CAP_ELO, Math.min(RECENT_CAP_ELO, adj));
}

function scoreMatch(
  m: RawMatch, year: number, hostId: string, elo: Record<string, number>,
  history: Record<string, Record<string, number>> | undefined,
  opts: Required<Omit<BacktestOptions, 'absenceWeights'>> & { absenceWeights: AbsenceWeights | null },
): ScoredMatch | null {
  const eloH = elo[m.home];
  const eloA = elo[m.away];
  if (eloH === undefined || eloA === undefined) return null;

  // Recent-form blend: each team's effective ELO is adjusted by α · Δ.
  let eloHEff = eloH + recentFormAdjustment(m.home, eloH, history, opts.recentAlpha, opts.recentLookbackYears);
  let eloAEff = eloA + recentFormAdjustment(m.away, eloA, history, opts.recentAlpha, opts.recentLookbackYears);

  // Player-absences penalty: stage-aware lookup from absences.json.
  if (opts.absenceWeights) {
    const stage = m.stage as AbsenceStage;
    const absH = historicalAbsences(year, m.home);
    const absA = historicalAbsences(year, m.away);
    if (absH.length > 0) eloHEff += teamPenalty(absH, opts.absenceWeights, stage);
    if (absA.length > 0) eloAEff += teamPenalty(absA, opts.absenceWeights, stage);
  }

  // Host bonus: configurable value + whether to apply in KO.
  const inHostMatch = opts.applyInKO || m.stage === 'group';
  const bonusH = inHostMatch && m.home === hostId ? opts.hostBonus : 0;
  const bonusA = inHostMatch && m.away === hostId ? opts.hostBonus : 0;

  const pred = predictMatch(eloHEff, eloAEff, bonusH, bonusA);
  const observedClass: 0 | 1 | 2 = m.gh > m.ga ? 0 : m.gh === m.ga ? 1 : 2;
  const pVec = [pred.pHome, pred.pDraw, pred.pAway];
  const pActual = pVec[observedClass];

  // Multi-class Brier: Σ (p_c − y_c)^2
  let brier = 0;
  for (let c = 0; c < 3; c++) {
    const y = c === observedClass ? 1 : 0;
    brier += (pVec[c] - y) ** 2;
  }
  // Log loss for the observed class only (with small floor to avoid -Infinity).
  const logLoss = -Math.log(Math.max(pActual, 1e-9));
  const predictedClass = (pVec.indexOf(Math.max(...pVec))) as 0 | 1 | 2;

  return {
    date: m.date,
    year, stage: m.stage,
    home: m.home, away: m.away,
    gh: m.gh, ga: m.ga,
    pred, observedClass, brier, logLoss, pActual, predictedClass,
  };
}

function aggregate(scored: ScoredMatch[]): Aggregate {
  if (scored.length === 0) return { count: 0, brier: 0, logLoss: 0, accuracy: 0 };
  const n = scored.length;
  const sumBrier = scored.reduce((s, m) => s + m.brier, 0);
  const sumLog = scored.reduce((s, m) => s + m.logLoss, 0);
  const correct = scored.filter((m) => m.predictedClass === m.observedClass).length;
  return {
    count: n,
    brier: sumBrier / n,
    logLoss: sumLog / n,
    accuracy: correct / n,
  };
}

function buildCalibration(scored: ScoredMatch[]): CalibrationBucket[] {
  const N_BUCKETS = 10;
  const buckets: Array<{ totalPred: number; totalObs: number; count: number }> = [];
  for (let i = 0; i < N_BUCKETS; i++) {
    buckets.push({ totalPred: 0, totalObs: 0, count: 0 });
  }
  // For each match, accumulate a sample per (class, predicted_prob, observed_indicator).
  for (const m of scored) {
    const pVec = [m.pred.pHome, m.pred.pDraw, m.pred.pAway];
    for (let c = 0; c < 3; c++) {
      const p = pVec[c];
      const obs = c === m.observedClass ? 1 : 0;
      const bucket = Math.min(N_BUCKETS - 1, Math.floor(p * N_BUCKETS));
      buckets[bucket].totalPred += p;
      buckets[bucket].totalObs += obs;
      buckets[bucket].count += 1;
    }
  }
  return buckets.map((b, i) => ({
    predicted: b.count > 0 ? b.totalPred / b.count : (i + 0.5) / N_BUCKETS,
    observed: b.count > 0 ? b.totalObs / b.count : 0,
    count: b.count,
  }));
}

export function runBacktest(options: BacktestOptions = {}): BacktestResult {
  const opts = {
    hostBonus: options.hostBonus ?? HOST_BONUS,
    applyInKO: options.applyInKO ?? false,
    recentAlpha: options.recentAlpha ?? 0,
    recentLookbackYears: options.recentLookbackYears ?? 1,
    absenceWeights: options.absenceWeights ?? null,
  };
  const file = backtestData as unknown as BacktestFile;
  const scored: ScoredMatch[] = [];
  const perTournament: BacktestResult['perTournament'] = [];

  for (const t of file.tournaments) {
    const tScored: ScoredMatch[] = [];
    for (const m of t.matches) {
      const s = scoreMatch(m, t.year, t.host_id, t.elo, t.elo_history, opts);
      if (s) tScored.push(s);
    }
    scored.push(...tScored);
    perTournament.push({ year: t.year, host: t.host_name, aggregate: aggregate(tScored) });
  }

  const perStage = {} as Record<Stage, Aggregate>;
  for (const stage of ['group', 'r16', 'qf', 'sf', '3rd', 'final'] as Stage[]) {
    perStage[stage] = aggregate(scored.filter((s) => s.stage === stage));
  }

  // Worst misses: highest logLoss (= lowest p for the actual outcome).
  const worstMisses = [...scored].sort((a, b) => b.logLoss - a.logLoss).slice(0, 8);
  const bestCalls = [...scored].sort((a, b) => a.logLoss - b.logLoss).slice(0, 8);

  return {
    perTournament,
    overall: aggregate(scored),
    perStage,
    calibration: buildCalibration(scored),
    worstMisses,
    bestCalls,
    scored,
  };
}

/**
 * Sweep the host-bonus value to find the empirical optimum on the backtest set.
 *
 * Returns two metric series for each bonus value:
 *   - `overall`: Brier / accuracy across all 192 matches (diluted - only ~22
 *     matches actually involve a host team across the 3 WCs).
 *   - `hostOnly`: same metrics restricted to matches where one team is the
 *     host nation. This is where the bonus actually changes predictions, so
 *     the effect size is much bigger and easier to read.
 *
 * Two flavors per bonus value:
 *   - `applyInKO=false` (current engine rule - group only)
 *   - `applyInKO=true`  (proposed: also boost in knockout)
 */
export interface SweepPoint {
  hostBonus: number;
  applyInKO: boolean;
  overall: Aggregate;
  hostOnly: Aggregate;
}

const HOST_IDS = new Set<string>();

/**
 * 2-D sweep for the recent-form blend.
 * For each (alpha, lookbackYears) we report the overall Brier across all
 * 192 matches - every match is potentially affected (unlike the host sweep
 * which only moved 28 host-involving matches).
 */
export interface RecentFormSweepCell {
  alpha: number;
  lookbackYears: number;
  overall: Aggregate;
}

export function runRecentFormSweep(
  alphas: number[] = [0, 0.1, 0.2, 0.3, 0.5],
  lookbacks: number[] = [1, 2, 3, 4, 5],
): RecentFormSweepCell[] {
  const out: RecentFormSweepCell[] = [];
  for (const lookbackYears of lookbacks) {
    for (const alpha of alphas) {
      const r = runBacktest({ recentAlpha: alpha, recentLookbackYears: lookbackYears });
      out.push({ alpha, lookbackYears, overall: r.overall });
    }
  }
  return out;
}

/**
 * Evaluate the penalty model against the actual shoot-outs in the backtest
 * dataset. For each match where regulation ended in a draw and PKs were
 * taken, we compute `shootoutWinProb(home, away, cutoffYear=tournamentYear)`
 * (so the historical rates EXCLUDE the very shootouts we're predicting -
 * no look-ahead) and compare against the actual penalty winner.
 *
 * Returns: per-match prediction + aggregate accuracy + Brier score vs 50/50
 * baseline.
 */
export interface PenaltyEvalRow {
  year: number;
  stage: Stage;
  home: string;
  away: string;
  rateHome: number;
  rateAway: number;
  nHome: number;
  nAway: number;
  pHome: number;
  /** Actual penalty winner: 'home' or 'away'. */
  actual: 'home' | 'away';
  modelPicked: 'home' | 'away';
  correct: boolean;
  /** Brier score for the model's pHome vs the observed outcome (home=1, away=0). */
  brier: number;
  brierBaseline: number;
}

export interface PenaltyEvalSummary {
  count: number;
  modelAccuracy: number;
  baselineAccuracy: number;  // always 0.5 for fair coin
  modelBrier: number;
  baselineBrier: number;     // always 0.25 for p=0.5
  rows: PenaltyEvalRow[];
}

export function runPenaltyEvaluation(): PenaltyEvalSummary {
  const file = backtestData as unknown as BacktestFile;
  const rows: PenaltyEvalRow[] = [];
  for (const t of file.tournaments) {
    for (const m of t.matches) {
      if (!m.pen_winner) continue;
      const pHome = shootoutWinProb(m.home, m.away, t.year);  // cutoff = tournament year (excludes this shootout)
      const modelPicked: 'home' | 'away' = pHome >= 0.5 ? 'home' : 'away';
      const y = m.pen_winner === 'home' ? 1 : 0;
      const brier = (pHome - y) ** 2;
      const brierBaseline = (0.5 - y) ** 2;
      rows.push({
        year: t.year,
        stage: m.stage,
        home: m.home,
        away: m.away,
        rateHome: shootoutRate(m.home, t.year),
        rateAway: shootoutRate(m.away, t.year),
        nHome: shootoutSampleSize(m.home, t.year),
        nAway: shootoutSampleSize(m.away, t.year),
        pHome,
        actual: m.pen_winner,
        modelPicked,
        correct: modelPicked === m.pen_winner,
        brier,
        brierBaseline,
      });
    }
  }
  const n = rows.length;
  if (n === 0) {
    return {
      count: 0, modelAccuracy: 0, baselineAccuracy: 0.5,
      modelBrier: 0, baselineBrier: 0.25, rows: [],
    };
  }
  return {
    count: n,
    modelAccuracy: rows.filter((r) => r.correct).length / n,
    baselineAccuracy: 0.5,
    modelBrier: rows.reduce((s, r) => s + r.brier, 0) / n,
    baselineBrier: 0.25,
    rows,
  };
}

/**
 * Sweep the (α, β, γ) simplex for the absences weight function.
 * α + β + γ = 1.0 is enforced; combos that don't sum to ~1.0 are skipped.
 *
 * Reports two aggregates per cell:
 *   - `overall`: Brier across all 192 matches (most won't be affected)
 *   - `affected`: Brier restricted to matches where at least one team had a
 *     documented absence at that stage. This is the calibration signal.
 *
 * The affected set is small (~10-15 matches across WC 2014/18/22 with our
 * current historical seed). Interpret with care - n is low.
 */
export interface AbsenceSweepCell {
  alpha: number;
  beta: number;
  gamma: number;
  overall: Aggregate;
  affected: Aggregate;
}

function isAffectedMatch(year: number, home: string, away: string, stage: Stage): boolean {
  const absH = historicalAbsences(year, home);
  const absA = historicalAbsences(year, away);
  const stageMatchesAny = (list: ReturnType<typeof historicalAbsences>) =>
    list.some((a) => {
      const from = (a.applies_from_stage ?? 'group') as Stage;
      const order: Stage[] = ['group', 'r16', 'qf', 'sf', '3rd', 'final'];
      return order.indexOf(stage) >= order.indexOf(from);
    });
  return stageMatchesAny(absH) || stageMatchesAny(absA);
}

export function runAbsenceSweep(stepSize: number = 0.1): AbsenceSweepCell[] {
  const out: AbsenceSweepCell[] = [];
  const steps = Math.round(1 / stepSize) + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps - i; j++) {
      const alpha = +(i * stepSize).toFixed(2);
      const beta = +(j * stepSize).toFixed(2);
      const gamma = +(1 - alpha - beta).toFixed(2);
      if (gamma < -1e-9) continue;
      const r = runBacktest({ absenceWeights: { alpha, beta, gamma } });
      const affected = aggregate(
        r.scored.filter((s) => isAffectedMatch(s.year, s.home, s.away, s.stage)),
      );
      out.push({ alpha, beta, gamma, overall: r.overall, affected });
    }
  }
  return out;
}

/** Run a baseline (absences off) and return Brier on the affected subset for reference. */
export function runAbsenceBaseline(): { overall: Aggregate; affected: Aggregate } {
  const r = runBacktest();
  const affected = aggregate(
    r.scored.filter((s) => isAffectedMatch(s.year, s.home, s.away, s.stage)),
  );
  return { overall: r.overall, affected };
}

export function runBonusSweep(values: number[] = [0, 50, 80, 100, 120, 150, 180, 220]): SweepPoint[] {
  const file = backtestData as unknown as BacktestFile;
  if (HOST_IDS.size === 0) {
    for (const t of file.tournaments) HOST_IDS.add(t.host_id);
  }

  const isHostMatch = (m: ScoredMatch) => HOST_IDS.has(m.home) || HOST_IDS.has(m.away);

  const out: SweepPoint[] = [];
  for (const applyInKO of [false, true]) {
    for (const hostBonus of values) {
      const r = runBacktest({ hostBonus, applyInKO });
      const hostOnly = aggregate(r.scored.filter(isHostMatch));
      out.push({ hostBonus, applyInKO, overall: r.overall, hostOnly });
    }
  }
  return out;
}
