/**
 * Tier 1.5 - live tournament state.
 *
 * Loaded from src/data/tournament_state.json. Until kickoff (2026-06-11) the
 * file is empty and every helper returns null/empty so the engine runs as a
 * pure pre-tournament forecast. Once GH Actions start populating it, the
 * engine collapses decided branches:
 *
 *  - simulateGroup() skips matches whose `LETTER:pairIdx` key has a result;
 *    the stored goals are used and aggregates accumulate normally.
 *  - tournament.runRound() skips knockout matches whose `match.id` has a
 *    result.
 *  - absences.currentAbsences() is extended via liveSuspensions() so a
 *    yellow-accumulation ban from a real match flows through as a temporary
 *    absence with full criticality.
 *
 * Determinism: the state file is module-loaded once at import. Mutating it
 * mid-run would invalidate the seed→result mapping. Scrapers write it from
 * outside the engine; the next MC run picks it up.
 */
import type { Absence } from './absences';
import stateData from '@/data/tournament_state.json';

export interface LiveResult {
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd';
  home: string;          // team_id
  away: string;          // team_id
  gh: number;            // regulation goals (or 90' goals if went to ET)
  ga: number;
  status: 'completed' | 'scheduled';
  kickoff_iso?: string;
  /** ESPN event id - kept so the cards scraper can resolve summary endpoint. */
  espn_event_id?: string;
  /** Knockout: true if 90' ended drawn and went to extra time. */
  went_to_et?: boolean;
  /** Knockout: true if still drawn after ET and decided on penalties. */
  went_to_pk?: boolean;
  /** Knockout: winner of the shootout (team_id), if applicable. */
  pk_winner?: string;
}

export interface LiveSuspension {
  team: string;
  player: string;
  position: Absence['position'];
  market_value_mil: number;
  /** Stage the ban starts applying from. Cleared by cron once the match is played. */
  from_stage: Absence['applies_from_stage'];
  reason: 'yellow_accumulation' | 'red_card' | 'federation';
}

export interface CardEvent {
  match_id: string;
  team: string;
  player: string;
  color: 'yellow' | 'red';
  minute: number;
}

interface StateFile {
  _meta: {
    updated_at: string | null;
    source: string | null;
    tournament_started: boolean;
  };
  results: Record<string, LiveResult>;
  live_suspensions: LiveSuspension[];
  cards: CardEvent[];
}

const state = stateData as unknown as StateFile;

/** True if the engine should consult live state. False = pure pre-tournament forecast. */
export function isTournamentLive(): boolean {
  return state._meta.tournament_started === true;
}

/** Lookup a decided group-stage match by `${letter}:${pairIdx}`. Returns null if not played. */
export function getGroupResult(slotKey: string): LiveResult | null {
  const r = state.results[slotKey];
  if (!r || r.status !== 'completed' || r.stage !== 'group') return null;
  return r;
}

/** Lookup a decided knockout match by match.id (number → string). */
export function getKnockoutResult(matchId: number): LiveResult | null {
  const r = state.results[String(matchId)];
  if (!r || r.status !== 'completed' || r.stage === 'group') return null;
  return r;
}

/** Live suspensions for a team, projected onto the Absence shape so they
 *  feed through the same criticality / penalty pipeline as injuries. */
export function liveSuspensions(teamId: string): Absence[] {
  return state.live_suspensions
    .filter((s) => s.team === teamId)
    .map((s) => ({
      player: s.player,
      position: s.position,
      // We don't have qualifier minutes on the fly - α=0 by default so this is moot.
      minutes_qual: 0,
      market_value_mil: s.market_value_mil,
      reason: s.reason,
      applies_from_stage: s.from_stage,
    }));
}

/** All decided results, keyed as in the file. Used by the snapshotter / diff UI. */
export function allResults(): Record<string, LiveResult> {
  return state.results;
}

export function liveMeta() {
  return state._meta;
}
