'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { TELEGRAM_URL, X_URL } from '@/lib/social';

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

function XSocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const socialBtn =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all hover:scale-105 active:scale-95';

interface Props {
  variant?: 'bar' | 'menu';
  className?: string;
}

export function HeaderProfile({ variant = 'bar', className }: Props) {
  const t = useTranslations('header');

  if (variant === 'menu') {
    return (
      <div
        className={cn(
          'rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/25 via-gold/12 to-bg-1/40 p-4 shadow-glow-gold',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/Dexoryn.png"
            alt="Dexoryn"
            width={72}
            height={72}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-gold shadow-[0_0_20px_-4px_oklch(0.76_0.13_180/0.8)]"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-fg-0">Dexoryn</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
              {t('dev_label')}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-fg-1">{t('dev_hint')}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              socialBtn,
              'gap-2 bg-gold px-3 py-2.5 text-sm text-bg-0 shadow-glow-gold',
            )}
          >
            <TelegramIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('dev_telegram')}</span>
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              socialBtn,
              'gap-2 border border-fg-0/20 bg-fg-0 px-3 py-2.5 text-sm text-bg-0',
            )}
          >
            <XSocialIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('dev_x')}</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative hidden shrink-0 items-center gap-2 rounded-2xl border border-gold/55 sm:flex',
        'bg-gradient-to-r from-gold/22 via-gold/14 to-gold/6 px-2 py-1.5',
        'shadow-glow-gold transition-all duration-200',
        'hover:border-gold hover:from-gold/30 hover:via-gold/18 hover:to-gold/8',
        'hover:shadow-[0_0_36px_-6px_oklch(0.76_0.13_180/0.75)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 0% 50%, oklch(0.88 0.11 180 / 0.18), transparent 70%)',
        }}
      />

      <Image
        src="/Dexoryn.png"
        alt="Dexoryn"
        width={72}
        height={72}
        className="relative h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-gold/90 ring-offset-1 ring-offset-bg-0"
      />

      <div className="relative hidden min-w-0 pr-0.5 min-[860px]:block">
        <p className="font-display text-sm font-bold leading-none text-fg-0">Dexoryn</p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
          {t('dev_label')}
        </p>
      </div>

      <div className="relative flex items-center gap-1 pl-0.5">
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram @dexoryn777"
          title="@dexoryn777"
          className={cn(socialBtn, 'h-8 w-8 bg-gold text-bg-0 shadow-[0_4px_14px_-4px_oklch(0.76_0.13_180/0.9)]')}
        >
          <TelegramIcon className="h-4 w-4" />
        </a>
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X @dexoryn"
          title="@dexoryn"
          className={cn(
            socialBtn,
            'h-8 w-8 border border-fg-0/15 bg-fg-0 text-bg-0 shadow-[0_4px_14px_-4px_oklch(0_0_0/0.45)]',
          )}
        >
          <XSocialIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
