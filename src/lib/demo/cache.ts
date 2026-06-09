import type { SerializedResult } from '@/lib/sim/worker';
import type { DemoMarket, DemoTicketListing } from './types';
import { buildDemoMarkets } from './markets';
import { buildTicketListings } from './tickets';

type Locale = 'es' | 'en';

interface DemoCache {
  result: SerializedResult;
  markets: Record<Locale, DemoMarket[]>;
  listings: Record<Locale, DemoTicketListing[]>;
}

let cache: DemoCache | null = null;

export function warmDemoCache(result: SerializedResult) {
  if (cache?.result === result) return;
  cache = {
    result,
    markets: {
      en: buildDemoMarkets(result, 'en'),
      es: buildDemoMarkets(result, 'es'),
    },
    listings: {
      en: buildTicketListings(result, 'en'),
      es: buildTicketListings(result, 'es'),
    },
  };
}

export function getCachedMarkets(result: SerializedResult, locale: Locale): DemoMarket[] {
  if (cache?.result !== result) warmDemoCache(result);
  return cache!.markets[locale];
}

export function getCachedListings(result: SerializedResult, locale: Locale): DemoTicketListing[] {
  if (cache?.result !== result) warmDemoCache(result);
  return cache!.listings[locale];
}

export function scheduleDemoWarm(result: SerializedResult) {
  if (typeof window === 'undefined') return;
  const run = () => warmDemoCache(result);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}

export function preloadDemoRoute() {
  if (typeof window === 'undefined') return;
  void import('@/components/demo/DemoHub');
}
