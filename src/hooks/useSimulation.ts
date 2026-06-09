'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { SerializedResult, WorkerOutbound } from '@/lib/sim/worker';

export type SimStatus = 'idle' | 'running' | 'done' | 'error';

export interface SimState {
  status: SimStatus;
  completed: number;
  total: number;
  /** Primary result (with absences applied - the model's headline view). */
  result: SerializedResult | null;
  /** Counterfactual: same seed, same N, but with absences disabled. */
  resultNoAbsences: SerializedResult | null;
  /** Which pass is currently running (for progress messaging). */
  scenario: 'withAbsences' | 'noAbsences' | null;
  durationMs: number | null;
  error: string | null;
}

const INITIAL: SimState = {
  status: 'idle',
  completed: 0,
  total: 0,
  result: null,
  resultNoAbsences: null,
  scenario: null,
  durationMs: null,
  error: null,
};

/** Survives route navigation so results stay visible when switching pages. */
let sharedState: SimState = INITIAL;
let sharedWorker: Worker | null = null;
const subscribers = new Set<Dispatch<SetStateAction<SimState>>>();

function notify(next: SimState) {
  sharedState = next;
  subscribers.forEach((setState) => setState(next));
}

function patchShared(patch: Partial<SimState>) {
  notify({ ...sharedState, ...patch });
}

function attachWorkerHandlers(worker: Worker) {
  worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      patchShared({
        completed: msg.completed,
        total: msg.total,
        scenario: msg.scenario,
      });
    } else if (msg.type === 'done') {
      patchShared({
        status: 'done',
        completed: msg.result.numSimulations,
        total: msg.result.numSimulations,
        result: msg.result,
        resultNoAbsences: msg.resultNoAbsences,
        scenario: null,
        durationMs: msg.durationMs,
      });
      if (typeof window !== 'undefined') {
        void import('@/lib/demo/cache').then(({ scheduleDemoWarm, preloadDemoRoute }) => {
          scheduleDemoWarm(msg.result);
          preloadDemoRoute();
        });
      }
    } else if (msg.type === 'error') {
      patchShared({ status: 'error', error: msg.message });
    }
  };
}

export function useSimulation() {
  const workerRef = useRef<Worker | null>(sharedWorker);
  const [state, setState] = useState<SimState>(() => sharedState);

  useEffect(() => {
    subscribers.add(setState);
    setState(sharedState);
    workerRef.current = sharedWorker;

    if (sharedWorker && sharedState.status === 'running') {
      attachWorkerHandlers(sharedWorker);
    }

    return () => {
      subscribers.delete(setState);
    };
  }, []);

  const run = useCallback((numSimulations: number, seed?: number) => {
    sharedWorker?.terminate();
    const worker = new Worker(new URL('@/lib/sim/worker.ts', import.meta.url), { type: 'module' });
    sharedWorker = worker;
    workerRef.current = worker;

    // Keep existing results visible until the new run finishes.
    notify({
      ...sharedState,
      status: 'running',
      completed: 0,
      total: numSimulations,
      scenario: 'withAbsences',
      durationMs: null,
      error: null,
    });

    attachWorkerHandlers(worker);
    worker.postMessage({ type: 'run', numSimulations, seed });
  }, []);

  const reset = useCallback(() => {
    sharedWorker?.terminate();
    sharedWorker = null;
    workerRef.current = null;
    notify(INITIAL);
  }, []);

  return { state, run, reset };
}
