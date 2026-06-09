/**
 * Run the Monte Carlo engine and append a prediction snapshot to
 * src/data/snapshots.json. Triggered by the live-tournament cron (Tier 1.5)
 * after results / cards / suspensions have been ingested.
 *
 *   pnpm tsx scripts/snapshot-run.ts                # default 50k sims
 *   pnpm tsx scripts/snapshot-run.ts --n 100000     # custom N
 *   pnpm tsx scripts/snapshot-run.ts --trigger "..."# explicit trigger label
 *
 * The snapshot file is capped at MAX_SNAPSHOTS — oldest entries drop. Each
 * entry is small (~6 KB pretty-printed for 48 teams × 7 fields) so 50 fits in
 * ~300 KB.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runSimulations } from '../src/lib/sim/engine';
import { allResults, liveMeta } from '../src/lib/sim/state';

const SNAPSHOT_PATH = path.resolve(__dirname, '..', 'src', 'data', 'snapshots.json');
const MAX_SNAPSHOTS = 50;

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
interface SnapshotFile {
  _meta: Record<string, unknown>;
  snapshots: Snapshot[];
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }

function summarize(N: number, trigger: string): Snapshot {
  const r = runSimulations({ numSimulations: N, seed: 20260611 });
  const probs: Record<string, Probabilities> = {};
  for (let i = 0; i < r.teams.length; i++) {
    const id = r.teams[i].id;
    probs[id] = {
      champ: round4(r.stageCounts.champion[i] / N),
      final: round4(r.stageCounts.final[i] / N),
      sf:    round4(r.stageCounts.sf[i] / N),
      qf:    round4(r.stageCounts.qf[i] / N),
      r16:   round4(r.stageCounts.r16[i] / N),
      r32:   round4(r.stageCounts.r32[i] / N),
      out:   round4((N - r.stageCounts.r32[i]) / N),
    };
  }
  const results = allResults();
  const decided = Object.values(results).filter((m) => m.status === 'completed').length;
  return {
    id: new Date().toISOString(),
    trigger,
    decided_matches: decided,
    num_simulations: N,
    probabilities: probs,
  };
}

function loadFile(): SnapshotFile {
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8')) as SnapshotFile;
}
function saveFile(f: SnapshotFile): void {
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(f, null, 2) + '\n');
}

function defaultTrigger(): string {
  const meta = liveMeta();
  if (!meta.tournament_started) return 'Pre-tournament baseline';
  const results = allResults();
  const completed = Object.entries(results)
    .filter(([, r]) => r.status === 'completed')
    .sort(([, a], [, b]) => (a.kickoff_iso ?? '').localeCompare(b.kickoff_iso ?? ''));
  const last = completed[completed.length - 1];
  if (!last) return 'Post-kickoff snapshot';
  const [k, m] = last;
  return `After ${m.home} ${m.gh}-${m.ga} ${m.away} (${k})`;
}

function main() {
  const args = process.argv.slice(2);
  let N = 50000;
  let trigger = defaultTrigger();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n' && args[i + 1]) { N = parseInt(args[++i], 10); }
    else if (args[i] === '--trigger' && args[i + 1]) { trigger = args[++i]; }
  }

  console.error(`snapshot: N=${N} trigger="${trigger}"`);
  const t0 = Date.now();
  const snap = summarize(N, trigger);
  console.error(`engine: ${Date.now() - t0}ms · decided=${snap.decided_matches}`);

  const file = loadFile();
  file.snapshots.push(snap);
  if (file.snapshots.length > MAX_SNAPSHOTS) {
    file.snapshots.splice(0, file.snapshots.length - MAX_SNAPSHOTS);
  }
  saveFile(file);
  console.error(`saved: ${file.snapshots.length} snapshots total`);
}

main();
