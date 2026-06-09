/**
 * Fetch per-match card events from ESPN's `summary` endpoint and derive live
 * suspensions per FIFA WC accumulation rules.
 *
 * Modes:
 *   pnpm tsx scripts/fetch-cards.ts --probe ESPN_EVENT_ID
 *   pnpm tsx scripts/fetch-cards.ts --all                  # walk every completed event in state
 *
 * FIFA WC suspension rules implemented:
 *   - 2 yellow cards in different matches → ban for the next match.
 *   - Yellow accumulation resets after the quarter-finals (yellow in R16 does
 *     not carry to the final).
 *   - Direct red → ban for next match (severity-based extensions not modeled
 *     here; manual override possible).
 *   - A player already banned but receiving another yellow does NOT extend.
 *
 * Position + market value for criticality scoring are looked up from
 * src/data/absences.json's `current` block (which has the transfermarkt
 * snapshot per team). When a card is on a player not in that snapshot
 * (call-up bench piece), we fall back to position='CM' value=10M.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import absencesData from '../src/data/absences.json';

const STATE_PATH = path.resolve(__dirname, '..', 'src', 'data', 'tournament_state.json');
const SUMMARY_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

// Stages where yellow-accumulation matters. After QF, yellows reset per FIFA.
const YELLOW_RESET_AFTER: Set<string> = new Set(['qf']);

type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'WG' | 'ATT';

interface LiveResult {
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd';
  home: string;
  away: string;
  gh: number;
  ga: number;
  status: 'completed' | 'scheduled';
  kickoff_iso: string;
  espn_event_id?: string;
}

interface CardEvent {
  match_id: string;
  team: string;
  player: string;
  color: 'yellow' | 'red';
  minute: number;
}

interface LiveSuspension {
  team: string;
  player: string;
  position: Position;
  market_value_mil: number;
  from_stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';
  reason: 'yellow_accumulation' | 'red_card' | 'federation';
}

interface StateFile {
  _meta: { updated_at: string | null; source: string | null; tournament_started: boolean };
  results: Record<string, LiveResult>;
  live_suspensions: LiveSuspension[];
  cards: CardEvent[];
}

// ----- absences-snapshot lookup -----

interface AbsenceEntry { player: string; position: Position; market_value_mil: number }
const CURRENT_SNAPSHOTS = (absencesData as { current?: Record<string, AbsenceEntry[]> }).current ?? {};

function lookupPlayerMeta(team: string, player: string): { position: Position; market_value_mil: number } {
  // Heuristic: search team's current absence list first (contains a partial
  // squad with positions + values from the transfermarkt scrape). If miss,
  // sensible defaults: CM 10M (mid-tier midfielder).
  const list = CURRENT_SNAPSHOTS[team];
  if (Array.isArray(list)) {
    const lower = player.toLowerCase();
    const hit = list.find((p) => p.player.toLowerCase() === lower);
    if (hit) return { position: hit.position, market_value_mil: hit.market_value_mil };
  }
  return { position: 'CM', market_value_mil: 10 };
}

// ----- ESPN summary types -----

interface ESPNPlay {
  type?: { id: string; text: string };
  text?: string;
  clock?: { displayValue: string };
  team?: { id: string };
  participants?: Array<{ athlete: { displayName: string; position?: { abbreviation: string } } }>;
}
interface ESPNSummary {
  plays?: ESPNPlay[];
  header?: {
    competitions?: Array<{
      competitors?: Array<{ id: string; team: { abbreviation: string } }>;
    }>;
  };
}

// ----- parse cards from summary -----

function parseMinute(s: string | undefined): number {
  if (!s) return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseCardsFromSummary(match_id: string, match: LiveResult, summary: ESPNSummary): CardEvent[] {
  const espnTeamMap: Record<string, string> = {};
  const compTeams = summary.header?.competitions?.[0]?.competitors ?? [];
  for (const c of compTeams) {
    espnTeamMap[c.id] = c.team.abbreviation.toUpperCase();
  }
  const ourTeams = new Set([match.home, match.away]);
  const events: CardEvent[] = [];
  for (const p of summary.plays ?? []) {
    const txt = (p.type?.text ?? p.text ?? '').toLowerCase();
    const color: 'yellow' | 'red' | null =
      txt.includes('yellow') ? 'yellow' :
      (txt.includes('red') ? 'red' : null);
    if (!color) continue;
    const player = p.participants?.[0]?.athlete?.displayName;
    if (!player) continue;
    const teamId = p.team ? espnTeamMap[p.team.id] : null;
    const team = teamId && ourTeams.has(teamId)
      ? teamId
      : (ourTeams.size === 1 ? [...ourTeams][0] : '?');
    if (team === '?') continue;
    events.push({
      match_id,
      team,
      player,
      color,
      minute: parseMinute(p.clock?.displayValue),
    });
  }
  return events;
}

// ----- suspension derivation -----

/**
 * Walk all cards in chronological order, compute per-player yellow counters,
 * and emit suspensions when accumulation thresholds trigger.
 *
 * The output list is intended for the team's NEXT match — for a yellow that
 * triggers in R16, the suspension's from_stage is QF.
 */
