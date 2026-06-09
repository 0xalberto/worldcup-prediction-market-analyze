/**
 * Helper functions for deriving per-match statistics from the engine output.
 * Used by both MatchDetailDrawer (on-demand) and MatchCalendar (batch).
 */

import type { Team, MatchAggregateSerialized } from './types';
import { lambdaFor, BASE_LAMBDA } from './goals';
import { HOST_BONUS } from './elo';
import { effectiveElo } from './match';

export interface MatchStats {
  homeTeam: Team;
  awayTeam: Team;
  count: number;
  /** Conditional probabilities given the matchup occurred. */
  winsHome: number;
  draws: number;
  winsAway: number;
  /** Mean goals from the simulation. */
  meanGoalsHome: number;
  meanGoalsAway: number;
  /** Theoretical λ from the model (independent of simulation noise). */
  lambdaHome: number;
  lambdaAway: number;
  /** Score histogram normalized to probability per cell. 8×8 grid. */
  scoreProb: Float64Array;
  /** Top N scorelines, sorted by probability. */
  topScores: Array<{ home: number; away: number; prob: number }>;
  /** Estimated corners and yellow cards (very rough - see methodology). */
  cornersHome: number;
  cornersAway: number;
  yellowsHome: number;
  yellowsAway: number;
}

const WC_AVG_CORNERS = 5.1;
const WC_AVG_YELLOWS = 1.9;

/**
 * Build a MatchStats object from a fixture aggregate + team lookups.
 *
 * isGroup determines whether host bonus applies (only group games).
 */
export function buildMatchStats(
  fixture: MatchAggregateSerialized,
  teamById: Map<string, Team>,
): MatchStats | null {
  const homeTeam = teamById.get(fixture.home);
  const awayTeam = teamById.get(fixture.away);
  if (!homeTeam || !awayTeam) return null;

  const isGroup = fixture.stage === 'group';
  const bonusHome = isGroup && homeTeam.is_host ? HOST_BONUS : 0;
  const bonusAway = isGroup && awayTeam.is_host ? HOST_BONUS : 0;
  // Use effective ELO (recent-form blend + absences at this stage) so the
  // per-match stats shown in the drawer reflect the same model the engine samples.
  const eloHome = effectiveElo(homeTeam, fixture.stage);
  const eloAway = effectiveElo(awayTeam, fixture.stage);
  const lambdaHome = lambdaFor(eloHome, eloAway, bonusHome);
  const lambdaAway = lambdaFor(eloAway, eloHome, bonusAway);

  const scoreProb = new Float64Array(64);
  if (fixture.count > 0) {
    for (let i = 0; i < 64; i++) scoreProb[i] = fixture.scoreHist[i] / fixture.count;
  }

  const topScores: Array<{ home: number; away: number; prob: number }> = [];
  for (let h = 0; h < 8; h++) {
    for (let a = 0; a < 8; a++) {
      const p = scoreProb[h * 8 + a];
      if (p > 0) topScores.push({ home: h, away: a, prob: p });
    }
  }
  topScores.sort((x, y) => y.prob - x.prob);

  // Corners/yellows: scale by team's lambda vs the WC average lambda (≈1.30).
  const cornersHome = WC_AVG_CORNERS * (lambdaHome / BASE_LAMBDA);
  const cornersAway = WC_AVG_CORNERS * (lambdaAway / BASE_LAMBDA);
  const yellowsHome = WC_AVG_YELLOWS * (lambdaAway / BASE_LAMBDA); // more pressure from opponent → more cards
  const yellowsAway = WC_AVG_YELLOWS * (lambdaHome / BASE_LAMBDA);

  return {
    homeTeam,
    awayTeam,
    count: fixture.count,
    winsHome: fixture.count > 0 ? fixture.winsHome / fixture.count : 0,
    draws:    fixture.count > 0 ? fixture.draws    / fixture.count : 0,
    winsAway: fixture.count > 0 ? fixture.winsAway / fixture.count : 0,
    meanGoalsHome: fixture.count > 0 ? fixture.sumGoalsHome / fixture.count : 0,
    meanGoalsAway: fixture.count > 0 ? fixture.sumGoalsAway / fixture.count : 0,
    lambdaHome,
    lambdaAway,
    scoreProb,
    topScores: topScores.slice(0, 5),
    cornersHome,
    cornersAway,
    yellowsHome,
    yellowsAway,
  };
}
