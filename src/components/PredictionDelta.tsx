'use client';

import { useMemo } from 'react';
import { Flag } from './Flag';
import { cn, formatPct } from '@/lib/utils';
import { useSelection } from '@/hooks/useSelection';
import snapshotsData from '@/data/snapshots.json';
import type { SerializedResult } from '@/lib/sim/worker';

/**
 * Tier 1.5 - diff view.
 *
 * Reads src/data/snapshots.json (populated by scripts/snapshot-run.ts on the
 * tournament cron) and renders the top movers between the two most recent
 * snapshots. If there are <2 snapshots, the section hides itself. The Monte
 * Carlo run in the browser is independent of these snapshots - this purely
 * visualizes deltas captured by the server-side cron.
 */

interface Probabilities {
  champ: number;
  final: number;
  sf: number;
  qf: number;
  r16: number;
  r32: number;
  out: number;
}
interface Snapshot {
  id: string;
  trigger: string;
  decided_matches: number;
  num_simulations: number;
  probabilities: Record<string, Probabilities>;
}
interface SnapshotsFile {
  _meta: unknown;
  snapshots: Snapshot[];
}

const SNAPSHOTS = (snapshotsData as SnapshotsFile).snapshots;

interface Props { result: SerializedResult }

export function PredictionDelta({ result }: Props) {
  const openTeam = useSelection((s) => s.openTeam);

  const movers = useMemo(() => {
    if (SNAPSHOTS.length < 2) return null;
    const prev = SNAPSHOTS[SNAPSHOTS.length - 2];
    const curr = SNAPSHOTS[SNAPSHOTS.length - 1];
    const teamLookup = new Map(result.teams.map((t) => [t.id, t]));
    const rows: Array<{ id: string; name: string; flag: string; before: number; after: number; delta: number }> = [];
    for (const [id, p] of Object.entries(curr.probabilities)) {
      const before = prev.probabilities[id]?.champ ?? 0;
      const after = p.champ;
      const delta = after - before;
      if (Math.abs(delta) < 0.005) continue;
      const team = teamLookup.get(id);
      if (!team) continue;
      rows.push({ id, name: team.name_es, flag: team.flag, before, after, delta });
    }
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { prev, curr, rows: rows.slice(0, 10) };
  }, [result]);

  if (!movers) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
          Tras el último partido
        </div>
        <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl">
          Cómo cambiaron las probabilidades
        </h2>
        <p className="mt-2 text-sm text-fg-2">
          <span className="font-mono text-fg-1">{movers.curr.trigger}</span>
          <span className="mx-2 text-fg-3">·</span>
          {movers.curr.decided_matches} partido{movers.curr.decided_matches === 1 ? '' : 's'} ya jugado{movers.curr.decided_matches === 1 ? '' : 's'}
          <span className="mx-2 text-fg-3">·</span>
          comparado con la corrida previa de las {new Date(movers.prev.id).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
        </p>
      </header>

      <div className="rounded-2xl border border-border glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-1/40 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
              <th className="px-4 py-3 text-left">Equipo</th>
              <th className="px-4 py-3 text-right">Antes</th>
              <th className="px-4 py-3 text-right">Después</th>
              <th className="px-4 py-3 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {movers.rows.map((r) => {
              const positive = r.delta > 0;
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border/40 transition-colors hover:bg-bg-2/40"
                  onClick={() => openTeam(r.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Flag code={r.flag} size={22} />
                      <span className="text-fg-0">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-fg-2">{formatPct(r.before, 2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-fg-0">{formatPct(r.after, 2)}</td>
                  <td className={cn('px-4 py-2.5 text-right font-mono tabular', positive ? 'text-emerald' : 'text-rose')}>
                    {positive ? '+' : ''}{formatPct(r.delta, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-fg-3">
        Cambios de probabilidad de campeón entre las dos corridas más recientes del simulador. Click en una fila para ver el detalle por equipo.
      </p>
    </section>
  );
}
