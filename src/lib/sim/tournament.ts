import type { Team, TournamentResult, Stage, GroupFinish } from './types';
import { simulateGroup, compareStandings, type TeamStanding } from './group';
import { simulateKnockout } from './knockout';
import type { XoshiroRNG } from './rng';
import { getKnockoutResult } from './state';

import groupsData from '@/data/groups.json';
import bracketData from '@/data/bracket.json';

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
type GroupLetter = (typeof GROUP_LETTERS)[number];

interface BracketSlot {
  /** "A1", "B2", etc. | { third_from: [...] } | "W73" (winner of match) | "L101" (loser of SF for 3rd place) */
  home: string | { third_from: string[] };
  away: string | { third_from: string[] };
  id: number;
}

const BRACKET = bracketData as unknown as {
  r32: BracketSlot[];
  r16: BracketSlot[];
  qf: BracketSlot[];
  sf: BracketSlot[];
  third_place: BracketSlot;
  final: BracketSlot;
};

/**
 * Simulate one complete World Cup tournament.
 *
 * Steps:
 *  1) Group stage: 12 groups × 6 matches = 72 matches.
 *  2) Rank teams within each group; rank the 12 third-placed teams; take top 8.
 *  3) Assign the 8 advancing 3rd-placed teams to the 8 "best 3rd" slots in R32 (simplified rule).
 *  4) Play R32 → R16 → QF → SF → 3rd-place + Final.
 */
/**
 * Fixture-event callback. Called once per match in a simulated tournament,
 * with enough info for the engine to accumulate per-fixture aggregates.
 *
 * - For group matches: stage='group', group=A..L, slotId='A:0'..'L:5'.
 * - For knockout matches: stage='r32'..'final'/'3rd', slotId=match.id as string.
 */
export type OnFixture = (
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd',
  slotId: string,
  group: string | undefined,
  homeIdx: number,
  awayIdx: number,
  gh: number,
  ga: number,
) => void;

