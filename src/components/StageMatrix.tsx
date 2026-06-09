'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Flag } from './Flag';
import { cn, formatPct, wilsonCI, formatCIBand } from '@/lib/utils';
import { useSelection } from '@/hooks/useSelection';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

const SOUTHAM_IDS = new Set(['ARG','BRA','URU','COL','ECU','PAR']);
const EUROPE_IDS = new Set(['ESP','FRA','POR','ENG','NED','BEL','GER','CRO','SUI','CZE','BIH','AUT','TUR','NOR','SWE','SCO']);

function colorFor(pct: number) {
  // emerald high → bg-2 low
  if (pct <= 0) return 'oklch(0.18 0.025 260 / 0)';
  const t = Math.min(1, Math.sqrt(pct)); // sqrt for better visual at low %
  // interpolate L from 0.20→0.72, chroma 0.04→0.17, hue ~155
  const L = 0.20 + t * 0.50;
  const C = 0.04 + t * 0.14;
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} 155)`;
}

const STAGE_COLS = [
  { key: 'r32',   label: 'r32' },
  { key: 'r16',   label: 'r16' },
  { key: 'qf',    label: 'qf' },
  { key: 'sf',    label: 'sf' },
  { key: 'final', label: 'final' },
  { key: 'champ', label: 'champ' },
] as const;

type FilterKey = 'all' | 'top16' | 'southam' | 'europe' | 'hosts' | 'underdogs';

export function StageMatrix({ result }: Props) {
  const t = useTranslations('stages');
  const locale = useLocale();
  const openTeam = useSelection((s) => s.openTeam);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  const rows = useMemo(() => {
    const N = result.numSimulations;
    const all = result.teams.map((team, i) => ({
      team,
      idx: i,
      values: {
        r32:   result.stageCounts.r32[i] / N,
        r16:   result.stageCounts.r16[i] / N,
        qf:    result.stageCounts.qf[i] / N,
        sf:    result.stageCounts.sf[i] / N,
        final: result.stageCounts.final[i] / N,
        champ: result.stageCounts.champion[i] / N,
      },
      counts: {
        r32:   result.stageCounts.r32[i],
        r16:   result.stageCounts.r16[i],
        qf:    result.stageCounts.qf[i],
        sf:    result.stageCounts.sf[i],
        final: result.stageCounts.final[i],
        champ: result.stageCounts.champion[i],
      },
      elo: team.elo,
    }));
    let filtered = all;
    if (filter === 'top16') {
      filtered = [...all].sort((a, b) => b.elo - a.elo).slice(0, 16);
    } else if (filter === 'southam') {
      filtered = all.filter((r) => SOUTHAM_IDS.has(r.team.id));
    } else if (filter === 'europe') {
      filtered = all.filter((r) => EUROPE_IDS.has(r.team.id));
    } else if (filter === 'hosts') {
      filtered = all.filter((r) => r.team.is_host);
    } else if (filter === 'underdogs') {
      filtered = [...all].sort((a, b) => a.elo - b.elo).slice(0, 16);
    }
    return filtered.sort((a, b) => b.values.champ - a.values.champ);
  }, [result, filter]);

  const filters: { k: FilterKey; label: string }[] = [
    { k: 'all',       label: t('filter_all') },
    { k: 'top16',     label: t('filter_top16') },
    { k: 'southam',   label: t('filter_southam') },
    { k: 'europe',    label: t('filter_europe') },
    { k: 'hosts',     label: t('filter_hosts') },
    { k: 'underdogs', label: t('filter_underdogs') },
  ];

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">
            {t('title')}
          </h2>
          <p className="mt-2 text-sm text-fg-2">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                filter === f.k
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-border bg-bg-1/30 text-fg-2 hover:text-fg-1',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border glass">
        <table className="min-w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
              <th className="sticky left-0 z-10 bg-bg-1/80 backdrop-blur px-4 py-3 text-left">Team</th>
              {STAGE_COLS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-center transition-colors',
                    hoverCol === col.key && 'text-gold',
                  )}
                  onMouseEnter={() => setHoverCol(col.key)}
                  onMouseLeave={() => setHoverCol(null)}
                >
                  {t(col.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.team.id}
                className={cn(
                  'cursor-pointer border-t border-border/50 transition-colors',
                  hoverRow === row.idx && 'bg-bg-2/40',
                )}
                onClick={() => openTeam(row.team.id)}
                onMouseEnter={() => setHoverRow(row.idx)}
                onMouseLeave={() => setHoverRow(null)}
              >
                <td className="sticky left-0 z-10 bg-bg-1/80 backdrop-blur px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Flag code={row.team.flag} size={20} />
                    <span className="text-sm text-fg-0">{locale === 'es' ? row.team.name_es : row.team.name_en}</span>
                  </div>
                </td>
                {STAGE_COLS.map((col) => {
                  const v = row.values[col.key];
                  const dim = hoverCol !== null && hoverCol !== col.key && hoverRow !== row.idx;
                  const ci = wilsonCI(row.counts[col.key], result.numSimulations);
                  const tip = v > 0
                    ? `${formatPct(v, 2)} (IC 95% ${formatCIBand(ci.lo, ci.hi, 2)}, n=${result.numSimulations.toLocaleString()})`
                    : undefined;
                  return (
                    <td
                      key={col.key}
                      className="relative px-3 py-2 text-center font-mono text-xs tabular transition-opacity"
                      style={{
                        backgroundColor: colorFor(v),
                        opacity: dim ? 0.35 : 1,
                      }}
                      title={tip}
                      onMouseEnter={() => setHoverCol(col.key)}
                      onMouseLeave={() => setHoverCol(null)}
                    >
                      <span className={cn(v > 0.05 ? 'text-fg-0' : 'text-fg-2')}>
                        {v > 0.0005 ? formatPct(v, 1) : '-'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
