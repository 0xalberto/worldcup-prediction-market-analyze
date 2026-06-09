/**
 * One-shot fetcher: compiles a historical backtest dataset for World Cup
 * 2014, 2018, 2022 by combining:
 *
 *  - pre-tournament ELO ratings from eloratings.net (end of prior year)
 *  - match results from openfootball/worldcup.json (90-minute scores)
 *
 * Output: src/data/backtest.json  →  consumed by /backtest page.
 *
 * Run with: npm run fetch-backtest
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT_PATH = resolve(process.cwd(), 'src/data/backtest.json');

interface TournamentSpec {
  year: number;
  /** Year whose end-of-year ELO snapshot we use as the pre-tournament rating. */
  eloYear: number;
  /** ISO3 of the host nation (gets host bonus). For multi-host years use the lead host. */
  hostId: string;
  /** Display name of the host. */
  hostName: string;
}

const TOURNAMENTS: TournamentSpec[] = [
  { year: 2014, eloYear: 2013, hostId: 'BRA', hostName: 'Brazil' },
  { year: 2018, eloYear: 2017, hostId: 'RUS', hostName: 'Russia' },
  { year: 2022, eloYear: 2021, hostId: 'QAT', hostName: 'Qatar' },
];

/**
 * Map eloratings.net's ISO 3166-1 alpha-2 codes to the 3-letter codes we use
 * internally. Built from the union of teams that appear in WC 2014/2018/2022.
 */
const ELO2_TO_ID: Record<string, string> = {
  // 2026 teams we already track (subset)
  ES: 'ESP', AR: 'ARG', FR: 'FRA', BR: 'BRA', PT: 'POR',
  NL: 'NED', BE: 'BEL', DE: 'GER', HR: 'CRO', CO: 'COL', UY: 'URU',
  MA: 'MAR', CH: 'SUI', SN: 'SEN', JP: 'JPN', US: 'USA', MX: 'MEX',
  EC: 'ECU', KR: 'KOR', IR: 'IRN', AU: 'AUS', EG: 'EGY', PY: 'PAR',
  DZ: 'ALG', AT: 'AUT', TR: 'TUR', CI: 'CIV', TN: 'TUN', NO: 'NOR',
  SE: 'SWE', CA: 'CAN', CZ: 'CZE', BA: 'BIH', GH: 'GHA', QA: 'QAT',
  SA: 'KSA', ZA: 'RSA', CD: 'COD', UZ: 'UZB', JO: 'JOR', IQ: 'IRQ',
  CV: 'CPV', CW: 'CUW', NZ: 'NZL', PA: 'PAN', HT: 'HAI',
  // historical-only teams (appeared in 2014/2018/2022 but not in our 2026 set)
  IT: 'ITA', RU: 'RUS', NG: 'NGA', GR: 'GRC', CR: 'CRC', BO: 'BOL',
  CM: 'CMR', HN: 'HON', CL: 'CHI', IS: 'ISL', PE: 'PER', PL: 'POL',
  DK: 'DEN', RS: 'SRB',
  // UK home nations — eloratings uses EN/WA/SC/NI (non-standard).
  EN: 'ENG', WA: 'WAL', SC: 'SCO', NI: 'NIR',
};

