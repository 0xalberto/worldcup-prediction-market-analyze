'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Flag } from './Flag';
import { cn, formatPct } from '@/lib/utils';
import { computeEdge, computeEV, type MarketOdds, type MarketOddsFile } from '@/lib/sim/market';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

type Book = 'polymarket' | 'kalshi';

interface PivotRow {
  team_id: string;
  our_prob: number;
  byBook: Partial<Record<Book, {
    decimal_odds: number;
    implied_prob: number;
    fair_prob: number;
    edge: number;
    ev: number;
  }>>;
  bestEdge: number;
  bestBook: Book | null;
}

export function MarketEdge({ result }: Props) {
  const locale = useLocale();
  const teamById = useMemo(() => new Map(result.teams.map((t) => [t.id, t])), [result]);

  const [file, setFile] = useState<MarketOddsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/odds')
      .then((r) => r.json())
      .then((d: MarketOddsFile) => { if (!cancelled) setFile(d); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo<PivotRow[]>(() => {
    if (!file?.odds?.length) return [];
    const ourProb = (teamId: string): number | undefined => {
      const idx = result.teams.findIndex((t) => t.id === teamId);
      if (idx < 0) return undefined;
      return result.stageCounts.champion[idx] / result.numSimulations;
    };

    const byTeam = new Map<string, PivotRow>();
    for (const o of file.odds as MarketOdds[]) {
      if (o.market !== 'winner' || !o.team_id) continue;
      const book = o.book as Book;
      if (book !== 'polymarket' && book !== 'kalshi') continue;
      const our = ourProb(o.team_id);
      if (our === undefined) continue;

      let row = byTeam.get(o.team_id);
      if (!row) {
        row = { team_id: o.team_id, our_prob: our, byBook: {}, bestEdge: -Infinity, bestBook: null };
        byTeam.set(o.team_id, row);
      }
      const edge = computeEdge(our, o.fair_prob);
      const ev = computeEV(our, o.decimal_odds);
      row.byBook[book] = {
        decimal_odds: o.decimal_odds,
        implied_prob: o.implied_prob,
        fair_prob: o.fair_prob,
        edge,
        ev,
      };
      if (edge > row.bestEdge) {
        row.bestEdge = edge;
        row.bestBook = book;
      }
    }
    return [...byTeam.values()].sort((a, b) => b.bestEdge - a.bestEdge);
  }, [file, result]);

  const sources = file?._meta.sources || [];

  return (
    <section id="mercado" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 pt-12 pb-8 sm:px-6 sm:pt-20 sm:pb-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">
            Edge vs mercado
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-2">
            Comparamos nuestra probabilidad MC con la implícita devigueada de{' '}
            <span className="text-fg-1">Polymarket</span> y <span className="text-fg-1">Kalshi</span>.
            Una fila por equipo. Edge positivo = el modelo cree que la apuesta es value.
            <strong className="text-rose"> No es asesoría financiera.</strong>
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
          {loading ? 'cargando…' : sources.length ? sources.join(' · ') : 'sin fuentes activas'}
        </div>
      </header>

      {loading ? (
        <SkeletonTable />
      ) : err || rows.length === 0 ? (
        <EmptyState message={err || 'No hay odds disponibles. Probá refrescar - el cache es de 5 min.'} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border glass">
          <table className="min-w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
                <th className="px-4 py-3 text-left">Equipo</th>
                <th className="px-3 py-3 text-right">Nuestra</th>
                <th className="px-3 py-3 text-right border-l border-border/40" colSpan={3}>
                  <span className="text-violet">Polymarket</span>
                </th>
                <th className="px-3 py-3 text-right border-l border-border/40" colSpan={3}>
                  <span className="text-emerald">Kalshi</span>
                </th>
                <th className="px-3 py-3 text-right border-l border-border/40">Mejor</th>
              </tr>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-fg-3 font-mono">
                <th className="px-4 py-1.5 text-left" />
                <th className="px-3 py-1.5 text-right" />
                <th className="px-3 py-1.5 text-right border-l border-border/40">prob</th>
                <th className="px-3 py-1.5 text-right">edge</th>
                <th className="px-3 py-1.5 text-right">EV/u</th>
                <th className="px-3 py-1.5 text-right border-l border-border/40">prob</th>
                <th className="px-3 py-1.5 text-right">edge</th>
                <th className="px-3 py-1.5 text-right">EV/u</th>
                <th className="px-3 py-1.5 text-right border-l border-border/40" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const team = teamById.get(r.team_id);
                if (!team) return null;
                const poly = r.byBook.polymarket;
                const kal = r.byBook.kalshi;
                return (
                  <tr key={r.team_id} className={cn(
                    'border-t border-border/40',
                    r.bestEdge > 0.01 && 'bg-emerald-lo/5',
                  )}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Flag code={team.flag} size={18} />
                        <span className="text-sm text-fg-1">
                          {locale === 'es' ? team.name_es : team.name_en}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular text-fg-0 font-medium">
                      {formatPct(r.our_prob, 1)}
                    </td>
                    <BookCells book={poly} />
                    <BookCells book={kal} />
                    <td className="px-3 py-2 text-right border-l border-border/40">
                      {r.bestBook && r.bestEdge > 0 ? (
                        <span className={cn(
                          'inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                          r.bestBook === 'polymarket'
                            ? 'bg-violet/15 text-violet'
                            : 'bg-emerald/15 text-emerald',
                        )}>
                          {r.bestBook}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-fg-3">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-fg-3">
        Disclaimer: edge positivo no garantiza ganancia. El modelo captura nivel histórico (ELO) pero NO
        modela lesiones, forma reciente, cambios de DT, ni el sentiment del mercado. Cada fuente devigueada
        por separado (Polymarket binario, Kalshi mid del bid/ask). Esto es análisis estadístico,
        no consejo financiero. Apostá lo que puedas perder.
      </p>
    </section>
  );
}

function BookCells({ book }: { book: PivotRow['byBook'][Book] }) {
  if (!book) {
    return (
      <>
        <td className="px-3 py-2 text-right font-mono text-xs text-fg-3 border-l border-border/40">-</td>
        <td className="px-3 py-2 text-right font-mono text-xs text-fg-3">-</td>
        <td className="px-3 py-2 text-right font-mono text-xs text-fg-3">-</td>
      </>
    );
  }
  const positive = book.edge > 0;
  return (
    <>
      <td className="px-3 py-2 text-right font-mono text-xs tabular text-fg-2 border-l border-border/40">
        {formatPct(book.fair_prob, 1)}
      </td>
      <td className={cn(
        'px-3 py-2 text-right font-mono text-xs tabular',
        positive ? 'text-emerald' : 'text-rose/80',
      )}>
        {positive ? '+' : ''}{formatPct(book.edge, 1)}
      </td>
      <td className={cn(
        'px-3 py-2 text-right font-mono text-xs tabular',
        book.ev > 0 ? 'text-emerald font-bold' : 'text-fg-3',
      )}>
        {book.ev > 0 ? '+' : ''}{book.ev.toFixed(3)}
      </td>
    </>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl border border-border glass p-6 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 w-full animate-pulse rounded-md bg-bg-2/40" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-bg-1/30 p-10 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
          Mercado sin datos
        </div>
        <p className="text-sm text-fg-2">{message}</p>
      </div>
    </div>
  );
}
