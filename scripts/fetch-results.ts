/**
 * Fetch live WC 2026 results from ESPN's hidden scoreboard API.
 *
 * Modes:
 *   pnpm tsx scripts/fetch-results.ts --probe YYYYMMDD       # print raw events for a date, no writes
 *   pnpm tsx scripts/fetch-results.ts --date YYYYMMDD        # parse one date, merge into tournament_state.json
 *   pnpm tsx scripts/fetch-results.ts --range YYYYMMDD..YYYYMMDD  # walk a range
 *   pnpm tsx scripts/fetch-results.ts --since-kickoff        # 2026-06-11..today
 *
 * ESPN's API for WC 2026 is undocumented but consistent: the `fifa.world`
 * league slug returns events with date, status, competitors, and basic stats.
 * Reading is well behaved (no auth, generous rate limits) and Vercel's
 * cron environment can hit it directly.
 *
 * Mapping:
 *   - Group matches → `LETTER:pairIdx` via groups.json + GROUP_PAIRS table.
 *     This is deterministic: any two teams from group A on the schedule must
 *     map to exactly one of A:0..A:5.
 *   - Knockout matches → bracket.json match.id by chronological + bracket
 *     position lookup. Since FIFA assigns match numbers (73..104) in the
 *     official fixture list, the heuristic is: order completed matches by
 *     kickoff time within a round, then assign the bracket IDs left-to-right.
 *     If the schedule deviates we override per-id in BRACKET_OVERRIDES below.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import groupsData from '../src/data/groups.json';
import bracketData from '../src/data/bracket.json';

const STATE_PATH = path.resolve(__dirname, '..', 'src', 'data', 'tournament_state.json');
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// ----- ESPN ↔ our team_id reconciliation -----

/**
 * ESPN typically uses FIFA's 3-letter abbreviations. Override here when the
 * codes differ (e.g. ESPN sometimes uses ISO codes that diverge from FIFA's).
 */
const ESPN_ABBR_OVERRIDES: Record<string, string> = {
  // Add overrides as we discover them during real ingestion.
  // Examples we'd expect: 'KOR' ↔ 'KOR' (Korea Republic), 'IRN' ↔ 'IRN' (Iran).
};

const OUR_TEAM_IDS = new Set<string>(
  Object.values((groupsData as { groups: Record<string, string[]> }).groups).flat(),
);

function espnTeamToId(abbr: string, displayName: string): string | null {
  const a = abbr.toUpperCase();
  const override = ESPN_ABBR_OVERRIDES[a];
  if (override) return override;
  if (OUR_TEAM_IDS.has(a)) return a;
  // Fallback: try to match by display name fragments. Last resort.
  const lower = displayName.toLowerCase();
  for (const id of OUR_TEAM_IDS) {
    if (lower.includes(id.toLowerCase())) return id;
  }
  return null;
}

// ----- group slot resolution -----

const GROUPS = (groupsData as { groups: Record<string, string[]> }).groups;
// Mirrors GROUP_PAIRS in src/lib/sim/group.ts.
const GROUP_PAIR_ORDER: Array<readonly [number, number]> = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

function resolveGroupSlot(homeId: string, awayId: string): { letter: string; pairIdx: number } | null {
  for (const [letter, ids] of Object.entries(GROUPS)) {
    const hi = ids.indexOf(homeId);
    const ai = ids.indexOf(awayId);
    if (hi < 0 || ai < 0) continue;
    for (let p = 0; p < GROUP_PAIR_ORDER.length; p++) {
      const [i, j] = GROUP_PAIR_ORDER[p];
      if ((ids[i] === homeId && ids[j] === awayId) ||
          (ids[i] === awayId && ids[j] === homeId)) {
        return { letter, pairIdx: p };
      }
    }
  }
  return null;
}

// ----- knockout match.id resolution -----