function deriveSuspensions(
  cards: CardEvent[],
  results: Record<string, LiveResult>,
): LiveSuspension[] {
  // Order cards by (kickoff_iso of their match, minute) so accumulation order is correct.
  const ordered = [...cards].sort((a, b) => {
    const ka = results[a.match_id]?.kickoff_iso ?? '';
    const kb = results[b.match_id]?.kickoff_iso ?? '';
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.minute - b.minute;
  });

  const yellows = new Map<string, number>();     // teamId|player → count
  const suspensions: LiveSuspension[] = [];
  const alreadyEmitted = new Set<string>();

  const stageOrder: Array<LiveSuspension['from_stage']> = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'];
  function nextStage(s: LiveResult['stage']): LiveSuspension['from_stage'] {
    const i = stageOrder.indexOf(s as LiveSuspension['from_stage']);
    if (i < 0 || i === stageOrder.length - 1) return 'final';
    return stageOrder[i + 1];
  }

  for (const c of ordered) {
    const match = results[c.match_id];
    if (!match) continue;
    const key = `${c.team}|${c.player}`;

    if (c.color === 'red') {
      if (!alreadyEmitted.has(key)) {
        const meta = lookupPlayerMeta(c.team, c.player);
        suspensions.push({
          team: c.team,
          player: c.player,
          position: meta.position,
          market_value_mil: meta.market_value_mil,
          from_stage: nextStage(match.stage),
          reason: 'red_card',
        });
        alreadyEmitted.add(key);
      }
      continue;
    }

    // Yellow
    const prev = yellows.get(key) ?? 0;
    const nowAt = prev + 1;
    yellows.set(key, nowAt);
    if (nowAt >= 2 && !alreadyEmitted.has(key)) {
      const meta = lookupPlayerMeta(c.team, c.player);
      suspensions.push({
        team: c.team,
        player: c.player,
        position: meta.position,
        market_value_mil: meta.market_value_mil,
        from_stage: nextStage(match.stage),
        reason: 'yellow_accumulation',
      });
      alreadyEmitted.add(key);
    }
    // Yellow reset after QF (FIFA rule).
    if (YELLOW_RESET_AFTER.has(match.stage)) {
      yellows.clear();
    }
  }

  return suspensions;
}

// ----- fetch one summary -----

async function fetchSummary(eventId: string): Promise<ESPNSummary> {
  const url = `${SUMMARY_BASE}?event=${eventId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'mundial2026-sim/1.0 (+github.com/kmanus88/worldcup2026)' },
  });
  if (!res.ok) throw new Error(`ESPN summary ${eventId}: HTTP ${res.status}`);
  return (await res.json()) as ESPNSummary;
}

// ----- CLI -----

function loadState(): StateFile {
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as StateFile;
}
function saveState(s: StateFile): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  if (flag === '--probe' && args[1]) {
    const summary = await fetchSummary(args[1]);
    console.error(`probe ${args[1]}: ${summary.plays?.length ?? 0} plays`);
    const fakeMatch: LiveResult = {
      stage: 'group', home: '?', away: '?', gh: 0, ga: 0,
      status: 'completed', kickoff_iso: new Date().toISOString(),
    };
    const cards = parseCardsFromSummary('probe', fakeMatch, summary);
    for (const c of cards) console.log(JSON.stringify(c));
    return;
  }

  if (flag !== '--all') {
    console.error('Usage: --probe ESPN_EVENT_ID | --all');
    process.exit(1);
  }

  const state = loadState();
  const completed = Object.entries(state.results).filter(([, r]) => r.status === 'completed');
  if (completed.length === 0) {
    console.error('no completed matches in state — nothing to fetch');
    return;
  }

  const allCards: CardEvent[] = [];
  for (const [match_id, match] of completed) {
    if (!match.espn_event_id) {
      console.error(`${match_id}: no espn_event_id stored — skipping`);
      continue;
    }
    try {
      const summary = await fetchSummary(match.espn_event_id);
      const cards = parseCardsFromSummary(match_id, match, summary);
      allCards.push(...cards);
      console.error(`${match_id}: ${cards.length} cards`);
    } catch (err) {
      console.error(`${match_id}: FAIL ${(err as Error).message}`);
    }
  }

  state.cards = allCards;
  state.live_suspensions = deriveSuspensions(allCards, state.results);
  state._meta.updated_at = new Date().toISOString();
  saveState(state);
  console.error(`done: ${allCards.length} cards, ${state.live_suspensions.length} suspensions`);
}

main().catch((err) => { console.error(err); process.exit(1); });
