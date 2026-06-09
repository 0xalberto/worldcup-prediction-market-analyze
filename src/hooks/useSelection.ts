'use client';

import { create } from 'zustand';

/**
 * Drawer selection state. Two independent drawers (team and match) can be
 * open at once or, more commonly, the team drawer can open with a "View
 * match" link that swaps to the match drawer.
 */
interface SelectionState {
  selectedTeamId: string | null;
  /** Fixture key - the same key used in AggregateResult.fixtures map. */
  selectedFixtureKey: string | null;

  openTeam: (teamId: string) => void;
  closeTeam: () => void;
  openFixture: (key: string) => void;
  closeFixture: () => void;
  closeAll: () => void;
}

export const useSelection = create<SelectionState>((set) => ({
  selectedTeamId: null,
  selectedFixtureKey: null,

  openTeam: (teamId) => set({ selectedTeamId: teamId, selectedFixtureKey: null }),
  closeTeam: () => set({ selectedTeamId: null }),
  openFixture: (key) => set({ selectedFixtureKey: key, selectedTeamId: null }),
  closeFixture: () => set({ selectedFixtureKey: null }),
  closeAll: () => set({ selectedTeamId: null, selectedFixtureKey: null }),
}));
