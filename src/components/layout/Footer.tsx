import { useTranslations } from 'next-intl';
import { TELEGRAM_URL, X_URL } from '@/lib/social';
import { cn } from '@/lib/utils';

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
  'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="relative z-10 mt-4 border-t border-border py-6 sm:mt-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <p className="text-xs text-fg-2">{t('credits')}</p>
          <a
            href="#methodology"
            className="inline-block text-xs text-fg-1 underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
          >
            {t('methodology_link')}
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 self-end sm:self-auto">
          <p className="text-xs text-fg-1">
            {t('made_by')}{' '}
            <span className="font-semibold text-gold">Dexorynlabs</span>
          </p>
          <div className="flex items-center gap-1.5">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram @dexoryn777"
              title="@dexoryn777"
              className={cn(socialBtn, 'bg-gold text-bg-0 shadow-glow-gold')}
            >
              <TelegramIcon className="h-4 w-4" />
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X @dexoryn"
              title="@dexoryn"
              className={cn(socialBtn, 'border border-fg-0/15 bg-fg-0 text-bg-0')}
            >
              <XSocialIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
