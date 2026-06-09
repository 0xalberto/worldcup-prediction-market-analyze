'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { fireConfetti } from '@/lib/confetti';
import { useSimulation } from '@/hooks/useSimulation';
import { Hero } from './Hero';
import { ChampionProbBar } from './ChampionProbBar';
import { StageMatrix } from './StageMatrix';
import { GroupCards } from './GroupCards';
import { BracketTree } from './BracketTree';
import { GoalStats } from './GoalStats';
import { SurpriseCards } from './SurpriseCards';
import { MatchCalendar } from './MatchCalendar';
import { TournamentStats } from './TournamentStats';
import { MarketEdge } from './MarketEdge';
import { PredictionDelta } from './PredictionDelta';
import { TeamDetailDrawer } from './TeamDetailDrawer';
import { MatchDetailDrawer } from './MatchDetailDrawer';
import { SectionNav } from './layout/SectionNav';

export function Dashboard() {
  const { state, run } = useSimulation();
  const router = useRouter();
  const lastStatus = useRef(state.status);

  useEffect(() => {
    if (state.result) {
      router.prefetch('/demo');
      void import('@/lib/demo/cache').then(({ scheduleDemoWarm, preloadDemoRoute }) => {
        scheduleDemoWarm(state.result!);
        preloadDemoRoute();
      });
    }
  }, [state.result, router]);

  useEffect(() => {
    if (state.status === 'done' && lastStatus.current !== 'done') {
      fireConfetti();
      setTimeout(() => {
        document.getElementById('champion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
    lastStatus.current = state.status;
  }, [state.status]);

  return (
    <div className="relative">
      <Hero state={state} onRun={run} />

      {state.result && (
        <>
          <SectionNav />

          <div id="resumen" className="scroll-mt-32">
            <PredictionDelta result={state.result} />
            <ChampionProbBar result={state.result} resultNoAbsences={state.resultNoAbsences} />
            <StageMatrix result={state.result} />
          </div>

          <div id="grupos" className="scroll-mt-32">
            <GroupCards result={state.result} />
          </div>

          <div id="bracket" className="scroll-mt-32">
            <BracketTree result={state.result} />
          </div>

          <div id="calendario" className="scroll-mt-32">
            <MatchCalendar result={state.result} />
          </div>

          <div id="stats" className="scroll-mt-32">
            <TournamentStats result={state.result} />
            <GoalStats result={state.result} />
            <SurpriseCards result={state.result} />
          </div>

          <MarketEdge result={state.result} />

          <TeamDetailDrawer result={state.result} resultNoAbsences={state.resultNoAbsences} />
          <MatchDetailDrawer result={state.result} />
        </>
      )}
    </div>
  );
}
