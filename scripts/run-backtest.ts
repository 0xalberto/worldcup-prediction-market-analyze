/** Quick CLI to validate the backtest engine. Not part of the build. */
import { runBacktest } from '../src/lib/sim/backtest';

const r = runBacktest();
console.log('Overall:', r.overall);
console.log('\nPer tournament:');
r.perTournament.forEach((t) => console.log(' ', t.year, t.host.padEnd(8), t.aggregate));
console.log('\nPer stage:');
for (const [s, a] of Object.entries(r.perStage)) {
  console.log(' ', s.padEnd(8), a);
}
console.log('\nWorst 5 misses:');
r.worstMisses.slice(0, 5).forEach((m) => console.log(' ', m.year, m.home, `${m.gh}-${m.ga}`, m.away,
  '| pActual:', m.pActual.toFixed(3), 'logLoss:', m.logLoss.toFixed(2)));
console.log('\nBest 5 calls:');
r.bestCalls.slice(0, 5).forEach((m) => console.log(' ', m.year, m.home, `${m.gh}-${m.ga}`, m.away,
  '| pActual:', m.pActual.toFixed(3)));
