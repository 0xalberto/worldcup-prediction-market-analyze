/** Quick end-to-end Monte Carlo run to validate the engine after #5 fatigue wiring. */
import { simulateTournament } from '../src/lib/sim/tournament';
import { XoshiroRNG } from '../src/lib/sim/rng';
import teamsData from '../src/data/teams.json';
import type { Team } from '../src/lib/sim/types';

const teams = (teamsData as { teams: Team[] }).teams;
const teamIdx = new Map(teams.map((t, i) => [t.id, i]));
const N = 10_000;
console.log(`Sim smoke test (n=${N})...`);
const start = Date.now();
const champs = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const rng = new XoshiroRNG(i + 1);
  const r = simulateTournament(teams, teamIdx, rng);
  const cid = teams[r.champion].id;
  champs.set(cid, (champs.get(cid) ?? 0) + 1);
}
console.log('Took', Date.now() - start, 'ms');
const sorted = [...champs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('Top champions:');
sorted.forEach(([k, v]) => console.log(' ', k, ((v / N) * 100).toFixed(2) + '%'));
