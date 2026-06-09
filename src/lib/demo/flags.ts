import type { DemoMarket, DemoTicketListing } from './types';
import type { SerializedResult } from '@/lib/sim/worker';

export function teamFlagCode(result: SerializedResult, teamId: string): string | null {
  return result.teams.find((t) => t.id === teamId)?.flag ?? null;
}

export function marketTeamIds(market: DemoMarket): string[] {
  if (market.type === 'h2h') {
    return [market.homeTeamId, market.awayTeamId].filter((id): id is string => Boolean(id));
  }
  if (market.teamId) return [market.teamId];
  return [];
}

export function listingTeamIds(listing: DemoTicketListing): string[] {
  return listing.teamIds;
}
