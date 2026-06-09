'use client';

import { useMemo } from 'react';
import {
  currentAbsences,
  criticality,
  playerPenalty,
  teamPenalty,
  DEFAULT_ABSENCE_WEIGHTS,
  type Absence,
} from '@/lib/sim/absences';

const POSITION_LABEL: Record<Absence['position'], string> = {
  GK: 'Arquero',
  CB: 'Defensa central',
  FB: 'Lateral',
  DM: 'Mediocampo def.',
  CM: 'Mediocampo',
  AM: 'Mediapunta',
  WG: 'Extremo',
  ATT: 'Delantero',
};

/**
 * Lists every player flagged as absent for a given team, with the ELO penalty
 * each one contributes under the current weight configuration. Hidden when the
 * team has no recorded absences.
 */
export function TeamAbsencesPanel({ teamId }: { teamId: string }) {
  const data = useMemo(() => {
    const absences = currentAbsences(teamId);
    if (absences.length === 0) return null;
    const total = teamPenalty(absences, DEFAULT_ABSENCE_WEIGHTS, 'group');
    const rows = absences
      .map((a) => ({
        absence: a,
        criticalityScore: criticality(a, DEFAULT_ABSENCE_WEIGHTS),
        penalty: playerPenalty(a, DEFAULT_ABSENCE_WEIGHTS),
      }))
      .sort((x, y) => x.penalty - y.penalty); // most severe first
    return { rows, total };
  }, [teamId]);

  if (!data) return null;

  return (
    <section>
      <h3 className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
        <span>
          Ausencias actuales <span className="text-fg-3">· lesionados</span>
        </span>
        <span className="rounded-md border border-rose/40 bg-rose/10 px-2 py-0.5 text-rose tabular">
          {Math.round(data.total)} ELO
        </span>
      </h3>
      <ul className="space-y-1.5">
        {data.rows.map(({ absence, penalty }) => (
          <li
            key={absence.player}
            className="flex items-center justify-between rounded-lg border border-border bg-bg-2/30 px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="text-fg-1">{absence.player}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3">
                {POSITION_LABEL[absence.position]} · €{absence.market_value_mil}m
              </span>
            </div>
            <span className="font-mono tabular text-xs text-rose">
              {Math.round(penalty)} ELO
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-fg-3 leading-relaxed">
        Penalización aplicada al ELO efectivo del equipo en la simulación. Fuente: transfermarkt (flag de lesión).
        Pesos: value-dominant (β=0.8) + boost posicional (γ=0.2). Ver <a className="underline decoration-gold/40 underline-offset-2" href="/methodology">metodología</a>.
      </p>
    </section>
  );
}

/** Compact inline badge for headers / match cards - shows just the total. */
export function AbsenceBadge({ teamId, className = '' }: { teamId: string; className?: string }) {
  const total = useMemo(() => {
    const absences = currentAbsences(teamId);
    if (absences.length === 0) return 0;
    return teamPenalty(absences, DEFAULT_ABSENCE_WEIGHTS, 'group');
  }, [teamId]);

  if (total === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-rose/40 bg-rose/10 px-1.5 py-0.5 font-mono text-[9px] tabular text-rose ${className}`}
      title={`Penalización por ausencias: ${Math.round(total)} ELO`}
    >
      {Math.round(total)} ELO
    </span>
  );
}
