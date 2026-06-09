/**
 * Market-edge calculations: comparing our Monte Carlo probabilities against
 * the implied probabilities of bookmakers / prediction markets.
 *
 * Definitions
 *
 *   implied_prob   = 1 / decimal_odds
 *                   raw probability the market assigns, INCLUDES the
 *                   bookmaker's margin (vig).
 *
 *   fair_prob      = implied_prob / sum(implied_probs across all market outcomes)
 *                   the de-vigged probability - what the market "really" thinks
 *                   after subtracting the margin proportionally.
 *
 *   edge           = our_prob - fair_prob
 *                   positive edge = our model is more bullish than the market
 *                   (potential value bet, if model is well-calibrated).
 *
 *   ev_per_unit    = our_prob × (decimal_odds - 1) - (1 - our_prob)
 *                   expected payoff per 1 unit staked, in units. Positive EV
 *                   means our model thinks the bet is profitable in the long run.
 *
 * Important caveats
 *
 *   - These calculations assume our model is calibrated correctly. Our ELO+Poisson
 *     model captures team strength based on history but does NOT model: injuries,
 *     squad rotation, current form, manager changes, weather, ref bias, motivation
 *     levels in dead rubbers, etc. The market often prices these in.
 *   - A positive edge from a single market is weak evidence. A consistent edge
 *     across multiple books and markets is stronger.
 *   - This is statistical analysis, NOT financial advice.
 */

export interface MarketOdds {
  /** What market this odd refers to. */
  market: 'winner' | 'finalist' | 'top4' | 'group_winner' | 'h2h_match';
  /** Team ID for outright markets. */
  team_id?: string;
  /** Pair of team IDs for head-to-head match markets. */
  teams?: [string, string];
  /** Slot ID for h2h_match (the fixture key, e.g. "A:0" or "104"). */
  slot_id?: string;
  /** Bookmaker name (Pinnacle, FanDuel, etc.) */
  book: string;
  /** Best decimal odds offered. */
  decimal_odds: number;
  /** Raw 1/odds. */
  implied_prob: number;
  /** De-vigged probability, summing to 1.0 across the market. */
  fair_prob: number;
  /** ISO timestamp when these odds were fetched. */
  fetched_at: string;
}

export interface MarketOddsFile {
  _meta: {
    sources: string[];
    fetched_at: string;
    note: string;
  };
  odds: MarketOdds[];
}

export function computeEdge(ourProb: number, fairProb: number): number {
  return ourProb - fairProb;
}

export function computeEV(ourProb: number, decimalOdds: number): number {
  return ourProb * (decimalOdds - 1) - (1 - ourProb);
}

/** Remove vig proportionally: P(i)_fair = P(i)_implied / sum(P_implied). */
export function devig(implieds: number[]): number[] {
  const sum = implieds.reduce((a, b) => a + b, 0);
  return sum > 0 ? implieds.map((p) => p / sum) : implieds.map(() => 0);
}

export interface EdgeRow {
  market: MarketOdds['market'];
  team_id: string;
  book: string;
  decimal_odds: number;
  fair_prob: number;
  our_prob: number;
  edge: number;
  ev: number;
}

export function buildEdgeTable(
  odds: MarketOdds[],
  ourProbByTeamId: (market: MarketOdds['market'], teamId: string) => number | undefined,
): EdgeRow[] {
  const rows: EdgeRow[] = [];
  for (const o of odds) {
    if (!o.team_id) continue;
    const our = ourProbByTeamId(o.market, o.team_id);
    if (our === undefined) continue;
    rows.push({
      market: o.market,
      team_id: o.team_id,
      book: o.book,
      decimal_odds: o.decimal_odds,
      fair_prob: o.fair_prob,
      our_prob: our,
      edge: computeEdge(our, o.fair_prob),
      ev: computeEV(our, o.decimal_odds),
    });
  }
  // Sort by EV descending so highest-value bets are first.
  rows.sort((a, b) => b.ev - a.ev);
  return rows;
}
