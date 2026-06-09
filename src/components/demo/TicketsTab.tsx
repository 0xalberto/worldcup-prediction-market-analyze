'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { DemoTicketListing } from '@/lib/demo/types';
import type { SerializedResult } from '@/lib/sim/worker';
import type { useDemoWallet } from '@/hooks/useDemoWallet';
import { listingTeamIds } from '@/lib/demo/flags';
import { DemoTeamFlags } from './DemoTeamFlags';

type Wallet = ReturnType<typeof useDemoWallet>;

interface Props {
  listings: DemoTicketListing[];
  result: SerializedResult;
  wallet: Wallet;
}

export function TicketsTab({ listings, result, wallet }: Props) {
  const t = useTranslations('demo');

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-2">{t('tickets_lead')}</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {listings.map((listing) => {
          const owned = wallet.wallet.tickets.filter((h) => h.listingId === listing.id);
          const canBuy = wallet.wallet.balance >= listing.askPrice && listing.available > 0;

          return (
            <article
              key={listing.id}
              className="rounded-2xl border border-border bg-bg-1/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <DemoTeamFlags
                    result={result}
                    teamIds={listingTeamIds(listing)}
                    size={30}
                    layout={listing.teamIds.length >= 2 ? 'versus' : 'stack'}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-fg-3">
                      {listing.category} · {listing.stage.toUpperCase()}
                    </p>
                    <h3 className="mt-1 text-sm font-medium text-fg-0">{listing.matchLabel}</h3>
                    <p className="mt-1 text-xs text-fg-3">{listing.venue}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-center text-xs min-[420px]:grid-cols-3">
                <div className="rounded-lg bg-bg-0/50 py-2">
                  <p className="text-fg-3">{t('face_value')}</p>
                  <p className="font-mono font-medium text-fg-1">${listing.faceValue}</p>
                </div>
                <div className="rounded-lg bg-bg-0/50 py-2">
                  <p className="text-fg-3">{t('fair_price')}</p>
                  <p className="font-mono font-medium text-emerald-400/90">${listing.fairPrice}</p>
                </div>
                <div className="rounded-lg bg-bg-0/50 py-2">
                  <p className="text-fg-3">{t('ask_price')}</p>
                  <p className="font-mono font-medium text-gold">${listing.askPrice}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-fg-3">
                  {listing.available} {t('available')}
                </span>
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => wallet.buyTicket(listing)}
                  className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-medium text-bg-0 disabled:opacity-40 sm:w-auto"
                >
                  {t('buy_ticket')}
                </button>
              </div>

              {owned.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
                  {owned.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-fg-2">
                        {t('owned')} · ${h.avgPrice}
                      </span>
                      <button
                        type="button"
                        onClick={() => wallet.sellTicket(h.id, listing.fairPrice)}
                        className="rounded-md border border-border px-2 py-1 text-fg-2 hover:text-fg-0"
                      >
                        {t('sell_back')} (~${Math.round(listing.fairPrice * 0.95)})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
