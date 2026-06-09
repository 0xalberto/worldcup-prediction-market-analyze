/**
 * Quick smoke test for the simulation engine.
 * Runs N simulations and prints top-10 champion probabilities + avg tournament goals.
 *
 * Usage: npx tsx scripts/test-sim.ts [num_sims]
 */

import { runSimulations, championProbabilities } from '../src/lib/sim/engine';

const N = parseInt(process.argv[2] ?? '10000', 10);

console.log(`Running ${N.toLocaleString()} simulations…`);
const t0 = Date.now();
let lastPct = 0;
const agg = runSimulations({
  numSimulations: N,
  seed: 42,
  onProgress: (done, total) => {
    const pct = Math.floor((done / total) * 100);
    if (pct >= lastPct + 10) {
      process.stdout.write(`  ${pct}%… `);
      lastPct = pct;
    }
  },
});
const ms = Date.now() - t0;
console.log(`\nDone in ${(ms / 1000).toFixed(2)}s (${((N / ms) * 1000).toFixed(0)} sims/sec).\n`);

const probs = championProbabilities(agg);
console.log('Top 10 champion probabilities:');
for (let i = 0; i < 10; i++) {
  const p = probs[i];
  const pct = (p.pct * 100).toFixed(2).padStart(5);
  console.log(`  ${(i + 1).toString().padStart(2)}. ${p.team.name_en.padEnd(22)} ${pct}%  (ELO ${p.team.elo})`);
}

const sumChamp = probs.reduce((s, p) => s + p.pct, 0);
console.log(`\nSum of champion probabilities: ${(sumChamp * 100).toFixed(3)}%  (should be 100.000%)`);

// Avg goals per tournament
let totalGoals = 0;
for (let g = 0; g < agg.tournamentGoalsHistogram.length; g++) {
  totalGoals += g * agg.tournamentGoalsHistogram[g];
}
const avgTournamentGoals = totalGoals / N;
const avgGoalsPerMatch = avgTournamentGoals / 104;
console.log(`Avg goals per tournament: ${avgTournamentGoals.toFixed(1)}  (≈ ${avgGoalsPerMatch.toFixed(2)} per match)`);

// Fixtures
const fixtureKeys = Array.from(agg.fixtures.keys());
const groupFixtures = fixtureKeys.filter((k) => /^[A-L]:\d$/.test(k));
const knockFixtures = fixtureKeys.filter((k) => k.includes('|'));
console.log(`Fixtures: ${agg.fixtures.size} total  (${groupFixtures.length} group / ${knockFixtures.length} knockout matchups)`);

// Spot-check: A:0 should always be MEX vs RSA
const a0 = agg.fixtures.get('A:0');
if (a0) {
  console.log(`\nSlot A:0 (${a0.home} vs ${a0.away}):`);
  console.log(`  count=${a0.count}, winsHome=${a0.winsHome}, draws=${a0.draws}, winsAway=${a0.winsAway}`);
  console.log(`  avg score: ${(a0.sumGoalsHome/a0.count).toFixed(2)} - ${(a0.sumGoalsAway/a0.count).toFixed(2)}`);
}

// Sample one knockout slot — the final
const finalFixtures = Array.from(agg.fixtures.entries()).filter(([k]) => k.startsWith('104|'));
console.log(`\nFinal (104): ${finalFixtures.length} unique matchups across ${N} sims`);
finalFixtures.sort((a, b) => b[1].count - a[1].count).slice(0, 5).forEach(([k, f]) => {
  console.log(`  ${f.home}-${f.away}: ${f.count} times (${(f.count/N*100).toFixed(2)}%)`);
});

// Top 10 scorers (excluding 'Otros' buckets)
const topScorers = Array.from(agg.scorers.entries())
  .filter(([key]) => !key.endsWith('|Otros'))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
console.log(`\nTop 10 named scorers (across all sims, /N for avg per tournament):`);
for (const [key, total] of topScorers) {
  console.log(`  ${key.padEnd(36)} ${(total / N).toFixed(2)} goals/tournament`);
}
