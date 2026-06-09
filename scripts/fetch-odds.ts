/**
 * Fetches betting odds for the 2026 World Cup from public sources and writes
 * them to src/data/market-odds.json for the MarketEdge UI to consume.
 *
 * Sources supported:
 *  1. The Odds API — set ODDS_API_KEY in .env.local. Free tier 500 requests/month.
 *     Endpoint: https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds
 *  2. Polymarket — public gamma API, no key. Provide POLYMARKET_SLUG to target a
 *     specific market (e.g. "fifa-world-cup-2026-winner").
 *
 * Run with: npm run fetch-odds
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'node:process';

import type { MarketOdds, MarketOddsFile } from '../src/lib/sim/market';
import { devig } from '../src/lib/sim/market';

const OUT_PATH = resolve(process.cwd(), 'src/data/market-odds.json');
const TEAMS_PATH = resolve(process.cwd(), 'src/data/teams.json');

interface Team { id: string; name_en: string; name_es: string }
const TEAMS: Team[] = (JSON.parse(readFileSync(TEAMS_PATH, 'utf-8')) as { teams: Team[] }).teams;

/** Normalize a team name (eg. "Spain" or "España") to an internal ID like "ESP". */
function toTeamId(name: string): string | undefined {
  const norm = name.trim().toLowerCase();
  for (const t of TEAMS) {
    if (t.name_en.toLowerCase() === norm) return t.id;
    if (t.name_es.toLowerCase() === norm) return t.id;
    // alias common spellings
    if (norm.includes('united states') && t.id === 'USA') return 'USA';
    if (norm.includes('south korea') && t.id === 'KOR') return 'KOR';
    if (norm.includes('ivory coast') && t.id === 'CIV') return 'CIV';
    if (norm.includes('curacao') && t.id === 'CUW') return 'CUW';
    if ((norm === 'czechia' || norm === 'czech republic') && t.id === 'CZE') return 'CZE';
  }
  return undefined;
}

async function fromTheOddsApi(apiKey: string): Promise<MarketOdds[]> {
  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds?apiKey=${apiKey}&regions=us,uk,eu&markets=outrights&oddsFormat=decimal`;
  console.log(`Fetching The Odds API (winner market)…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The Odds API: ${res.status} ${res.statusText}`);
  const data = await res.json() as Array<{
    sport_key: string;
    bookmakers: Array<{
      key: string;
      markets: Array<{ outcomes: Array<{ name: string; price: number }> }>;
    }>;
  }>;

  const out: MarketOdds[] = [];
  // Each tournament has one bookmaker entry per book; outcomes is the full team list.
  for (const event of data) {
    for (const bm of event.bookmakers) {
      for (const m of bm.markets) {
        const implied = m.outcomes.map((o) => 1 / o.price);
        const fair = devig(implied);
        m.outcomes.forEach((o, i) => {
          const id = toTeamId(o.name);
          if (!id) {
            console.warn(`  unknown team: ${o.name}`);
            return;
          }
          out.push({
            market: 'winner',
            team_id: id,
            book: bm.key,
            decimal_odds: o.price,
            implied_prob: implied[i],
            fair_prob: fair[i],
            fetched_at: new Date().toISOString(),
          });
        });
      }
    }
  }
  return out;
}

async function fromPolymarket(slug: string): Promise<MarketOdds[]> {
  console.log(`Fetching Polymarket gamma API (slug=${slug})…`);
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polymarket: ${res.status} ${res.statusText}`);
  const data = await res.json() as Array<{
    outcomes: string;       // JSON-encoded array
    outcomePrices: string;  // JSON-encoded array
    question: string;
  }>;
  const out: MarketOdds[] = [];
  for (const m of data) {
    const outcomes = JSON.parse(m.outcomes) as string[];
    const prices = (JSON.parse(m.outcomePrices) as string[]).map(Number);
    // Polymarket prices are already in [0,1] probability terms.
    const fair = devig(prices); // should already sum to ~1 but renormalize
    outcomes.forEach((name, i) => {
      const id = toTeamId(name);
      if (!id || prices[i] <= 0) return;
      out.push({
        market: 'winner',
        team_id: id,
        book: 'polymarket',
        decimal_odds: 1 / prices[i],
        implied_prob: prices[i],
        fair_prob: fair[i],
        fetched_at: new Date().toISOString(),
      });
    });
  }
  return out;
}

async function main() {
  const apiKey = process.env.ODDS_API_KEY;
  const slug = process.env.POLYMARKET_SLUG;

  let odds: MarketOdds[] = [];
  const sources: string[] = [];

  if (apiKey) {
    try {
      odds = odds.concat(await fromTheOddsApi(apiKey));
      sources.push('The Odds API');
    } catch (e) {
      console.error('The Odds API failed:', e instanceof Error ? e.message : e);
    }
  } else {
    console.log('ODDS_API_KEY not set — skipping The Odds API.');
  }

  if (slug) {
    try {
      odds = odds.concat(await fromPolymarket(slug));
      sources.push('Polymarket');
    } catch (e) {
      console.error('Polymarket failed:', e instanceof Error ? e.message : e);
    }
  } else {
    console.log('POLYMARKET_SLUG not set — skipping Polymarket.');
  }

  if (odds.length === 0) {
    console.warn('\nNo odds collected. Set ODDS_API_KEY and/or POLYMARKET_SLUG in .env.local and retry.');
  }

  const file: MarketOddsFile = {
    _meta: {
      sources,
      fetched_at: new Date().toISOString(),
      note: odds.length === 0
        ? 'No odds available yet. Run with ODDS_API_KEY or POLYMARKET_SLUG.'
        : `Aggregated ${odds.length} odds entries from ${sources.length} source(s).`,
    },
    odds,
  };

  writeFileSync(OUT_PATH, JSON.stringify(file, null, 2) + '\n', 'utf-8');
  console.log(`\nWrote ${odds.length} entries to ${OUT_PATH}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