/** Map openfootball English team names → our 3-letter ID. */
const NAME_TO_ID: Record<string, string> = {
  // Top 12
  'Brazil': 'BRA', 'Argentina': 'ARG', 'Germany': 'GER', 'France': 'FRA',
  'Spain': 'ESP', 'Italy': 'ITA', 'England': 'ENG', 'Netherlands': 'NED',
  'Belgium': 'BEL', 'Portugal': 'POR', 'Uruguay': 'URU', 'Croatia': 'CRO',
  // CONMEBOL
  'Chile': 'CHI', 'Colombia': 'COL', 'Ecuador': 'ECU', 'Peru': 'PER', 'Paraguay': 'PAR',
  // CONCACAF / North America
  'Mexico': 'MEX', 'United States': 'USA', 'USA': 'USA', 'Costa Rica': 'CRC',
  'Honduras': 'HON', 'Canada': 'CAN', 'Panama': 'PAN',
  // Europe
  'Switzerland': 'SUI', 'Russia': 'RUS', 'Poland': 'POL', 'Sweden': 'SWE',
  'Denmark': 'DEN', 'Serbia': 'SRB', 'Iceland': 'ISL', 'Greece': 'GRC',
  'Bosnia and Herzegovina': 'BIH', 'Bosnia-Herzegovina': 'BIH',
  'Czech Republic': 'CZE', 'Czechia': 'CZE', 'Wales': 'WAL',
  // CAF
  'Nigeria': 'NGA', 'Cameroon': 'CMR', "Côte d'Ivoire": 'CIV', 'Ivory Coast': 'CIV',
  'Ghana': 'GHA', 'Algeria': 'ALG', 'Tunisia': 'TUN', 'Morocco': 'MAR',
  'Senegal': 'SEN', 'Egypt': 'EGY', 'South Africa': 'RSA',
  // AFC
  'Australia': 'AUS', 'Japan': 'JPN', 'South Korea': 'KOR', 'Korea Republic': 'KOR',
  'Iran': 'IRN', 'IR Iran': 'IRN', 'Saudi Arabia': 'KSA', 'Qatar': 'QAT',
};

interface ParsedEloRow { code: string; rating: number }

