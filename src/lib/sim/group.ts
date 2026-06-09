import type { Team } from './types';
import { sampleScore } from './match';
import type { XoshiroRNG } from './rng';
import { getGroupResult } from './state';

export interface TeamStanding {
  teamIdx: number;
  p: number;     // points
  gf: number;    // goals for
  ga: number;    // goals against
  gd: number;    // goal differential
  tiebreak: number; // random tiebreaker for ties beyond GD/GF
}

/**
 * Round-robin pair order - first index is "home", second is "away" within the group.
 * Slot index 0..5 maps to these pairs (used as part of fixture slot IDs).
 */
export const GROUP_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
] as const;

/** Simulates one 4-team group round-robin. Returns 4 standings sorted top→bottom.
 *
 *  If `groupLetter` is provided, the simulator consults the live tournament
 *  state (Tier 1.5): any match already played in real life is taken as-is
 *  instead of being resampled. Pass undefined to force a pure simulation
 *  (used by the backtest harness which has its own state). */
export function simulateGroup(
  teamIdxs: number[],          // 4 team indices into the global team array
  teams: Team[],               // global team array
  rng: XoshiroRNG,
  onMatch?: (pairIdx: number, homeIdx: number, awayIdx: number, gh: number, ga: number) => void,
  groupLetter?: string,
): TeamStanding[] {
  const standings: TeamStanding[] = teamIdxs.map((idx) => ({
    teamIdx: idx,
    p: 0, gf: 0, ga: 0, gd: 0, tiebreak: rng.next(),
  }));

  for (let p = 0; p < GROUP_PAIRS.length; p++) {
    const [i, j] = GROUP_PAIRS[p];
    const a = standings[i];
    const b = standings[j];

    let gh: number, gv: number;
    const decided = groupLetter ? getGroupResult(`${groupLetter}:${p}`) : null;
    if (decided && decided.home === teams[a.teamIdx].id && decided.away === teams[b.teamIdx].id) {
      // Use the real result. Note: the engine's home/away ordering is fixed by
      // GROUP_PAIRS, so we only honor the state entry when it matches that
      // orientation. Otherwise fall through to sampling (defensive against a
      // malformed state file).
      gh = decided.gh;
      gv = decided.ga;
    } else {
      const s = sampleScore(teams[a.teamIdx], teams[b.teamIdx], rng, false);
      gh = s.ga;
      gv = s.gb;
    }

    onMatch?.(p, a.teamIdx, b.teamIdx, gh, gv);
    a.gf += gh; a.ga += gv; a.gd += gh - gv;
    b.gf += gv; b.ga += gh; b.gd += gv - gh;
    if (gh > gv)      { a.p += 3; }
    else if (gh < gv) { b.p += 3; }
    else              { a.p += 1; b.p += 1; }
  }

  // FIFA tiebreakers (simplified): points → GD → GF → random.
  standings.sort(compareStandings);
  return standings;
}

export function compareStandings(a: TeamStanding, b: TeamStanding): number {
  if (a.p !== b.p) return b.p - a.p;
  if (a.gd !== b.gd) return b.gd - a.gd;
  if (a.gf !== b.gf) return b.gf - a.gf;
  return b.tiebreak - a.tiebreak;
}
