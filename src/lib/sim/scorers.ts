/**
 * Goal-distribution among players. We don't model players in the match
 * simulation - this is a multinomial sampler that takes a team's goal-share
 * table and the number of goals scored in a given match, and returns goals
 * per player. Aggregated across simulations it gives expected goals per
 * player.
 *
 * Honest about limits: doesn't model substitutions, injuries, form, or
 * intra-team correlation. Treat it as a "if the team scores G goals, who
 * tends to score them based on recent form" prior.
 */

import type { XoshiroRNG } from './rng';
import scorersData from '@/data/scorers.json';

export interface ScorerEntry {
  name: string;
  share: number;
}

interface PrecomputedTeam {
  names: string[];
  /** cumulative shares - last entry should be ≈ 1.0 */
  cum: number[];
}

const RAW = scorersData as unknown as Record<string, ScorerEntry[] | { share: number }[]>;

/** Precompute cumulative shares per team for fast multinomial sampling. */
function buildIndex(): Record<string, PrecomputedTeam | undefined> {
  const out: Record<string, PrecomputedTeam | undefined> = {};
  for (const [teamId, scorers] of Object.entries(RAW)) {
    if (teamId.startsWith('_') || !Array.isArray(scorers)) continue;
    const names: string[] = [];
    const cum: number[] = [];
    let acc = 0;
    for (const s of scorers as ScorerEntry[]) {
      acc += s.share;
      names.push(s.name);
      cum.push(acc);
    }
    // Normalize in case shares don't quite sum to 1.0.
    if (acc > 0 && Math.abs(acc - 1) > 1e-6) {
      for (let i = 0; i < cum.length; i++) cum[i] /= acc;
    }
    out[teamId] = { names, cum };
  }
  return out;
}

const INDEX = buildIndex();

/**
 * Sample one scorer for a team. Returns the player name or undefined if no
 * data for the team.
 */
function sampleScorer(teamId: string, rng: XoshiroRNG): string | undefined {
  const t = INDEX[teamId];
  if (!t) return undefined;
  const r = rng.next();
  for (let i = 0; i < t.cum.length; i++) {
    if (r < t.cum[i]) return t.names[i];
  }
  return t.names[t.names.length - 1];
}

/**
 * Distribute G goals from team `teamId` among its scorers. Each goal is an
 * independent multinomial draw - this means a single match where a team
 * scores 5 can plausibly have one player scoring multiple. Accumulator
 * (a Map from "TEAMID|PlayerName" → totalGoals) is mutated.
 */
export function distributeGoals(
  teamId: string,
  goals: number,
  rng: XoshiroRNG,
  accumulator: Map<string, number>,
): void {
  if (goals === 0) return;
  const t = INDEX[teamId];
  if (!t) return;
  for (let g = 0; g < goals; g++) {
    const name = sampleScorer(teamId, rng);
    if (!name) continue;
    const key = `${teamId}|${name}`;
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
  }
}

/** Look up a team's scorer table. Used by the UI for per-team views. */
export function getScorers(teamId: string): ScorerEntry[] {
  const raw = RAW[teamId];
  if (!Array.isArray(raw)) return [];
  return raw as ScorerEntry[];
}
