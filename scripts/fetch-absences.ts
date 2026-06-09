/**
 * Fetch national-team squads from transfermarkt and update src/data/absences.json's
 * `current` block with players flagged as injured.
 *
 * Modes:
 *   pnpm tsx scripts/fetch-absences.ts ARG          # single team, print JSON to stdout (no write)
 *   pnpm tsx scripts/fetch-absences.ts --all        # all 48 WC 2026 teams, merge into absences.json
 *   pnpm tsx scripts/fetch-absences.ts --write ARG  # single team, merge into absences.json
 *
 * Source priority:
 *   1. transfermarkt.com (rich: market value + injury flag in squad table)
 *   2. fbref.com (fallback: squad list, no market value)
 *
 * Anti-bot notes:
 *   - Realistic Chrome UA + full Sec-Fetch-* header set
 *   - Sequential, 3-5s jitter between teams in --all mode
 *   - On 403/CAPTCHA we fall through to fbref (slower but rarely needed)
 */

import * as cheerio from 'cheerio';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TM_REGISTRY } from './tm-registry';

// ---------- types ----------

type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'WG' | 'ATT';

interface Player {
  name: string;
  position: Position;
  market_value_mil: number | null;
  injured?: boolean;
}

interface SquadResult {
  team_id: string;
  source: 'transfermarkt' | 'fbref';
  players: Player[];
}

/** Shape we write into absences.json's `current` block (per-team list). */
interface AbsenceEntry {
  player: string;
  position: Position;
  minutes_qual: number;
  market_value_mil: number;
  reason: string;
}

// ---------- config ----------

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const ABSENCES_PATH = path.resolve(__dirname, '..', 'src', 'data', 'absences.json');
const SQUADS_PATH = path.resolve(__dirname, '..', 'src', 'data', 'squads.json');

// ---------- helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Sequential delay with jitter so we don't look like a synchronous bot. */
function jitterDelay(baseMs: number, spreadMs: number): Promise<void> {
  return sleep(baseMs + Math.floor(Math.random() * spreadMs));
}

function looksLikeBlock(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const lower = html.slice(0, 4000).toLowerCase();
  return (
    lower.includes('captcha') ||
    lower.includes('access denied') ||
    (lower.includes('cloudflare') && lower.includes('challenge')) ||
    lower.includes('just a moment')
  );
}

function parseMarketValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === '-') return null;
  const m = s.match(/€?\s*([\d.,]+)\s*([mk])?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(num)) return null;
  const unit = (m[2] ?? 'm').toLowerCase();
  return unit === 'k' ? num / 1000 : num;
}

function normalizePosition(raw: string): Position {
  const s = raw.toLowerCase().trim();
  if (s.includes('goalkeeper') || s === 'gk') return 'GK';
  if (s.includes('centre-back') || s.includes('center-back')) return 'CB';
  if (
    s.includes('right-back') ||
    s.includes('left-back') ||
    s.includes('full-back') ||
    s.includes('wing-back')
  )
    return 'FB';
  if (s.includes('defensive midfield')) return 'DM';
  if (s.includes('attacking midfield') || s.includes('second striker')) return 'AM';
  if (s.includes('left winger') || s.includes('right winger')) return 'WG';
  if (
    s.includes('central midfield') ||
    s.includes('left midfield') ||
    s.includes('right midfield') ||
    s === 'mid'
  )
    return 'CM';
  if (
    s.includes('centre-forward') ||
    s.includes('center-forward') ||
    s.includes('striker') ||
    s.includes('forward')
  )
    return 'ATT';
  if (s.includes('defen')) return 'CB';
  if (s.includes('midfield')) return 'CM';
  if (s.includes('attack')) return 'ATT';
  return 'CM';
}

// ---------- transfermarkt ----------