interface BracketEntry { id: number; stage: 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final'; }
const BRACKET_BY_STAGE: Record<string, BracketEntry[]> = {
  r32: bracketData.r32.map((m: { id: number }) => ({ id: m.id, stage: 'r32' as const })),
  r16: bracketData.r16.map((m: { id: number }) => ({ id: m.id, stage: 'r16' as const })),
  qf: bracketData.qf.map((m: { id: number }) => ({ id: m.id, stage: 'qf' as const })),
  sf: bracketData.sf.map((m: { id: number }) => ({ id: m.id, stage: 'sf' as const })),
  '3rd': [{ id: bracketData.third_place.id, stage: '3rd' as const }],
  final: [{ id: bracketData.final.id, stage: 'final' as const }],
};

/**
 * Per-match overrides if FIFA's scheduling order doesn't match bracket.json's
 * canonical ordering. Keyed by ESPN event id. Empty by default; populate once
 * the official schedule is published.
 */
const BRACKET_OVERRIDES: Record<string, number> = {};

// ----- ESPN response types -----

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  team: { abbreviation: string; displayName: string };
  score: string;
}
interface ESPNStatus {
  type: { state: 'pre' | 'in' | 'post'; completed: boolean };
  detail?: string;
}
interface ESPNCompetition {
  competitors: ESPNCompetitor[];
  status: ESPNStatus;
  notes?: Array<{ type: string; headline: string }>;
}
interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  competitions: ESPNCompetition[];
}
interface ESPNScoreboard {
  events: ESPNEvent[];
}

// ----- parse one event -----

interface ParsedEvent {
  espn_id: string;
  kickoff_iso: string;
  status: 'completed' | 'scheduled' | 'in_progress';
  home_id: string | null;
  away_id: string | null;
  gh: number | null;
  ga: number | null;
  round_hint: string | null;
}

function parseEvent(ev: ESPNEvent): ParsedEvent | null {
  const c = ev.competitions[0];
  if (!c) return null;
  const home = c.competitors.find((x) => x.homeAway === 'home');
  const away = c.competitors.find((x) => x.homeAway === 'away');
  if (!home || !away) return null;
  const home_id = espnTeamToId(home.team.abbreviation, home.team.displayName);
  const away_id = espnTeamToId(away.team.abbreviation, away.team.displayName);
  const completed = c.status.type.completed;
  const inProgress = c.status.type.state === 'in';
  const status = completed ? 'completed' : inProgress ? 'in_progress' : 'scheduled';
  const round_hint = c.notes?.[0]?.headline ?? null;
  return {
    espn_id: ev.id,
    kickoff_iso: ev.date,
    status,
    home_id,
    away_id,
    gh: completed ? Number(home.score) : null,
    ga: completed ? Number(away.score) : null,
    round_hint,
  };
}

// ----- fetch one date -----

