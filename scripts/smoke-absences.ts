/** Smoke test: print effectiveElo deltas from absences for WC 2026 teams with current injuries. */
import teamsData from '../src/data/teams.json';
import { effectiveElo, absenceAdjustment } from '../src/lib/sim/match';
import type { Team } from '../src/lib/sim/types';

const teams = (teamsData as { teams: Team[] }).teams;

console.log('Team   ELO   +RecentForm  +AbsencePenalty  =EffectiveELO');
console.log('-----  ----  ----------- ----------------  -------------');

teams
  .map((t) => ({ t, abs: absenceAdjustment(t, 'group') }))
  .filter((r) => r.abs !== 0)
  .sort((a, b) => a.abs - b.abs)
  .forEach(({ t, abs }) => {
    const eff = effectiveElo(t, 'group');
    const recent = eff - t.elo - abs;
    console.log(
      `${t.id.padEnd(5)}  ${String(t.elo).padStart(4)}  ${String(Math.round(recent)).padStart(11)}  ${String(Math.round(abs)).padStart(16)}  ${String(Math.round(eff)).padStart(13)}`,
    );
  });