async function fetchEloYear(year: number): Promise<Map<string, number>> {
  const url = `https://www.eloratings.net/${year}.tsv`;
  console.log(`Fetching ELO snapshot: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'mundial2026-sim/backtest' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const tsv = await res.text();
  const out = new Map<string, number>();
  for (const line of tsv.split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    // col 3 = ISO2 code, col 4 = rating at end of `year`
    const code = cols[2]?.trim().toUpperCase();
    const rating = parseFloat(cols[3]);
    if (!code || !Number.isFinite(rating)) continue;
    const id = ELO2_TO_ID[code];
    if (id) out.set(id, Math.round(rating));
  }
  return out;
}

interface OpenfootballMatch {
  date: string;
  team1: string;
  team2: string;
  score?: {
    ft?: [number, number];   // end of regulation (90 min)
    ht?: [number, number];   // half-time
    et?: [number, number];   // end of extra time
    p?: [number, number];    // penalty shoot-out score (only present if PKs)
  };
  round?: string;
  group?: string;
}

async function fetchMatches(year: number): Promise<OpenfootballMatch[]> {
  const url = `https://raw.githubusercontent.com/openfootball/worldcup.json/master/${year}/worldcup.json`;
  console.log(`Fetching matches: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const j = await res.json() as { matches: OpenfootballMatch[] };
  return j.matches;
}

function classifyStage(m: OpenfootballMatch): 'group' | 'r16' | 'qf' | 'sf' | '3rd' | 'final' {
  const r = (m.round || '').toLowerCase();
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) {
    return r.includes('third') || r.includes('3rd') ? '3rd' : 'final';
  }
  if (r.includes('semi')) return 'sf';
  if (r.includes('quarter')) return 'qf';
  if (r.includes('round of 16') || r.includes('1/8') || r.includes('eighth')) return 'r16';
  if (r.includes('third place') || r.includes('3rd place')) return '3rd';
  return 'group';
}

interface BacktestMatch {
  date: string;
  stage: 'group' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';
  home: string;        // ISO3 (openfootball's `team1`)
  away: string;        // ISO3 (`team2`)
  gh: number;          // regulation-time goals for home (score.ft[0])
  ga: number;          // regulation-time goals for away
  /**
   * Penalty shoot-out winner, or null if no shoot-out happened. When set, the
   * match was tied in extra time and decided on penalties — this is what the
   * penalty model is evaluated against.
   */
  pen_winner?: 'home' | 'away' | null;
}

interface BacktestTournament {
  year: number;
  host_id: string;
  host_name: string;
  /** Pre-tournament ELO ratings keyed by ISO3 (end-of-prior-year snapshot). */
  elo: Record<string, number>;
  /**
   * Past ELO snapshots for recent-form weighting. Key = years before the
   * pre-tournament snapshot. So for WC 2014 (pre-snapshot = end of 2013):
   *   elo_history["1"] = end of 2012 (12 months before pre-snapshot)
   *   elo_history["2"] = end of 2011
   *   ...
   *   elo_history["5"] = end of 2008
   * Teams missing from the older snapshot (new admissions, name changes) are
   * simply absent — the predictor falls back to the base ELO with no recent
   * adjustment for those teams.
   */
  elo_history: Record<string, Record<string, number>>;
  matches: BacktestMatch[];
  /** Teams referenced in matches but missing from the elo map (skipped). */
  missing_elo: string[];
  /** Team names in match data we couldn't map to an ID. */
  unmapped_names: string[];
}

/** Years of historical ELO to capture for recent-form weighting. */
const LOOKBACK_YEARS = [1, 2, 3, 4, 5];

async function compileTournament(spec: TournamentSpec): Promise<BacktestTournament> {
  // Fetch in parallel: matches + base ELO + N lookback snapshots.
  const historicalYears = LOOKBACK_YEARS.map((y) => spec.eloYear - y);
  const [elo, matches, ...history] = await Promise.all([
    fetchEloYear(spec.eloYear),
    fetchMatches(spec.year),
    ...historicalYears.map((y) => fetchEloYear(y)),
  ]);

  const unmapped = new Set<string>();
  const out: BacktestMatch[] = [];
  const usedIds = new Set<string>();

  for (const m of matches) {
    if (!m.score?.ft) continue;  // unplayed
    const homeId = NAME_TO_ID[m.team1];
    const awayId = NAME_TO_ID[m.team2];
    if (!homeId) { unmapped.add(m.team1); continue; }
    if (!awayId) { unmapped.add(m.team2); continue; }
    let pen_winner: 'home' | 'away' | null = null;
    if (m.score.p && m.score.p[0] !== m.score.p[1]) {
      pen_winner = m.score.p[0] > m.score.p[1] ? 'home' : 'away';
    }
    out.push({
      date: m.date,
      stage: classifyStage(m),
      home: homeId,
      away: awayId,
      gh: m.score.ft[0],
      ga: m.score.ft[1],
      pen_winner,
    });
    usedIds.add(homeId); usedIds.add(awayId);
  }

  const eloOut: Record<string, number> = {};
  const missing: string[] = [];
  for (const id of usedIds) {
    const r = elo.get(id);
    if (r === undefined) missing.push(id);
    else eloOut[id] = r;
  }

  // Project each historical snapshot onto the tournament's team set.
  const eloHistory: Record<string, Record<string, number>> = {};
  LOOKBACK_YEARS.forEach((years, i) => {
    const snap = history[i];
    const proj: Record<string, number> = {};
    for (const id of usedIds) {
      const r = snap.get(id);
      if (r !== undefined) proj[id] = r;
    }
    eloHistory[String(years)] = proj;
  });

  return {
    year: spec.year,
    host_id: spec.hostId,
    host_name: spec.hostName,
    elo: eloOut,
    elo_history: eloHistory,
    matches: out,
    missing_elo: missing,
    unmapped_names: [...unmapped],
  };
}

async function main() {
  const tournaments: BacktestTournament[] = [];
  for (const spec of TOURNAMENTS) {
    const t = await compileTournament(spec);
    console.log(`\nWC ${t.year} (${t.host_name}):`);
    console.log(`  matches with scores: ${t.matches.length}`);
    console.log(`  teams in elo map:    ${Object.keys(t.elo).length}`);
    if (t.missing_elo.length) console.warn(`  missing ELO for:     ${t.missing_elo.join(', ')}`);
    if (t.unmapped_names.length) console.warn(`  unmapped team names: ${t.unmapped_names.join(', ')}`);
    tournaments.push(t);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify({
    _meta: {
      sources: [
        'eloratings.net/{prior_year}.tsv  (pre-tournament ELO)',
        'github.com/openfootball/worldcup.json  (regulation-time match results)',
      ],
      fetched_at: new Date().toISOString(),
      note: 'Backtest dataset for WC 2014/2018/2022. ELO is end-of-prior-year. Scores are regulation time (90 min), so finals decided in extra time / penalties appear as draws — match the model output.',
    },
    tournaments,
  }, null, 2) + '\n', 'utf-8');
  console.log(`\nWrote ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