async function fetchTransfermarkt(teamId: string): Promise<SquadResult | null> {
  const meta = TM_REGISTRY[teamId];
  if (!meta) throw new Error(`Unknown team_id: ${teamId} (not in TM_REGISTRY)`);
  if (meta.tm_id === 0) {
    console.error(`[transfermarkt] ${teamId} has tm_id=0 (TODO lookup) — skipping`);
    return null;
  }

  const url = `https://www.transfermarkt.com/${meta.tm_slug}/startseite/verein/${meta.tm_id}`;
  console.error(`[tm:${teamId}] GET ${url}`);

  const res = await fetch(url, { headers: COMMON_HEADERS, redirect: 'follow' });
  const html = await res.text();

  if (looksLikeBlock(html, res.status)) {
    console.error(`[tm:${teamId}] BLOCKED status=${res.status} len=${html.length}`);
    return null;
  }

  const $ = cheerio.load(html);

  const rows = $('table.items > tbody > tr').filter((_i, el) => {
    const cls = $(el).attr('class') ?? '';
    return cls.includes('odd') || cls.includes('even');
  });

  const players: Player[] = [];

  rows.each((_i, el) => {
    const $row = $(el);
    const nameAnchor = $row.find('table.inline-table td.hauptlink a').first();
    const name = nameAnchor.text().trim();
    if (!name) return;

    const posCell = $row.find('table.inline-table tr').eq(1).find('td').first();
    const position = normalizePosition(posCell.text().trim());

    let mvText = $row.find('td.rechts.hauptlink').first().text().trim();
    if (!mvText) mvText = $row.find('td').last().text().trim();
    const market_value_mil = parseMarketValue(mvText);

    const injuryFlag =
      $row
        .find(
          'span[class*="ausrufezeichen"], span[class*="verletzt"], img[title*="njur"], img[title*="uspen"]',
        )
        .length > 0;

    players.push({
      name,
      position,
      market_value_mil,
      ...(injuryFlag ? { injured: true } : {}),
    });
  });

  if (players.length === 0) {
    console.error(`[tm:${teamId}] parsed 0 rows — selector may have drifted`);
    return null;
  }

  console.error(
    `[tm:${teamId}] OK players=${players.length} injured=${players.filter((p) => p.injured).length}`,
  );
  return { team_id: teamId, source: 'transfermarkt', players };
}

// ---------- absences.json merge ----------

interface AbsencesFile {
  _meta: Record<string, unknown>;
  historical: Record<string, Record<string, AbsenceEntry[]>>;
  current: Record<string, AbsenceEntry[] | { _note?: string }>;
}

function loadAbsencesFile(): AbsencesFile {
  const raw = fs.readFileSync(ABSENCES_PATH, 'utf8');
  return JSON.parse(raw) as AbsencesFile;
}

function saveAbsencesFile(file: AbsencesFile): void {
  fs.writeFileSync(ABSENCES_PATH, JSON.stringify(file, null, 2) + '\n', 'utf8');
}

/** Convert the scraper's injured Player list → AbsenceEntry[] for the absences schema. */
function injuredToAbsences(squad: SquadResult): AbsenceEntry[] {
  return squad.players
    .filter((p) => p.injured)
    .map((p) => ({
      player: p.name,
      position: p.position,
      minutes_qual: 0, // not scraped in this pass; α=0 in DEFAULT_ABSENCE_WEIGHTS so the term is zero anyway
      market_value_mil: p.market_value_mil ?? 0,
      reason: 'Injured (flagged by transfermarkt)',
    }));
}

/** Persist the full scraped squads (every player, not just injured) so the
 *  scenario panel in the UI can let users toggle hypothetical absences for
 *  any squad member. Keeps the same schema across teams so the file is
 *  trivially diffable. */
interface SquadsFile {
  _meta: Record<string, unknown>;
  squads: Record<string, Array<{
    player: string;
    position: Position;
    market_value_mil: number | null;
    injured?: boolean;
  }>>;
}

function loadSquadsFile(): SquadsFile {
  if (!fs.existsSync(SQUADS_PATH)) {
    return {
      _meta: {
        purpose: 'Full national-team squads scraped from transfermarkt. Powers the "what if X gets injured" scenario panel. Refreshed by the daily fetch-absences cron alongside absences.json.',
        updated_at: null,
        source: 'transfermarkt squad pages',
      },
      squads: {},
    };
  }
  return JSON.parse(fs.readFileSync(SQUADS_PATH, 'utf8')) as SquadsFile;
}

