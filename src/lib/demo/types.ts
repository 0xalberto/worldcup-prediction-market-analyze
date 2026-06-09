export const DEMO_STARTING_BALANCE = 1000;
export const DEMO_STORAGE_KEY = 'wc26-demo-v1';

export type DemoMarketType = 'winner' | 'group_winner' | 'h2h';

export interface DemoMarket {
  id: string;
  type: DemoMarketType;
  title: string;
  subtitle: string;
  /** Model probability for the YES outcome (0–1). */
  yesPrice: number;
  teamId?: string;
  groupId?: string;
  /** Fixture key from sim aggregates, e.g. "D:0" or "104". */
  slotKey?: string;
  /** For h2h: team that YES means wins / advances. */
  yesTeamId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
}

export interface DemoMarketPosition {
  id: string;
  marketId: string;
  side: 'yes' | 'no';
  shares: number;
  avgPrice: number;
  createdAt: number;
  settled?: boolean;
  payout?: number;
}

export interface DemoTicketListing {
  id: string;
  matchLabel: string;
  venue: string;
  category: string;
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  faceValue: number;
  askPrice: number;
  fairPrice: number;
  teamIds: string[];
  /** Synthetic inventory - demo only. */
  available: number;
}

export interface DemoTicketHolding {
  id: string;
  listingId: string;
  quantity: number;
  avgPrice: number;
  purchasedAt: number;
}

export interface DemoWalletState {
  balance: number;
  positions: DemoMarketPosition[];
  tickets: DemoTicketHolding[];
  lastSettledAt: number | null;
  settlementLabel: string | null;
}

export function defaultWalletState(): DemoWalletState {
  return {
    balance: DEMO_STARTING_BALANCE,
    positions: [],
    tickets: [],
    lastSettledAt: null,
    settlementLabel: null,
  };
}

/** NO price from model YES probability (binary market). */
export function marketNoPrice(yesPrice: number): number {
  return Math.max(0.01, Math.min(0.99, 1 - yesPrice));
}

export function marketPriceForSide(market: DemoMarket, side: 'yes' | 'no'): number {
  return side === 'yes' ? market.yesPrice : marketNoPrice(market.yesPrice);
}
