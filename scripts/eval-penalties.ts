import { runPenaltyEvaluation } from '../src/lib/sim/backtest';

const e = runPenaltyEvaluation();
console.log(`n=${e.count} shootouts in backtest`);
console.log(`Model     : Accuracy ${(e.modelAccuracy * 100).toFixed(1)}%   Brier ${e.modelBrier.toFixed(4)}`);
console.log(`Coin flip : Accuracy ${(e.baselineAccuracy * 100).toFixed(1)}%   Brier ${e.baselineBrier.toFixed(4)}`);
console.log(`\nPer-shootout (cutoff=tournament year, no look-ahead):\n`);
console.log('year  stage   home(n,rate)  away(n,rate)   pHome  pick    actual   result');
for (const r of e.rows) {
  const h = `${r.home}(${r.nHome},${(r.rateHome * 100).toFixed(0)}%)`.padEnd(15);
  const a = `${r.away}(${r.nAway},${(r.rateAway * 100).toFixed(0)}%)`.padEnd(15);
  console.log(
    `${r.year}  ${r.stage.padEnd(7)} ${h} ${a} ${(r.pHome * 100).toFixed(0)}%    ${r.modelPicked.padEnd(7)} ${r.actual.padEnd(7)} ${r.correct ? '✓' : '✗'}`,
  );
}