export function simulateTournament(
  teams: Team[],
  teamIdx: Map<string, number>,
  rng: XoshiroRNG,
  onFixture?: OnFixture,
): TournamentResult {
  const N = teams.length;
  const stageReached: Stage[] = new Array(N).fill('group');
  const groupFinish: GroupFinish[] = new Array(N).fill('fourth');
  const goalsFor = new Int32Array(N);
  const goalsAgainst = new Int32Array(N);

  // === 1) Group stage ===
  const groupStandings: Record<GroupLetter, TeamStanding[]> = {} as Record<GroupLetter, TeamStanding[]>;
  for (const letter of GROUP_LETTERS) {
    const ids = (groupsData.groups as Record<string, string[]>)[letter];
    const idxs = ids.map((id) => {
      const i = teamIdx.get(id);
      if (i === undefined) throw new Error(`Unknown team id in group ${letter}: ${id}`);
      return i;
    });
    const standings = simulateGroup(idxs, teams, rng, (pairIdx, h, a, gh, ga) => {
      goalsFor[h] += gh; goalsAgainst[h] += ga;
      goalsFor[a] += ga; goalsAgainst[a] += gh;
      onFixture?.('group', `${letter}:${pairIdx}`, letter, h, a, gh, ga);
    }, letter);
    groupStandings[letter] = standings;
  }

  // === 2) Rank the 12 third-placed teams; top 8 advance ===
  interface ThirdPlaceEntry { letter: GroupLetter; standing: TeamStanding; }
  const thirds: ThirdPlaceEntry[] = GROUP_LETTERS.map((letter) => ({
    letter,
    standing: groupStandings[letter][2],
  }));
  thirds.sort((x, y) => compareStandings(x.standing, y.standing));
  const advancingThirds = thirds.slice(0, 8);
  const eliminatedThirds = thirds.slice(8);

  // Mark group-finish position and stage
  for (const letter of GROUP_LETTERS) {
    const s = groupStandings[letter];
    stageReached[s[0].teamIdx] = 'r32';
    stageReached[s[1].teamIdx] = 'r32';
    groupFinish[s[0].teamIdx] = 'first';
    groupFinish[s[1].teamIdx] = 'second';
    groupFinish[s[3].teamIdx] = 'fourth';
  }
  for (const t of advancingThirds) {
    stageReached[t.standing.teamIdx] = 'r32';
    groupFinish[t.standing.teamIdx] = 'thirdAdvances';
  }
  for (const t of eliminatedThirds) {
    stageReached[t.standing.teamIdx] = 'group';
    groupFinish[t.standing.teamIdx] = 'thirdOut';
  }

  // === 3) Assign 8 advancing 3rd-placed teams to bracket "third_from" slots ===
  // Simplification: for each R32 slot demanding a "best 3rd from groups X,Y,...":
  //   pick the highest-ranked advancing 3rd whose group letter is in the allowed set
  //   and hasn't been assigned yet. If no candidate fits (rare edge case), fall back
  //   to the highest-ranked unassigned advancing 3rd.
  const sortedAdvancingThirds = [...advancingThirds]; // already sorted best→worst
  const assignedThirds = new Set<GroupLetter>();
  const slotToThirdIdx: Map<number, number> = new Map(); // match id → team idx

  for (const match of BRACKET.r32) {
    for (const side of ['home', 'away'] as const) {
      const slot = match[side];
      if (typeof slot === 'object' && 'third_from' in slot) {
        const allowed = new Set(slot.third_from);
        const pick = sortedAdvancingThirds.find(
          (t) => allowed.has(t.letter) && !assignedThirds.has(t.letter),
        ) ?? sortedAdvancingThirds.find((t) => !assignedThirds.has(t.letter));
        if (pick) {
          assignedThirds.add(pick.letter);
          slotToThirdIdx.set(match.id * 2 + (side === 'home' ? 0 : 1), pick.standing.teamIdx);
        }
      }
    }
  }

  // Helper to resolve a slot reference to a team index.
  const matchWinner: Map<number, number> = new Map();
  const matchLoser: Map<number, number> = new Map();

  const resolveSlot = (slot: string | { third_from: string[] }, matchId: number, side: 'home' | 'away'): number => {
    if (typeof slot === 'object') {
      const idx = slotToThirdIdx.get(matchId * 2 + (side === 'home' ? 0 : 1));
      if (idx === undefined) throw new Error(`Unassigned third-slot for match ${matchId} ${side}`);
      return idx;
    }
    // Group reference like "A1", "B2", "L1"
    if (/^[A-L][12]$/.test(slot)) {
      const letter = slot[0] as GroupLetter;
      const pos = parseInt(slot[1], 10) - 1;
      return groupStandings[letter][pos].teamIdx;
    }
    // Winner reference like "W73"
    if (slot.startsWith('W')) {
      const id = parseInt(slot.slice(1), 10);
      const idx = matchWinner.get(id);
      if (idx === undefined) throw new Error(`Match ${id} winner not yet computed (slot=${slot})`);
      return idx;
    }
    // Loser reference like "L101" (used for 3rd-place playoff)
    if (slot.startsWith('L')) {
      const id = parseInt(slot.slice(1), 10);
      const idx = matchLoser.get(id);
      if (idx === undefined) throw new Error(`Match ${id} loser not yet computed (slot=${slot})`);
      return idx;
    }
    throw new Error(`Unknown slot reference: ${slot}`);
  };

  // Post-ET fatigue (Tier 1 #5): a team that won its previous KO match in
  // extra time / penalties carries fatigue into the next round. Cleared and
  // re-set per round. Group stage never sets it (no ET in groups).
  const etFatigue: boolean[] = new Array(teams.length).fill(false);

  // === 4) Run knockout rounds ===
  const runRound = (matches: BracketSlot[], reachedStage: Stage, nextStage: Stage, fixtureStage: 'r32'|'r16'|'qf'|'sf'|'final'|'3rd') => {
    // Snapshot incoming fatigue so within-round updates don't bleed.
    const entryFatigue = etFatigue.slice();
    for (const m of matches) {
      const homeIdx = resolveSlot(m.home, m.id, 'home');
      const awayIdx = resolveSlot(m.away, m.id, 'away');

      // Tier 1.5: short-circuit if this match has already been played in real
      // life. Only honor the state entry when both teams match the resolved
      // bracket slot - otherwise the engine has computed a counterfactual
      // bracket (e.g. third-place placement differed) and the live result
      // doesn't apply.
      const live = getKnockoutResult(m.id);
      let winnerIdx: number;
      let loserIdx: number;
      let gh: number;
      let ga: number;
      let drawnInRegulation: boolean;
      if (live && live.home === teams[homeIdx].id && live.away === teams[awayIdx].id) {
        gh = live.gh;
        ga = live.ga;
        drawnInRegulation = !!(live.went_to_et || live.went_to_pk);
        if (live.went_to_pk && live.pk_winner) {
          winnerIdx = live.pk_winner === teams[homeIdx].id ? homeIdx : awayIdx;
        } else if (gh > ga) {
          winnerIdx = homeIdx;
        } else if (ga > gh) {
          winnerIdx = awayIdx;
        } else {
          // Drawn at 90' / ET with no pk_winner field - should not occur for a
          // completed knockout, but fall back to higher-ELO winner deterministically.
          winnerIdx = teams[homeIdx].elo >= teams[awayIdx].elo ? homeIdx : awayIdx;
        }
        loserIdx = winnerIdx === homeIdx ? awayIdx : homeIdx;
      } else {
        const r = simulateKnockout(
          homeIdx, awayIdx, teams, rng, fixtureStage,
          entryFatigue[homeIdx], entryFatigue[awayIdx],
        );
        winnerIdx = r.winnerIdx;
        loserIdx = r.loserIdx;
        gh = r.gh;
        ga = r.ga;
        drawnInRegulation = r.drawn;
      }

      matchWinner.set(m.id, winnerIdx);
      matchLoser.set(m.id, loserIdx);
      goalsFor[homeIdx] += gh; goalsAgainst[homeIdx] += ga;
      goalsFor[awayIdx] += ga; goalsAgainst[awayIdx] += gh;
      stageReached[homeIdx] = furthestStage(stageReached[homeIdx], reachedStage);
      stageReached[awayIdx] = furthestStage(stageReached[awayIdx], reachedStage);
      stageReached[winnerIdx] = furthestStage(stageReached[winnerIdx], nextStage);
      // Update fatigue for the next round: winner inherits the ET flag, loser is out.
      etFatigue[winnerIdx] = drawnInRegulation;
      etFatigue[loserIdx] = false;
      onFixture?.(fixtureStage, String(m.id), undefined, homeIdx, awayIdx, gh, ga);
    }
  };

  runRound(BRACKET.r32, 'r32', 'r16',  'r32');
  runRound(BRACKET.r16, 'r16', 'qf',   'r16');
  runRound(BRACKET.qf,  'qf',  'sf',   'qf');
  runRound(BRACKET.sf,  'sf',  'final','sf');

  // 3rd place playoff (losers of SF). Both teams stay at stageReached='sf' -
  // winning bronze doesn't bump the stage. Bronze is tracked via thirdPlace below.
  const playSpecial = (m: BracketSlot, fixtureStage: '3rd' | 'final'): void => {
    const homeIdx = resolveSlot(m.home, m.id, 'home');
    const awayIdx = resolveSlot(m.away, m.id, 'away');
    const live = getKnockoutResult(m.id);
    let winnerIdx: number, loserIdx: number, gh: number, ga: number;
    if (live && live.home === teams[homeIdx].id && live.away === teams[awayIdx].id) {
      gh = live.gh;
      ga = live.ga;
      if (live.went_to_pk && live.pk_winner) {
        winnerIdx = live.pk_winner === teams[homeIdx].id ? homeIdx : awayIdx;
      } else if (gh > ga) {
        winnerIdx = homeIdx;
      } else if (ga > gh) {
        winnerIdx = awayIdx;
      } else {
        winnerIdx = teams[homeIdx].elo >= teams[awayIdx].elo ? homeIdx : awayIdx;
      }
      loserIdx = winnerIdx === homeIdx ? awayIdx : homeIdx;
    } else {
      const r = simulateKnockout(
        homeIdx, awayIdx, teams, rng, fixtureStage,
        etFatigue[homeIdx], etFatigue[awayIdx],
      );
      winnerIdx = r.winnerIdx;
      loserIdx = r.loserIdx;
      gh = r.gh;
      ga = r.ga;
    }
    matchWinner.set(m.id, winnerIdx);
    matchLoser.set(m.id, loserIdx);
    goalsFor[homeIdx] += gh; goalsAgainst[homeIdx] += ga;
    goalsFor[awayIdx] += ga; goalsAgainst[awayIdx] += gh;
    if (fixtureStage === 'final') {
      stageReached[winnerIdx] = 'champion';
    }
    onFixture?.(fixtureStage, String(m.id), undefined, homeIdx, awayIdx, gh, ga);
  };

  playSpecial(BRACKET.third_place, '3rd');
  const thirdPlace = matchWinner.get(BRACKET.third_place.id)!;
  const fourthPlace = matchLoser.get(BRACKET.third_place.id)!;

  // Final
  playSpecial(BRACKET.final, 'final');
  const champion = matchWinner.get(BRACKET.final.id)!;
  const runnerUp = matchLoser.get(BRACKET.final.id)!;

  return { champion, runnerUp, thirdPlace, fourthPlace, stageReached, groupFinish, goalsFor, goalsAgainst };
}

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'final', 'champion'];
function furthestStage(a: Stage, b: Stage): Stage {
  return STAGE_ORDER.indexOf(a) > STAGE_ORDER.indexOf(b) ? a : b;
}
