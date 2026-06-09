import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { ArrowLeft, Github, ExternalLink } from 'lucide-react';

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('methodology');

  return (
    <article className="relative mx-auto max-w-3xl px-6 pt-32 pb-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-fg-3 transition-colors hover:text-fg-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('back')}
      </Link>

      <h1 className="font-display text-5xl font-bold tracking-tight text-fg-0 sm:text-6xl">
        {t('title')}
      </h1>
      <p className="mt-4 text-lg text-fg-1">{t('lead')}</p>

      <Section title={t('elo_title')}>
        <p>{t('elo_body')}</p>
        <p className="mt-4 text-sm text-fg-2">{t('elo_formula_caption')}</p>
        <Formula>{`We = 1 / (10^(-dr / 400) + 1)`}</Formula>
        <p className="mt-2 text-sm text-fg-2">{t('elo_explain')}</p>
      </Section>

      <Section title={t('poisson_title')}>
        <p>{t('poisson_body')}</p>
        <Formula>{`λ_team = clamp(1.30 + 0.18 × (ELO_team − ELO_opp + home_bonus) / 100, 0.15, 6.0)
goals  ~ Poisson(λ_team)`}</Formula>
        <p className="text-sm text-fg-2">{t('poisson_explain')}</p>
      </Section>

      <Section title={t('recent_title')}>
        <p>{t('recent_body')}</p>
        <Formula>{t('recent_formula')}</Formula>
      </Section>

      <Section title={t('host_title')}>
        <p>{t('host_body')}</p>
      </Section>

      <Section title={t('absences_title')}>
        <p>{t('absences_body')}</p>
        <Formula>{t('absences_formula')}</Formula>
        <p className="text-sm text-fg-2">{t('absences_explain')}</p>
      </Section>

      <Section title={t('rest_title')}>
        <p>{t('rest_body')}</p>
      </Section>

      <Section title={t('groups_title')}>
        <p>{t('groups_body')}</p>
      </Section>

      <Section title={t('knockout_title')}>
        <p>{t('knockout_body')}</p>
        <Formula>{t('knockout_formula')}</Formula>
        <p className="text-sm text-fg-2">{t('knockout_explain')}</p>
        <p className="mt-3 text-sm text-fg-2">{t('knockout_note')}</p>
      </Section>

      <Section title={t('mc_title')}>
        <p>{t('mc_body')}</p>
      </Section>

      <Section title={t('ci_title')}>
        <p>{t('ci_body')}</p>
        <Formula>{t('ci_formula')}</Formula>
      </Section>

      <Section title={t('perf_title')}>
        <p>{t('perf_body')}</p>
      </Section>

      <Section title={t('verify_title')}>
        <ul className="space-y-2 text-fg-1">
          <Bullet>{t('verify_item_1')}</Bullet>
          <Bullet>{t('verify_item_2')}</Bullet>
          <Bullet>{t('verify_item_3')}</Bullet>
        </ul>
      </Section>

      <Section title={t('limits_title')}>
        <p>{t('limits_body')}</p>
      </Section>

      <Section title={t('sources_title')}>
        <ul className="space-y-2">
          <SourceLink href="https://www.eloratings.net/">{t('src_elo')}</SourceLink>
          <SourceLink href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/final-draw-results">
            {t('src_draw')}
          </SourceLink>
          <SourceLink href="https://lukebenz.com/post/wc_model_methodology/blogpost/">
            {t('src_paper_benz')}
          </SourceLink>
          <SourceLink href="https://en.wikipedia.org/wiki/World_Football_Elo_Ratings">
            {t('src_wiki_elo')}
          </SourceLink>
          <SourceLink href="https://github.com/HatScripts/circle-flags">{t('src_flags')}</SourceLink>
        </ul>
      </Section>

      <Section title={t('code_title')}>
        <p>{t('code_body')}</p>
        <a
          href="https://github.com/kmanus88/worldcup2026"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-bg-1/40 px-4 py-2 text-sm text-fg-1 transition-colors hover:border-border-strong hover:text-fg-0"
        >
          <Github className="h-4 w-4" />
          kmanus88/worldcup2026
        </a>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-fg-0">{title}</h2>
      <div className="mt-4 space-y-1 text-fg-1 leading-relaxed">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-bg-1/60 px-4 py-3 font-mono text-sm leading-relaxed text-gold/95 tabular">
      {children}
    </pre>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-fg-1">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
      <span>{children}</span>
    </li>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center gap-1.5 text-sm text-fg-1 underline decoration-gold/30 underline-offset-4 transition-colors hover:text-fg-0 hover:decoration-gold"
      >
        {children}
        <ExternalLink className="h-3 w-3 text-fg-3 transition-colors group-hover:text-gold" />
      </a>
    </li>
  );
}
