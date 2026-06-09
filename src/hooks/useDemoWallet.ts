'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SerializedResult } from '@/lib/sim/worker';
import type { SampleSim } from '@/lib/sim/types';
import { buildDemoMarkets, resolveMarketYes, settlementLabel } from '@/lib/demo/markets';
import type { DemoMarket, DemoMarketPosition, DemoTicketListing, DemoWalletState } from '@/lib/demo/types';
import { DEMO_STORAGE_KEY, defaultWalletState, marketPriceForSide } from '@/lib/demo/types';

function loadWallet(): DemoWalletState {
  if (typeof window === 'undefined') return defaultWalletState();
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return defaultWalletState();
    const parsed = { ...defaultWalletState(), ...JSON.parse(raw) } as DemoWalletState;
    return {
      ...parsed,
      positions: parsed.positions.map((p) => ({
        ...p,
        side: p.side === 'no' ? 'no' : 'yes',
      })),
    };
  } catch {
    return defaultWalletState();
  }
}

function saveWallet(state: DemoWalletState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useDemoWallet() {
  const [wallet, setWallet] = useState<DemoWalletState>(() =>
    typeof window !== 'undefined' ? loadWallet() : defaultWalletState(),
  );
  const [hydrated, setHydrated] = useState(() => typeof window !== 'undefined');

  useEffect(() => {
    if (!hydrated) {
      setWallet(loadWallet());
      setHydrated(true);
    }
  }, [hydrated]);

  useEffect(() => {
    if (hydrated) saveWallet(wallet);
  }, [wallet, hydrated]);

  const resetWallet = useCallback(() => {
    setWallet(defaultWalletState());
  }, []);

  const buySide = useCallback((market: DemoMarket, side: 'yes' | 'no', amount: number) => {
    const price = marketPriceForSide(market, side);
    if (amount <= 0 || price <= 0) return { ok: false as const, error: 'invalid_amount' };
    setWallet((w) => {
      if (amount > w.balance) return w;
      const shares = amount / price;
      const pos: DemoMarketPosition = {
        id: newId(),
        marketId: market.id,
        side,
        shares,
        avgPrice: price,
        createdAt: Date.now(),
      };
      return {
        ...w,
        balance: w.balance - amount,
        positions: [...w.positions.filter((p) => !p.settled), pos],
        lastSettledAt: null,
        settlementLabel: null,
      };
    });
    return { ok: true as const };
  }, []);

  const buyYes = useCallback(
    (market: DemoMarket, amount: number) => buySide(market, 'yes', amount),
    [buySide],
  );

  const buyNo = useCallback(
    (market: DemoMarket, amount: number) => buySide(market, 'no', amount),
    [buySide],
  );

  const sellPosition = useCallback((positionId: string, market: DemoMarket) => {
    setWallet((w) => {
      const pos = w.positions.find((p) => p.id === positionId && !p.settled);
      if (!pos) return w;
      const currentPrice = marketPriceForSide(market, pos.side);
      const proceeds = pos.shares * currentPrice;
      return {
        ...w,
        balance: w.balance + proceeds,
        positions: w.positions.filter((p) => p.id !== positionId),
      };
    });
  }, []);

  const buyTicket = useCallback((listing: DemoTicketListing, qty = 1) => {
    const cost = listing.askPrice * qty;
    setWallet((w) => {
      if (cost > w.balance || listing.available < qty) return w;
      const holding = {
        id: newId(),
        listingId: listing.id,
        quantity: qty,
        avgPrice: listing.askPrice,
        purchasedAt: Date.now(),
      };
      return { ...w, balance: w.balance - cost, tickets: [...w.tickets, holding] };
    });
    return cost;
  }, []);

  const sellTicket = useCallback((holdingId: string, fairPrice: number) => {
    setWallet((w) => {
      const h = w.tickets.find((t) => t.id === holdingId);
      if (!h) return w;
      const proceeds = Math.round(fairPrice * 0.95 * h.quantity);
      return {
        ...w,
        balance: w.balance + proceeds,
        tickets: w.tickets.filter((t) => t.id !== holdingId),
      };
    });
  }, []);

  const settleMarkets = useCallback(
    (result: SerializedResult, sample: SampleSim, locale: 'es' | 'en') => {
      const markets = buildDemoMarkets(result, locale);
      const marketById = new Map(markets.map((m) => [m.id, m]));

      setWallet((w) => {
        let balance = w.balance;
        const positions = w.positions.map((p) => {
          if (p.settled) return p;
          const market = marketById.get(p.marketId);
          if (!market) return p;
          const yesWon = resolveMarketYes(market, sample, result.teams);
          const won = p.side === 'yes' ? yesWon : !yesWon;
          const payout = won ? p.shares * 1 : 0;
          balance += payout;
          return { ...p, settled: true, payout };
        });

        return {
          ...w,
          balance,
          positions,
          lastSettledAt: Date.now(),
          settlementLabel: settlementLabel(sample, result.teams, locale),
        };
      });
    },
    [],
  );

  const clearSettledPositions = useCallback(() => {
    setWallet((w) => ({
      ...w,
      positions: w.positions.filter((p) => !p.settled),
    }));
  }, []);

  const portfolioValue = useCallback(
    (markets: DemoMarket[], listings: DemoTicketListing[]) => {
      const marketById = new Map(markets.map((m) => [m.id, m]));
      const listingById = new Map(listings.map((l) => [l.id, l]));
      let posValue = 0;
      for (const p of wallet.positions) {
        if (p.settled) continue;
        const m = marketById.get(p.marketId);
        if (m) posValue += p.shares * marketPriceForSide(m, p.side);
      }
      let ticketValue = 0;
      for (const h of wallet.tickets) {
        const l = listingById.get(h.listingId);
        if (l) ticketValue += l.fairPrice * h.quantity;
      }
      return { posValue, ticketValue, total: wallet.balance + posValue + ticketValue };
    },
    [wallet],
  );

  return {
    wallet,
    hydrated,
    resetWallet,
    buyYes,
    buyNo,
    sellPosition,
    buyTicket,
    sellTicket,
    settleMarkets,
    clearSettledPositions,
    portfolioValue,
  };
}
