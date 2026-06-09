'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { gsap } from 'gsap';
import { entrancePlayed, markEntrancePlayed } from '@/lib/entranceAnimation';
import { SimulationControls } from './SimulationControls';
import { MeshGradient } from './hero/MeshGradient';
import { HeroGallery } from './hero/HeroGallery';
import { HeroDemoPromo } from './hero/HeroDemoPromo';
import { KickoffCountdown } from './hero/KickoffCountdown';
import type { SimState } from '@/hooks/useSimulation';

interface HeroProps {
  state: SimState;
  onRun: (n: number) => void;
}

export function Hero({ state, onRun }: HeroProps) {
  const t = useTranslations('hero');
  const locale = useLocale();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!titleRef.current) return;
    const words = titleRef.current.querySelectorAll('[data-word]');
    const key = `hero-${locale}`;

    if (entrancePlayed(key)) {
      gsap.set(words, { opacity: 1, y: 0, filter: 'blur(0px)' });
      return;
    }

    markEntrancePlayed(key);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0, y: 24, filter: 'blur(12px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          stagger: 0.06,
          duration: 0.8,
          ease: 'expo.out',
          delay: 0.1,
        },
      );
    }, titleRef);
    return () => ctx.revert();
  }, [locale]);

  return (
    <section className="relative overflow-hidden pt-24 pb-4 sm:pt-28 md:pt-32 sm:pb-6">
      <MeshGradient />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-start gap-8 px-4 sm:gap-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10 xl:max-w-[1440px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)] xl:gap-12">
        <div className="min-w-0">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-gold/90 sm:px-3 sm:text-[10px] sm:tracking-[0.18em]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            {t('eyebrow')}
          </div>

          <h1
            ref={titleRef}
            className="mt-4 font-display text-[clamp(1.625rem,5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.02em] text-fg-0 sm:mt-5 sm:leading-[1.08]"
          >
            <span className="block">
              {t('title_part1').split(' ').map((w, i) => (
                <span key={i} data-word className="inline-block mr-[0.2em]">{w}</span>
              ))}
            </span>
            <span className="block">
              {t('title_part2').split(' ').map((w, i) => (
                <span
                  key={i}
                  data-word
                  className="inline-block mr-[0.2em] bg-gradient-to-r from-gold via-gold-hi to-gold bg-clip-text text-transparent"
                >
                  {w}
                </span>
              ))}
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-1 sm:text-lg">{t('subtitle')}</p>

          <HeroDemoPromo />

          <p className="mt-4 max-w-xl text-sm text-fg-2">
            {t('contact_hint')}{' '}
            <span className="font-medium text-gold">{t('contact_brand')}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-fg-2 sm:mt-3 sm:gap-x-3 sm:text-xs">
            <span><span data-num className="text-fg-0">104</span> {t('stat_matches')}</span>
            <span className="text-fg-3">·</span>
            <span><span data-num className="text-fg-0">48</span> {t('stat_teams')}</span>
            <span className="text-fg-3">·</span>
            <span><span data-num className="text-fg-0">1.4×10⁴⁸</span> {t('stat_scenarios')}</span>
          </div>

          <div id="simulate" className="mt-8">
            <SimulationControls state={state} onRun={onRun} />
          </div>
        </div>

        <div className="relative flex w-full min-w-0 flex-col">
          <KickoffCountdown className="mb-2 sm:mb-4 lg:mb-4" />
          <HeroGallery />
        </div>
      </div>
    </section>
  );
}