async function fetchDate(yyyymmdd: string): Promise<ESPNScoreboard> {
  const url = `${ESPN_BASE}?dates=${yyyymmdd}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'mundial2026-sim/1.0 (+github.com/kmanus88/worldcup2026)' },
  });
  if (!res.ok) throw new Error(`ESPN ${yyyymmdd}: HTTP ${res.status}`);
  return (await res.json()) as ESPNScoreboard;
}

// ----- merge into tournament_state.json -----

interface LiveResult {
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd';
  home: string;
  away: string;
  gh: number;
  ga: number;
  status: 'completed' | 'scheduled';
  kickoff_iso: string;
  espn_event_id?: string;
  went_to_et?: boolean;
  went_to_pk?: boolean;
  pk_winner?: string;
}

interface StateFile {
  _meta: { updated_at: string | null; source: string | null; tournament_started: boolean };
  results: Record<string, LiveResult>;
  live_suspensions: unknown[];
  cards: unknown[];
}

function loadState(): StateFile {
  const raw = fs.readFileSync(STATE_PATH, 'utf-8');
  return JSON.parse(raw) as StateFile;
}

function saveState(s: StateFile): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n');
}

function mapToSlotKey(p: ParsedEvent): { key: string; stage: LiveResult['stage'] } | null {
  if (!p.home_id || !p.away_id) return null;
  // Group stage: deterministic via groups.json + pair order.
  const g = resolveGroupSlot(p.home_id, p.away_id);
  if (g) return { key: `${g.letter}:${g.pairIdx}`, stage: 'group' };
  // Knockout: per-event override first, otherwise return null and let the
  // operator add an override once the schedule is known.
  const override = BRACKET_OVERRIDES[p.espn_id];
  if (override) {
    for (const [_stage, list] of Object.entries(BRACKET_BY_STAGE)) {
      const m = list.find((x) => x.id === override);
      if (m) return { key: String(override), stage: m.stage };
    }
  }
  return null;
}

function mergeEvents(state: StateFile, parsed: ParsedEvent[]): { applied: number; skipped: number } {
  let applied = 0;
  let skipped = 0;
  for (const p of parsed) {
    const m = mapToSlotKey(p);
    if (!m) { skipped++; continue; }
    if (p.status !== 'completed' || p.gh == null || p.ga == null) {
      // Keep scheduled entries so the UI can show "next up", but don't let the
      // engine collapse them: status='scheduled' fails the short-circuit check.
      state.results[m.key] = {
        stage: m.stage,
        home: p.home_id!,
        away: p.away_id!,
        gh: 0, ga: 0,
        status: 'scheduled',
        kickoff_iso: p.kickoff_iso,
        espn_event_id: p.espn_id,
      };
      continue;
    }
    state.results[m.key] = {
      stage: m.stage,
      home: p.home_id!,
      away: p.away_id!,
      gh: p.gh,
      ga: p.ga,
      status: 'completed',
      kickoff_iso: p.kickoff_iso,
      espn_event_id: p.espn_id,
    };
    applied++;
  }
  return { applied, skipped };
}

// ----- date helpers -----

function pad2(n: number): string { return n.toString().padStart(2, '0'); }
function fmtDate(d: Date): string { return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`; }
function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}T00:00:00Z`);
  const e = new Date(`${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}T00:00:00Z`);
  for (let d = s; d <= e; d = new Date(d.getTime() + 86400000)) {
    out.push(fmtDate(d));
  }
  return out;
}

// ----- CLI -----

async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  if (flag === '--probe' && args[1]) {
    const data = await fetchDate(args[1]);
    console.error(`probe ${args[1]}: ${data.events.length} events`);
    for (const ev of data.events) {
      const p = parseEvent(ev);
      console.log(JSON.stringify(p));
    }
    return;
  }

  let dates: string[];
  if (flag === '--date' && args[1]) {
    dates = [args[1]];
  } else if (flag === '--range' && args[1] && args[1].includes('..')) {
    const [s, e] = args[1].split('..');
    dates = dateRange(s, e);
  } else if (flag === '--since-kickoff') {
    dates = dateRange('20260611', fmtDate(new Date()));
  } else {
    console.error('Usage: --probe YYYYMMDD | --date YYYYMMDD | --range S..E | --since-kickoff');
    process.exit(1);
  }

  const state = loadState();
  let totalApplied = 0;
  let totalSkipped = 0;
  for (const d of dates) {
    try {
      const data = await fetchDate(d);
      const parsed = data.events.map(parseEvent).filter((x): x is ParsedEvent => x !== null);
      const { applied, skipped } = mergeEvents(state, parsed);
      totalApplied += applied;
      totalSkipped += skipped;
      console.error(`${d}: ${data.events.length} events · applied=${applied} skipped=${skipped}`);
    } catch (err) {
      console.error(`${d}: FAIL ${(err as Error).message}`);
    }
  }
  state._meta.updated_at = new Date().toISOString();
  state._meta.source = 'site.api.espn.com fifa.world scoreboard';
  if (totalApplied > 0) state._meta.tournament_started = true;
  saveState(state);
  console.error(`done: applied=${totalApplied} skipped=${totalSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
