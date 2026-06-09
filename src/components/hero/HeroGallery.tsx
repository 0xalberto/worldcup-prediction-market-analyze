'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { gsap } from 'gsap';
import { entrancePlayed, markEntrancePlayed } from '@/lib/entranceAnimation';
import { cn } from '@/lib/utils';

const FLOATS = [
  {
    src: '/worldcup_argentina.jpg',
    titleKey: 'wc2022',
    altKey: 'alt_wc2022',
    tag: '02',
    objectPosition: 'object-center',
    cell: 'col-span-3',
    height: 'h-[178px] sm:h-[211px]',
    tilt: 'sm:-rotate-2',
  },
  {
    src: '/worldcup-player.webp',
    titleKey: 'stars',
    altKey: 'alt_stars',
    tag: '04',
    objectPosition: 'object-[center_15%]',
    cell: 'col-span-6 z-20 -translate-y-2 sm:-translate-y-4 lg:-translate-y-7',
    height: 'h-[211px] sm:h-[254px]',
    tilt: '',
    featured: true,
  },
  {
    src: '/ronaldo_messi.jpg',
    titleKey: 'legends',
    altKey: 'alt_legends',
    tag: '03',
    objectPosition: 'object-[center_35%]',
    cell: 'col-span-3',
    height: 'h-[178px] sm:h-[211px]',
    tilt: 'sm:rotate-2',
  },
] as const;

function FloatCard({
  src,
  alt,
  title,
  tag,
  objectPosition,
  cell,
  height,
  tilt,
  featured,
}: {
  src: string;
  alt: string;
  title: string;
  tag: string;
  objectPosition: string;
  cell: string;
  height: string;
  tilt: string;
  featured?: boolean;
}) {
  return (
    <figure
      className={cn(
        'gallery-float group relative w-full overflow-hidden rounded-xl sm:rounded-2xl',
        cell,
        height,
        tilt,
        'bg-bg-2 shadow-[0_24px_48px_-14px_rgba(0,0,0,0.7)]',
        'ring-1 ring-white/10 transition-all duration-700',
        'hover:z-30 hover:scale-[1.03] hover:ring-gold/45 hover:shadow-glow-gold',
        featured && 'ring-gold/25 shadow-glow-gold',
      )}
    >
      <div
        className="absolute inset-0 rounded-xl p-px sm:rounded-2xl"
        style={{
          background: featured
            ? 'linear-gradient(145deg, oklch(0.90 0.10 180 / 0.9), oklch(0.76 0.13 180 / 0.45) 50%, oklch(0.60 0.10 180 / 0.35))'
            : 'linear-gradient(145deg, oklch(0.88 0.11 180 / 0.7), oklch(0.60 0.10 180 / 0.15) 50%, oklch(0.76 0.13 180 / 0.4))',
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[0.7rem] bg-bg-1 sm:rounded-[0.85rem]">
          <Image
            src={src}
            alt={alt}
            fill
            quality={95}
            sizes={featured ? '(max-width: 1024px) 50vw, 480px' : '(max-width: 1024px) 22vw, 240px'}
            className={cn(
              'object-cover transition-transform duration-700 group-hover:scale-[1.03]',
              objectPosition,
            )}
          />
          <div className="absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-t from-bg-0/95 via-bg-0/45 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5">
            <span
              className={cn(
                'font-display font-medium text-fg-0',
                featured ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]',
              )}
            >
              {title}
            </span>
            <span className="font-mono text-[8px] tracking-[0.16em] text-gold/85 sm:text-[9px]">{tag}</span>
          </figcaption>
        </div>
      </div>
    </figure>
  );
}

export function HeroGallery() {
  const locale = useLocale();
  const t = useTranslations('gallery');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const hero = rootRef.current.querySelector('.gallery-hero');
    const floats = rootRef.current.querySelectorAll('.gallery-float');
    if (!hero) return;

    const key = `gallery-${locale}`;

    if (entrancePlayed(key)) {
      gsap.set(hero, { opacity: 1, y: 0 });
      gsap.set(floats, { opacity: 1, y: 0 });
      return;
    }

    markEntrancePlayed(key);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        hero,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 1, ease: 'expo.out', delay: 0.1 },
      );
      if (floats.length) {
        gsap.fromTo(
          floats,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.9,
            ease: 'back.out(1.2)',
            delay: 0.3,
          },
        );
      }
    }, rootRef);
    return () => ctx.revert();
  }, [locale]);

  return (
    <div ref={rootRef} className="relative w-full overflow-hidden">
      <div
        className="pointer-events-none absolute -inset-4 rounded-full opacity-55 blur-3xl sm:-inset-8"
        style={{
          background:
            'radial-gradient(circle at 50% 20%, oklch(0.76 0.13 180 / 0.24), transparent 65%)',
        }}
        aria-hidden
      />

      <div className="grid grid-cols-12 gap-3 sm:gap-4">
        {/* trophy - full width, large */}
        <figure
          className={cn(
            'gallery-hero relative col-span-12 overflow-hidden rounded-2xl',
            'shadow-[0_36px_72px_-18px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]',
          )}
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[16/8]">
            <Image
              src="/worldcup1.jpg"
              alt={t('alt_trophy')}
              fill
              priority
              quality={95}
              sizes="(max-width: 1024px) 100vw, (max-width: 1440px) 48vw, 900px"
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-0/88" />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-5 pt-20 sm:px-6 sm:pb-6">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-gold/90 sm:text-[10px]">
                  {t('trophy_eyebrow')}
                </p>
                <p className="mt-1 font-display text-xl font-light tracking-wide text-fg-0 sm:text-2xl lg:text-3xl">
                  {t('trophy')}
                </p>
              </div>
              <span className="font-display text-4xl font-thin leading-none text-fg-0/12 sm:text-5xl lg:text-6xl">
                01
              </span>
            </figcaption>
          </div>
        </figure>

        {/* companion row - 3 + 6 + 3 grid, fixed heights, aligned */}
        {FLOATS.map((photo) => (
          <FloatCard
            key={photo.src}
            src={photo.src}
            alt={t(photo.altKey)}
            title={t(photo.titleKey)}
            tag={photo.tag}
            objectPosition={photo.objectPosition}
            cell={cn(photo.cell, 'col-start-auto -mt-6 sm:-mt-11 lg:-mt-[3.3rem]')}
            height={photo.height}
            tilt={photo.tilt}
            featured={'featured' in photo && photo.featured}
          />
        ))}
      </div>

      <div
        className="mx-auto mt-2 h-px max-w-[75%] bg-gradient-to-r from-transparent via-gold/25 to-transparent"
        aria-hidden
      />
      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.26em] text-fg-3 sm:text-[10px]">
        {t('tagline')}
      </p>
    </div>
  );
}
