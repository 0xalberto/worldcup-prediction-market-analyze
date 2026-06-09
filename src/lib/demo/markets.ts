import groupsData from '@/data/groups.json';
import type { SerializedResult } from '@/lib/sim/worker';
import type { SampleSim } from '@/lib/sim/types';
import type { DemoMarket } from './types';

const GROUPS = (groupsData as { groups: Record<string, string[]> }).groups;

function teamProb(result: SerializedResult, teamId: string, field: 'champion' | 'first'): number {
  const idx = result.teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return 0;
  const N = result.numSimulations;
  if (field === 'champion') return result.stageCounts.champion[idx] / N;
  return result.groupFinish.first[idx] / N;
}

function teamName(result: SerializedResult, teamId: string, locale: 'es' | 'en'): string {
  const t = result.teams.find((x) => x.id === teamId);
  if (!t) return teamId;
  return locale === 'es' ? t.name_es : t.name_en;
}

/** Build play-money markets from a Monte Carlo aggregate. */
export function buildDemoMarkets(result: SerializedResult, locale: 'es' | 'en' = 'en'): DemoMarket[] {
  const N = result.numSimulations;
  const markets: DemoMarket[] = [];

  // Outright winner - top 12 by champion probability.
  const winnerCandidates = result.teams
    .map((t, i) => ({ id: t.id, prob: result.stageCounts.champion[i] / N }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 12);

  for (const { id, prob } of winnerCandidates) {
    markets.push({
      id: `winner-${id}`,
      type: 'winner',
      title: locale === 'es' ? `${teamName(result, id, locale)} campeón` : `${teamName(result, id, locale)} wins the World Cup`,
      subtitle: locale === 'es' ? 'Mercado outright' : 'Outright winner market',
      yesPrice: Math.max(0.01, Math.min(0.99, prob)),
      teamId: id,
    });
  }

  // Group winner - favorite per group (highest P(1st)).
  for (const [letter, teamIds] of Object.entries(GROUPS)) {
    let bestId = teamIds[0];
    let bestProb = 0;
    for (const tid of teamIds) {
      const p = teamProb(result, tid, 'first');
      if (p > bestProb) {
        bestProb = p;
        bestId = tid;
      }
    }
    markets.push({
      id: `group-${letter}-${bestId}`,
      type: 'group_winner',
      title: locale === 'es'
        ? `${teamName(result, bestId, locale)} gana el Grupo ${letter}`
        : `${teamName(result, bestId, locale)} wins Group ${letter}`,
      subtitle: locale === 'es' ? `Grupo ${letter}` : `Group ${letter}`,
      yesPrice: Math.max(0.05, Math.min(0.95, bestProb)),
      teamId: bestId,
      groupId: letter,
    });
  }

  // Head-to-head - top fixtures by frequency in sims.
  const fixtureRows: Array<{
    key: string;
    homeId: string;
    awayId: string;
    homeWinProb: number;
    stage: string;
  }> = [];

  for (const [key, f] of result.fixtures) {
    const total = f.winsHome + f.winsAway + f.draws;
    if (total <= 0) continue;
    fixtureRows.push({
      key,
      homeId: f.home,
      awayId: f.away,
      homeWinProb: f.winsHome / total,
      stage: f.stage,
    });
  }

  const fixtureMap = new Map(result.fixtures);
  fixtureRows.sort((a, b) => {
    const fa = fixtureMap.get(a.key);
    const fb = fixtureMap.get(b.key);
    const ta = fa ? fa.winsHome + fa.winsAway + fa.draws : 0;
    const tb = fb ? fb.winsHome + fb.winsAway + fb.draws : 0;
    return tb - ta;
  });

  const seen = new Set<string>();
  for (const row of fixtureRows) {
    const pairKey = [row.homeId, row.awayId].sort().join('-');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    if (markets.filter((m) => m.type === 'h2h').length >= 10) break;

    markets.push({
      id: `h2h-${row.key}-${row.homeId}`,
      type: 'h2h',
      title: locale === 'es'
        ? `${teamName(result, row.homeId, locale)} vence a ${teamName(result, row.awayId, locale)}`
        : `${teamName(result, row.homeId, locale)} beats ${teamName(result, row.awayId, locale)}`,
      subtitle: row.stage.toUpperCase(),
      yesPrice: Math.max(0.05, Math.min(0.95, row.homeWinProb)),
      slotKey: row.key,
      yesTeamId: row.homeId,
      homeTeamId: row.homeId,
      awayTeamId: row.awayId,
    });
  }

  return markets;
}

function groupStandingsFromSample(
  sample: SampleSim,
  groupLetter: string,
  teamIds: string[],
  teams: SerializedResult['teams'],
): Map<string, { p: number; gd: number; gf: number }> {
  const stats = new Map<string, { p: number; gd: number; gf: number; ga: number }>();
  for (const id of teamIds) stats.set(id, { p: 0, gd: 0, gf: 0, ga: 0 });

  for (const m of sample.matches) {
    if (m.stage !== 'group') continue;
    if (!m.slotId.startsWith(`${groupLetter}:`)) continue;
    const homeId = teams[m.home]?.id;
    const awayId = teams[m.away]?.id;
    if (!homeId || !awayId || !teamIds.includes(homeId) || !teamIds.includes(awayId)) continue;

    const hs = stats.get(homeId)!;
    const as = stats.get(awayId)!;
    hs.gf += m.gh;
    hs.ga += m.ga;
    as.gf += m.ga;
    as.ga += m.gh;

    if (m.gh > m.ga) hs.p += 3;
    else if (m.gh < m.ga) as.p += 3;
    else { hs.p += 1; as.p += 1; }
  }

  for (const s of stats.values()) {
    s.gd = s.gf - s.ga;
  }

  return stats;
}

function groupWinnerFromSample(
  sample: SampleSim,
  groupLetter: string,
  teams: SerializedResult['teams'],
): string | null {
  const teamIds = GROUPS[groupLetter];
  if (!teamIds) return null;
  const stats = groupStandingsFromSample(sample, groupLetter, teamIds, teams);
  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const id of teamIds) {
    const s = stats.get(id);
    if (!s) continue;
    const score = s.p * 1000 + s.gd * 10 + s.gf;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

function h2hWinnerFromSample(
  sample: SampleSim,
  market: DemoMarket,
  teams: SerializedResult['teams'],
): boolean | null {
  if (!market.slotKey || !market.yesTeamId || !market.homeTeamId || !market.awayTeamId) return null;
  const homeIdx = teams.findIndex((t) => t.id === market.homeTeamId);
  const awayIdx = teams.findIndex((t) => t.id === market.awayTeamId);
  if (homeIdx < 0 || awayIdx < 0) return null;

  const match = sample.matches.find(
    (m) =>
      m.slotId === market.slotKey &&
      m.home === homeIdx &&
      m.away === awayIdx,
  );
  if (!match) return null;
  if (match.gh > match.ga) return market.yesTeamId === market.homeTeamId;
  if (match.gh < match.ga) return market.yesTeamId === market.awayTeamId;
  return null;
}

/** Resolve whether a YES position wins given one sampled tournament path. */
export function resolveMarketYes(
  market: DemoMarket,
  sample: SampleSim,
  teams: SerializedResult['teams'],
): boolean {
  if (market.type === 'winner') {
    const champId = teams[sample.champion]?.id;
    return champId === market.teamId;
  }
  if (market.type === 'group_winner' && market.groupId && market.teamId) {
    const winner = groupWinnerFromSample(sample, market.groupId, teams);
    return winner === market.teamId;
  }
  if (market.type === 'h2h') {
    const won = h2hWinnerFromSample(sample, market, teams);
    return won === true;
  }
  return false;
}

export function pickSettlementSample(result: SerializedResult): SampleSim | null {
  if (!result.sampleSims.length) return null;
  const idx = Math.floor(Math.random() * result.sampleSims.length);
  return result.sampleSims[idx] ?? null;
}

export function settlementLabel(sample: SampleSim, teams: SerializedResult['teams'], locale: 'es' | 'en'): string {
  const champ = teams[sample.champion];
  if (!champ) return `Sim #${sample.simIdx}`;
  const name = locale === 'es' ? champ.name_es : champ.name_en;
  return locale === 'es' ? `Sim #${sample.simIdx} - campeón: ${name}` : `Sim #${sample.simIdx} - champion: ${name}`;
}
