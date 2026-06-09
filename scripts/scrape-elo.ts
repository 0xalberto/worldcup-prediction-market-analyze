/**
 * Fetches current ELO ratings from eloratings.net and updates src/data/teams.json.
 *
 * eloratings.net publishes a TSV at https://www.eloratings.net/World.tsv with all
 * national teams. The columns we care about: ISO3 code (col 1) and current rating (col 3).
 *
 * Usage: npm run scrape-elo
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEAMS_PATH = resolve(process.cwd(), 'src/data/teams.json');
const SOURCE_URL = 'https://www.eloratings.net/World.tsv';
// 1-year-ago snapshot for the recent-form blend (Tier 1 #2). Reads col 4 of
// the prior-year TSV = ELO at end of that year. Today is 2026-05-17, so we
// want end-of-2024 = 12 months before today's snapshot.
const LOOKBACK_URL = 'https://www.eloratings.net/2024.tsv';

// Map our internal team IDs to eloratings.net codes (mostly matches, with overrides)
const ID_OVERRIDES: Record<string, string> = {
  ENG: 'ENG',
  SCO: 'SCO',
  KOR: 'KOR',
  USA: 'USA',
  IRN: 'IRN', // some sources use IRN, others IRA
  IRQ: 'IRQ',
  KSA: 'KSA',
  CIV: 'CIV',
  CPV: 'CPV',
  COD: 'COD',
  RSA: 'RSA',
  CUW: 'CUW',
  POR: 'POR',
  GER: 'GER',
  NED: 'NED',
  CRO: 'CRO',
  SUI: 'SUI',
  SEN: 'SEN',
  JPN: 'JPN',
  ARG: 'ARG',
  BRA: 'BRA',
  FRA: 'FRA',
  ESP: 'ESP',
  BEL: 'BEL',
  MAR: 'MAR',
  COL: 'COL',
  URU: 'URU',
  ECU: 'ECU',
  PAR: 'PAR',
  MEX: 'MEX',
  CAN: 'CAN',
  AUS: 'AUS',
  EGY: 'EGY',
  ALG: 'ALG',
  TUN: 'TUN',
  AUT: 'AUT',
  TUR: 'TUR',
  NOR: 'NOR',
  SWE: 'SWE',
  CZE: 'CZE',
  BIH: 'BIH',
  GHA: 'GHA',
  QAT: 'QAT',
  UZB: 'UZB',
  JOR: 'JOR',
  NZL: 'NZL',
  PAN: 'PAN',
  HAI: 'HAI',
};

interface Team {
  id: string;
  name_en: string;
  name_es: string;
  flag: string;
  elo: number;
  is_host: boolean;
  elo_1y_ago?: number | null;
}

/**
 * eloratings.net uses ISO 3166-1 alpha-2 codes (ES, AR, BR, …) plus a few
 * non-standard ones for UK home nations (EN, WA, SC, NI). The World.tsv at
 * the current snapshot is keyed by alpha-2 in col 1, but the year-by-year
 * TSVs use a slightly different schema: col 1 is a marker ("−"), col 3 is
 * the alpha-2 code, col 4 is the rating at end of that year. We normalize
 * to 3-letter ids matching teams.json via this map.
 */
const ELO2_TO_ID: Record<string, string> = {
  ES: 'ESP', AR: 'ARG', FR: 'FRA', BR: 'BRA', PT: 'POR',
  NL: 'NED', BE: 'BEL', DE: 'GER', HR: 'CRO', CO: 'COL', UY: 'URU',
  MA: 'MAR', CH: 'SUI', SN: 'SEN', JP: 'JPN', US: 'USA', MX: 'MEX',
  EC: 'ECU', KR: 'KOR', IR: 'IRN', AU: 'AUS', EG: 'EGY', PY: 'PAR',
  DZ: 'ALG', AT: 'AUT', TR: 'TUR', CI: 'CIV', TN: 'TUN', NO: 'NOR',
  SE: 'SWE', CA: 'CAN', CZ: 'CZE', BA: 'BIH', GH: 'GHA', QA: 'QAT',
  SA: 'KSA', ZA: 'RSA', CD: 'COD', UZ: 'UZB', JO: 'JOR', IQ: 'IRQ',
  CV: 'CPV', CW: 'CUW', NZ: 'NZL', PA: 'PAN', HT: 'HAI',
  EN: 'ENG', WA: 'WAL', SC: 'SCO', NI: 'NIR',
};

interface TeamsFile {
  _meta: Record<string, unknown>;
  teams: Team[];
}

/** Parse current World.tsv — same column layout as yearly TSVs: col 3 = code, col 4 = rating. */
async function fetchCurrent(): Promise<Map<string, number>> {
  return fetchYearly(SOURCE_URL);
}

/** Parse yearly TSV — col 3 = code, col 4 = rating at end of that year. */
async function fetchYearly(url: string): Promise<Map<string, number>> {
  console.log(`Fetching ${url}…`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'mundial2026-sim/0.1 (scrape-elo)' },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  const tsv = await res.text();
  const out = new Map<string, number>();
  for (const line of tsv.split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    const code = cols[2]?.trim().toUpperCase();
    const rating = parseFloat(cols[3]);
    if (!code || !Number.isFinite(rating)) continue;
    const id = ELO2_TO_ID[code];
    if (id) out.set(id, Math.round(rating));
  }
  return out;
}

async function main() {
  const [current, lookback] = await Promise.all([
    fetchCurrent(),
    fetchYearly(LOOKBACK_URL),
  ]);
  console.log(`Parsed ${current.size} current ratings and ${lookback.size} 1-year-ago ratings.`);

  const data: TeamsFile = JSON.parse(readFileSync(TEAMS_PATH, 'utf-8'));
  let updatedNow = 0, updatedHistory = 0;
  const missing: string[] = [];
  const missingHistory: string[] = [];

  for (const team of data.teams) {
    // fetchYearly already maps ISO2 → 3-letter id, so we key by team.id directly.
    const fresh = current.get(team.id);
    if (fresh === undefined) {
      missing.push(team.id);
    } else if (Math.abs(team.elo - fresh) > 0.5) {
      console.log(`  ${team.id}: ${team.elo} → ${fresh.toFixed(0)}`);
      team.elo = Math.round(fresh);
      updatedNow++;
    }

    const oneYearAgo = lookback.get(team.id);
    if (oneYearAgo === undefined) {
      missingHistory.push(team.id);
      if (team.elo_1y_ago === undefined) team.elo_1y_ago = null;
    } else if (team.elo_1y_ago !== oneYearAgo) {
      team.elo_1y_ago = oneYearAgo;
      updatedHistory++;
    }
  }

  if (missing.length > 0) {
    console.warn(`\nMissing current rating (kept existing value): ${missing.join(', ')}`);
  }
  if (missingHistory.length > 0) {
    console.warn(`Missing 1y-ago rating (no recent-form adjustment will apply): ${missingHistory.join(', ')}`);
  }

  data._meta = {
    ...data._meta,
    source: `Scraped from ${SOURCE_URL} + ${LOOKBACK_URL}`,
    fetched_at: new Date().toISOString(),
  };

  writeFileSync(TEAMS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`\nUpdated ${updatedNow} current ratings and ${updatedHistory} 1y-ago ratings. Wrote ${TEAMS_PATH}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
