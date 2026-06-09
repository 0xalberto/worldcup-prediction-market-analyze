import { runRecentFormSweep } from '../src/lib/sim/backtest';

const grid = runRecentFormSweep();
const alphas = [...new Set(grid.map((g) => g.alpha))].sort((a, b) => a - b);
const lookbacks = [...new Set(grid.map((g) => g.lookbackYears))].sort((a, b) => a - b);

// Print header
console.log('Brier (lower = better) — recent-form sweep · n=192 matches');
console.log('alpha →' + alphas.map((a) => a.toFixed(2).padStart(8)).join(''));
console.log('lookback');
for (const lb of lookbacks) {
  const row = grid.filter((g) => g.lookbackYears === lb)
    .sort((a, b) => a.alpha - b.alpha)
    .map((g) => g.overall.brier.toFixed(4).padStart(8))
    .join('');
  console.log(' ' + String(lb).padStart(2) + 'y    ' + row);
}

// Find optimum
const best = grid.reduce((m, c) => (c.overall.brier < m.overall.brier ? c : m), grid[0]);
const baseline = grid.find((c) => c.alpha === 0)!;
console.log('\nBaseline (α=0): Brier ' + baseline.overall.brier.toFixed(4)
  + '  Acc ' + (baseline.overall.accuracy * 100).toFixed(1) + '%');
console.log('Optimum:        α=' + best.alpha + ' · lookback=' + best.lookbackYears + 'y');
console.log('                Brier ' + best.overall.brier.toFixed(4)
  + '  Acc ' + (best.overall.accuracy * 100).toFixed(1) + '%');
console.log('Δ Brier vs baseline: ' + (best.overall.brier - baseline.overall.brier).toFixed(4)
  + ' (' + ((1 - best.overall.brier / baseline.overall.brier) * 100).toFixed(2) + '% relative)');
