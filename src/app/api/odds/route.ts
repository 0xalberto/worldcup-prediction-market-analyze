import { NextResponse } from 'next/server';
import { devig, type MarketOdds, type MarketOddsFile } from '@/lib/sim/market';
import teamsJson from '@/data/teams.json';

// Edge-friendly route; revalidate every 5 minutes so visitors share a fresh cache
// without hammering the upstream APIs.
export const revalidate = 300;

interface Team { id: string; name_en: string; name_es: string }
const TEAMS: Team[] = (teamsJson as { teams: Team[] }).teams;

function toTeamId(name: string): string | undefined {
  const norm = name.trim().toLowerCase();
  for (const t of TEAMS) {
    if (t.name_en.toLowerCase() === norm) return t.id;
    if (t.name_es.toLowerCase() === norm) return t.id;
  }
  // Common spelling variants returned by upstream sources.
  if (norm === 'united states' || norm === 'usa' || norm === 'us') return 'USA';
  if (norm === 'south korea' || norm === 'korea republic' || norm === 'republic of korea') return 'KOR';
  if (norm === 'ivory coast' || norm === "côte d'ivoire" || norm === "cote d'ivoire") return 'CIV';
  if (norm === 'curacao' || norm === 'curaçao') return 'CUW';
  if (norm === 'czechia' || norm === 'czech republic') return 'CZE';
  if (norm === 'congo dr' || norm === 'dr congo' || norm === 'democratic republic of the congo') return 'COD';
  if (norm === 'cape verde' || norm === 'cabo verde') return 'CPV';
  if (norm === 'bosnia and herzegovina' || norm === 'bosnia & herzegovina') return 'BIH';
  if (norm === 'iran' || norm === 'islamic republic of iran') return 'IRN';
  return undefined;
}

