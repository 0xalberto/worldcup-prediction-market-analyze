'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { ArrowUpRight, BarChart3, Ticket, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAGS = [
  { key: 'demo_tag_markets' as const, icon: BarChart3 },
  { key: 'demo_tag_tickets' as const, icon: Ticket },
  { key: 'demo_tag_wallet' as const, icon: Wallet },
] as const;

export function HeroDemoPromo() {
  const t = useTranslations('hero');
  const router = useRouter();

  useEffect(() => {
    router.prefetch('/demo');
  }, [router]);

  return (
    <Link
      href="/demo"
      prefetch
      onMouseEnter={() => {
        router.prefetch('/demo');
        void import('@/components/demo/DemoHub');
      }}
      className={cn(
        'group relative mt-5 block max-w-xl overflow-hidden rounded-2xl border border-gold/25',
        'bg-gradient-to-br from-gold/10 via-bg-1/50 to-bg-1/30 p-4 sm:p-5',
        'shadow-[0_0_40px_-12px_oklch(0.76_0.13_180/0.35)]',
        'transition-all duration-300 hover:border-gold/45 hover:shadow-glow-gold',
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-60"
        style={{ background: 'radial-gradient(circle, oklch(0.76 0.13 180 / 0.5), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-gold sm:text-[10px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            {t('demo_badge')}
          </span>

          <p className="mt-3 font-display text-lg font-semibold leading-snug text-fg-0 sm:text-xl">
            {t('demo_title')}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{t('demo_desc')}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {TAGS.map(({ key, icon: Icon }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-bg-0/40 px-2.5 py-1 text-[10px] text-fg-1 sm:text-[11px]"
              >
                <Icon className="h-3 w-3 shrink-0 text-gold/90" aria-hidden />
                {t(key)}
              </span>
            ))}
          </div>
        </div>

        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30',
            'bg-gold/15 text-gold transition-all duration-300',
            'group-hover:scale-105 group-hover:border-gold/50 group-hover:bg-gold group-hover:text-bg-0',
          )}
          aria-hidden
        >
          <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>

      <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors group-hover:text-gold-hi">
        {t('demo_cta')}
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