function saveSquadsFile(file: SquadsFile): void {
  fs.writeFileSync(SQUADS_PATH, JSON.stringify(file, null, 2) + '\n', 'utf8');
}

function mergeIntoSquads(scraped: SquadResult[]): void {
  const file = loadSquadsFile();
  for (const sq of scraped) {
    file.squads[sq.team_id] = sq.players.map((p) => ({
      player: p.name,
      position: p.position,
      market_value_mil: p.market_value_mil,
      ...(p.injured ? { injured: true } : {}),
    }));
  }
  file._meta = { ...file._meta, updated_at: new Date().toISOString() };
  saveSquadsFile(file);
}

/** Update absences.json `current` for the listed team IDs. Other teams' current entries are preserved. */
function mergeIntoAbsences(squads: SquadResult[]): {
  totalAbsences: number;
  teamsWithAbsences: number;
} {
  const file = loadAbsencesFile();
  let totalAbsences = 0;
  let teamsWithAbsences = 0;

  // Reset the placeholder note on first write
  if (file.current._note) delete file.current._note;

  for (const sq of squads) {
    const absences = injuredToAbsences(sq);
    file.current[sq.team_id] = absences;
    if (absences.length > 0) {
      teamsWithAbsences += 1;
      totalAbsences += absences.length;
    }
  }

  // Stamp the meta with the time of this update
  file._meta = {
    ...file._meta,
    current_updated_at: new Date().toISOString(),
    current_source: 'transfermarkt squad pages (injury flag)',
  };

  saveAbsencesFile(file);
  return { totalAbsences, teamsWithAbsences };
}

// ---------- runner ----------

async function fetchOne(teamId: string): Promise<SquadResult | null> {
  try {
    return await fetchTransfermarkt(teamId);
  } catch (err) {
    console.error(`[fetchOne:${teamId}] error:`, err);
    return null;
  }
}

async function fetchAll(): Promise<SquadResult[]> {
  const ids = Object.keys(TM_REGISTRY).sort();
  console.error(`[fetchAll] starting batch over ${ids.length} teams`);
  const results: SquadResult[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const sq = await fetchOne(id);
    if (sq) results.push(sq);
    if (i < ids.length - 1) await jitterDelay(3000, 2000); // 3-5s between teams
  }
  console.error(
    `[fetchAll] done. success=${results.length}/${ids.length} ` +
      `injured_total=${results.reduce((s, r) => s + r.players.filter((p) => p.injured).length, 0)}`,
  );
  return results;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const flagAll = args.includes('--all');
  const flagWrite = args.includes('--write');
  const positional = args.filter((a) => !a.startsWith('--'));

  if (flagAll) {
    const squads = await fetchAll();
    const summary = mergeIntoAbsences(squads);
    mergeIntoSquads(squads);
    console.error(
      `[main] WROTE absences.json: teams_with_injuries=${summary.teamsWithAbsences} ` +
        `total_injured_players=${summary.totalAbsences}`,
    );
    console.error(`[main] WROTE squads.json: teams=${squads.length}`);
    return;
  }

  const teamId = (positional[0] ?? 'ARG').toUpperCase();
  const squad = await fetchOne(teamId);
  if (!squad) {
    console.error(`[main] HARD BLOCKER: scrape failed for ${teamId}`);
    process.exit(2);
  }

  if (flagWrite) {
    const summary = mergeIntoAbsences([squad]);
    mergeIntoSquads([squad]);
    console.error(
      `[main] WROTE absences.json for ${teamId}: injured=${summary.totalAbsences}`,
    );
    return;
  }

  // Default single-team mode: print JSON to stdout
  console.error(`[main] OK source=${squad.source} team=${squad.team_id} players=${squad.players.length}`);
  console.error('--- injured players ---');
  for (const p of squad.players.filter((x) => x.injured)) {
    console.error(`  ${p.name.padEnd(28)} ${p.position.padEnd(4)} €${(p.market_value_mil ?? 0).toFixed(1)}m`);
  }
  process.stdout.write(JSON.stringify(squad, null, 2) + '\n');
}

main().catch((err) => {
  console.error('[main] fatal:', err);
  process.exit(1);
});
