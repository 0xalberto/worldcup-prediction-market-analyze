import { runBonusSweep } from '../src/lib/sim/backtest';
const sweep = runBonusSweep();
console.log('bonus | inKO | overall_brier | overall_acc | hostOnly_brier | hostOnly_acc | hostOnly_n');
for (const p of sweep) {
  console.log(
    String(p.hostBonus).padStart(4),
    '|', p.applyInKO ? ' T' : ' F',
    '|', p.overall.brier.toFixed(4),
    '       |', (p.overall.accuracy*100).toFixed(1)+'%',
    '   |', p.hostOnly.brier.toFixed(4),
    '        |', (p.hostOnly.accuracy*100).toFixed(1)+'%',
    '    |', p.hostOnly.count,
  );
}
