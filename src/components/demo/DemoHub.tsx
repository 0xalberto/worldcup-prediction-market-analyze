'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowLeft, Loader2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { useSimulation } from '@/hooks/useSimulation';
import { useDemoWallet } from '@/hooks/useDemoWallet';
import { pickSettlementSample } from '@/lib/demo/markets';
import { getCachedListings, getCachedMarkets } from '@/lib/demo/cache';
import { cn, formatNum } from '@/lib/utils';
import { MarketsTab } from './MarketsTab';
import { TicketsTab } from './TicketsTab';
import { PortfolioTab } from './PortfolioTab';

type Tab = 'markets' | 'tickets' | 'portfolio';

const DEMO_SIMS = 10_000;

export function DemoHub() {
  const t = useTranslations('demo');
  const locale = useLocale() as 'es' | 'en';
  const { state, run } = useSimulation();
  const wallet = useDemoWallet();
  const [tab, setTab] = useState<Tab>('markets');

  const result = state.result;
  const markets = useMemo(
    () => (result ? getCachedMarkets(result, locale) : []),
    [result, locale],
  );
  const listings = useMemo(
    () => (result ? getCachedListings(result, locale) : []),
    [result, locale],
  );

  const handleSettle = () => {
    if (!result) return;
    const sample = pickSettlementSample(result);
    if (!sample) return;
    wallet.settleMarkets(result, sample, locale);
  };

  const waitingForSim = !result && state.status === 'running';
  const needsSim = !result && state.status !== 'running';
  const loading = state.status === 'running';
  const progress = state.total > 0 ? state.completed / state.total : 0;

  return (
    <article className="relative mx-auto max-w-[1280px] px-4 pt-28 pb-10 sm:px-6 sm:pt-32 sm:pb-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-fg-3 transition-colors hover:text-fg-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('back')}
      </Link>

      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-amber-200/90">
          <Sparkles className="h-3 w-3" />
          {t('badge')}
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-fg-0 sm:mt-5 sm:text-4xl lg:text-5xl xl:text-6xl">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-fg-1 sm:mt-4 sm:text-lg">{t('subtitle')}</p>
      </header>

      {/* Wallet bar */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-bg-1/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-fg-3">{t('wallet')}</p>
          <p className="font-mono text-2xl font-bold text-gold sm:text-3xl">
            ${wallet.wallet.balance.toFixed(2)}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-fg-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('sim_running')} {Math.round(progress * 100)}%
            </div>
          )}
          {result && (
            <>
              <button
                type="button"
                onClick={() => run(DEMO_SIMS)}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-fg-2 hover:text-fg-0 disabled:opacity-40 sm:w-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('refresh_prices')}
              </button>
              <button
                type="button"
                onClick={handleSettle}
                disabled={wallet.wallet.positions.filter((p) => !p.settled).length === 0}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-40 sm:w-auto"
              >
                {t('settle')}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={wallet.resetWallet}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-fg-2 hover:text-fg-0 sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('reset_wallet')}
          </button>
        </div>
      </div>

      {state.status === 'error' && (
        <p className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {state.error}
        </p>
      )}

      {result && (
        <p className="mb-6 text-xs text-fg-3">
          {t('sim_note', { n: formatNum(result.numSimulations) })}
        </p>
      )}

      {/* Tabs */}
      {result && (
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-bg-1/30 p-1 scrollbar-none sm:overflow-visible">
        {(['markets', 'tickets', 'portfolio'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-1 sm:px-4 sm:py-2.5 sm:text-sm',
              tab === id ? 'bg-gold text-bg-0 shadow-glow-gold' : 'text-fg-2 hover:text-fg-0',
            )}
          >
            {t(`tab_${id}`)}
          </button>
        ))}
      </div>
      )}

      {!result ? (
        waitingForSim ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-bg-1/20">
            <Loader2 className="h-8 w-8 animate-spin text-gold/60" />
            <p className="text-sm text-fg-2">{t('waiting_for_sim')}</p>
          </div>
        ) : needsSim ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-bg-1/20 px-6 text-center">
            <p className="max-w-md text-sm text-fg-2">{t('needs_sim')}</p>
            <Link
              href="/"
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-bg-0 transition-opacity hover:opacity-90"
            >
              {t('go_simulate')}
            </Link>
          </div>
        ) : null
      ) : (
        <>
          {tab === 'markets' && <MarketsTab markets={markets} result={result} wallet={wallet} />}
          {tab === 'tickets' && <TicketsTab listings={listings} result={result} wallet={wallet} />}
          {tab === 'portfolio' && (
            <PortfolioTab markets={markets} listings={listings} result={result} wallet={wallet} />
          )}
        </>
      )}

      <p className="mt-12 text-center text-xs text-fg-3">{t('disclaimer')}</p>
    </article>
  );
}
