/**
 * Calibration sweep for Tier 1 #4a — player absences weight function.
 *
 * Sweeps α + β + γ = 1.0 on the simplex (step 0.1, 66 cells) and reports
 * Brier on (overall) and (affected subset = matches involving a team with
 * a documented absence at that stage). The affected set is small (~10-15
 * matches) so treat absolute deltas with care — direction is the signal.
 */
import {
  runAbsenceSweep,
  runAbsenceBaseline,
  type AbsenceSweepCell,
} from '../src/lib/sim/backtest';

const baseline = runAbsenceBaseline();
console.log('=== Baseline (absences OFF) ===');
console.log(`  Overall : n=${baseline.overall.count}  Brier=${baseline.overall.brier.toFixed(4)}  Acc=${(baseline.overall.accuracy * 100).toFixed(1)}%`);
console.log(`  Affected: n=${baseline.affected.count}  Brier=${baseline.affected.brier.toFixed(4)}  Acc=${(baseline.affected.accuracy * 100).toFixed(1)}%`);

console.log('\n=== Sweep α + β + γ = 1.0, step 0.1 ===');
const cells = runAbsenceSweep(0.1);

// Sort by affected Brier (lower = better), break ties by overall Brier
cells.sort((a, b) => {
  if (a.affected.brier !== b.affected.brier) return a.affected.brier - b.affected.brier;
  return a.overall.brier - b.overall.brier;
});

console.log('\nTop 10 by AFFECTED Brier (lower = better):');
console.log('  α    β    γ    | Affected Brier  Acc%   | Overall Brier  Acc%');
console.log('  ----- ----- -----+----------------------+--------------------');
cells.slice(0, 10).forEach((c: AbsenceSweepCell) => {
  console.log(
    `  ${c.alpha.toFixed(2)} ${c.beta.toFixed(2)} ${c.gamma.toFixed(2)} ` +
    `| ${c.affected.brier.toFixed(4)}  ${(c.affected.accuracy * 100).toFixed(1).padStart(4)}% ` +
    `| ${c.overall.brier.toFixed(4)}  ${(c.overall.accuracy * 100).toFixed(1).padStart(4)}%`,
  );
});

console.log('\nBottom 5 (worst):');
cells.slice(-5).forEach((c: AbsenceSweepCell) => {
  console.log(
    `  ${c.alpha.toFixed(2)} ${c.beta.toFixed(2)} ${c.gamma.toFixed(2)} ` +
    `| ${c.affected.brier.toFixed(4)}  ${(c.affected.accuracy * 100).toFixed(1).padStart(4)}% ` +
    `| ${c.overall.brier.toFixed(4)}  ${(c.overall.accuracy * 100).toFixed(1).padStart(4)}%`,
  );
});

// Find the all-equal point (1/3, 1/3, 1/3) -ish for sanity
const balanced = cells.find((c) => c.alpha === 0.3 && c.beta === 0.3);  // γ=0.4
const minutesOnly = cells.find((c) => c.alpha === 1 && c.beta === 0);
const valueOnly = cells.find((c) => c.alpha === 0 && c.beta === 1);
const positionOnly = cells.find((c) => c.alpha === 0 && c.beta === 0);
console.log('\n=== Reference points ===');
if (balanced) console.log(`  balanced (.3/.3/.4): affected Brier=${balanced.affected.brier.toFixed(4)}`);
if (minutesOnly) console.log(`  minutes only (1/0/0): affected Brier=${minutesOnly.affected.brier.toFixed(4)}`);
if (valueOnly) console.log(`  value only (0/1/0):   affected Brier=${valueOnly.affected.brier.toFixed(4)}`);
if (positionOnly) console.log(`  position only (0/0/1): affected Brier=${positionOnly.affected.brier.toFixed(4)}`);

console.log('\nBaseline reference (affected Brier with absences OFF): ' + baseline.affected.brier.toFixed(4));
console.log('\nN.b. affected set is small — interpret deltas with care. Direction > magnitude.');