// ---------------------------------------------------------------------------
// Polymarket - public gamma API, no auth needed.
// The 2026 World Cup winner lives at event `2026-fifa-world-cup-winner-595`
// (the `-595` suffix is the event ID; Polymarket slugs include the ID).
// The event nests ~60 binary YES/NO markets, one per team, each with a
// `groupItemTitle` matching the team name. We use the orderbook midpoint
// (bestBid+bestAsk)/2 when available - it's more current than lastTradePrice
// for low-liquidity longshot markets.
// ---------------------------------------------------------------------------
async function fromPolymarket(): Promise<MarketOdds[]> {
  const slug = process.env.POLYMARKET_SLUG || '2026-fifa-world-cup-winner-595';
  const url = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Polymarket: ${res.status} ${res.statusText}`);
  const data = await res.json() as Array<{
    slug: string;
    title?: string;
    markets?: Array<{
      slug: string;
      question?: string;
      groupItemTitle?: string;
      outcomes?: string;
      outcomePrices?: string;
      closed?: boolean;
      active?: boolean;
      bestBid?: number;
      bestAsk?: number;
      lastTradePrice?: number;
    }>;
  }>;

  const candidates: Array<{ teamId: string; price: number }> = [];

  for (const ev of data) {
    for (const m of (ev.markets || [])) {
      if (m.closed === true || m.active === false) continue;

      // Try to identify the team. `groupItemTitle` is the clean team name
      // ("Spain", "Côte d'Ivoire", etc.); fall back to question regex.
      const candidateName = m.groupItemTitle
        || m.question?.match(/(?:will the |will )?([A-Za-zÀ-ÿ' ]+?) win/i)?.[1]
        || '';
      const teamId = toTeamId(candidateName);
      if (!teamId) continue;

      // Pricing: orderbook midpoint > last trade > outcomePrices YES leg.
      let price: number | null = null;
      if (typeof m.bestBid === 'number' && typeof m.bestAsk === 'number'
          && m.bestBid > 0 && m.bestAsk > 0) {
        price = (m.bestBid + m.bestAsk) / 2;
      } else if (typeof m.lastTradePrice === 'number' && m.lastTradePrice > 0) {
        price = m.lastTradePrice;
      } else if (m.outcomes && m.outcomePrices) {
        try {
          const outcomes = JSON.parse(m.outcomes) as string[];
          const prices = (JSON.parse(m.outcomePrices) as string[]).map(Number);
          const yesIdx = outcomes.findIndex((o) => /^yes$/i.test(o));
          if (yesIdx >= 0 && Number.isFinite(prices[yesIdx])) price = prices[yesIdx];
        } catch {
          // fall through - no price
        }
      }
      if (price === null || !Number.isFinite(price) || price <= 0 || price >= 1) continue;
      candidates.push({ teamId, price });
    }
  }

  if (candidates.length === 0) return [];

  // De-vig across the implied YES probabilities so they sum to 1.
  const implied = candidates.map((c) => c.price);
  const fair = devig(implied);
  return candidates.map((c, i) => ({
    market: 'winner' as const,
    team_id: c.teamId,
    book: 'polymarket',
    decimal_odds: 1 / c.price,
    implied_prob: c.price,
    fair_prob: fair[i],
    fetched_at: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Kalshi - public elections API, no auth needed for read-only market data.
// The 2026 Men's World Cup winner lives at event KXMENWORLDCUP-26 with one
// binary YES/NO market per team. We use the bid/ask midpoint as the implied
// probability (the last_price field lags illiquid markets).
// ---------------------------------------------------------------------------
async function fromKalshi(): Promise<MarketOdds[]> {
  const eventTicker = process.env.KALSHI_EVENT_TICKER || 'KXMENWORLDCUP-26';
  const url = `https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=${encodeURIComponent(eventTicker)}&limit=300&status=open`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Kalshi: ${res.status} ${res.statusText}`);
  const data = await res.json() as {
    markets: Array<{
      ticker: string;
      status: string;
      yes_sub_title?: string;
      yes_bid_dollars?: string;
      yes_ask_dollars?: string;
      last_price_dollars?: string;
    }>;
  };

  const candidates: Array<{ teamId: string; price: number }> = [];
  for (const m of (data.markets || [])) {
    if (m.status !== 'active') continue;
    const teamId = toTeamId(m.yes_sub_title || '');
    if (!teamId) continue;
    const bid = Number(m.yes_bid_dollars || 0);
    const ask = Number(m.yes_ask_dollars || 0);
    const last = Number(m.last_price_dollars || 0);
    // Midpoint when both sides quoted, else fall back to last trade.
    const price = (bid > 0 && ask > 0) ? (bid + ask) / 2 : (last > 0 ? last : 0);
    if (!Number.isFinite(price) || price <= 0 || price >= 1) continue;
    candidates.push({ teamId, price });
  }

  if (candidates.length === 0) return [];

  const implied = candidates.map((c) => c.price);
  const fair = devig(implied);
  return candidates.map((c, i) => ({
    market: 'winner' as const,
    team_id: c.teamId,
    book: 'kalshi',
    decimal_odds: 1 / c.price,
    implied_prob: c.price,
    fair_prob: fair[i],
    fetched_at: new Date().toISOString(),
  }));
}

export async function GET() {
  const sources: string[] = [];
  const errors: Record<string, string> = {};
  let odds: MarketOdds[] = [];

  const [poly, kal] = await Promise.allSettled([fromPolymarket(), fromKalshi()]);

  if (poly.status === 'fulfilled' && poly.value.length > 0) {
    odds = odds.concat(poly.value);
    sources.push('Polymarket');
  } else if (poly.status === 'rejected') {
    errors.polymarket = poly.reason instanceof Error ? poly.reason.message : String(poly.reason);
  }

  if (kal.status === 'fulfilled' && kal.value.length > 0) {
    odds = odds.concat(kal.value);
    sources.push('Kalshi');
  } else if (kal.status === 'rejected') {
    errors.kalshi = kal.reason instanceof Error ? kal.reason.message : String(kal.reason);
  }

  const file: MarketOddsFile = {
    _meta: {
      sources,
      fetched_at: new Date().toISOString(),
      note: odds.length === 0
        ? 'No odds available right now - both upstream sources returned empty or failed.'
        : `Aggregated ${odds.length} odds across ${sources.length} source(s).`,
    },
    odds,
  };

  return NextResponse.json(
    { ...file, errors },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
