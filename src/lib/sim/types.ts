export interface Team {
  id: string;
  name_en: string;
  name_es: string;
  flag: string;
  /** Current ELO rating (end-of-prior-year snapshot from eloratings.net). */
  elo: number;
  is_host: boolean;
  /**
   * ELO rating 12 months before `elo`. Used by the recent-form blend
   * to up/down-weight teams that have changed level over the last year.
   * `null` if no historical snapshot exists (new team / name change).
   */
  elo_1y_ago?: number | null;
}

export interface MatchResult {
  home: number;       // team index
  away: number;
  goals_home: number;
  goals_away: number;
  winner: number;     // team index that advances (winner via PK if drawn in knockout)
  drawn: boolean;     // true if regular-time draw (knockout - penalties decided it)
}

/**
 * Furthest knockout round a team participated in. Bronze-medal status is tracked
 * separately via `TournamentResult.thirdPlace` - it doesn't bump the stage value
 * because a 3rd-place finisher still topped out at SF (they lost there, then
 * won the 3rd-place playoff).
 */
export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'champion';

/** Per-team group-stage finish position. */
export type GroupFinish = 'first' | 'second' | 'thirdAdvances' | 'thirdOut' | 'fourth';

export interface TournamentResult {
  /** champion = team index that won the final */
  champion: number;
  /** runner-up index */
  runnerUp: number;
  /** third-place team index */
  thirdPlace: number;
  /** fourth-place team index */
  fourthPlace: number;
  /** for each team idx: the furthest stage they reached */
  stageReached: Stage[];
  /** for each team idx: their final position in the group stage */
  groupFinish: GroupFinish[];
  /** total goals scored by each team across the tournament (regular time only) */
  goalsFor: Int32Array;
  /** total goals conceded by each team */
  goalsAgainst: Int32Array;
}

/**
 * Per-fixture aggregate accumulated over N simulations.
 *
 * For group matches, the slot is fixed (always the same home/away pair), so
 * there's one entry per slot. For knockout matches, the same slot can host
 * different matchups across sims (depending on who advances), so we key by
 * `${slotId}|${homeId}-${awayId}` and count separately for each variant.
 *
 * `count` of a knockout entry divided by N is the probability of that
 * specific matchup occurring at that slot. Sum of counts across all
 * matchups for a single slot equals N (every sim plays that slot once,
 * unless deeper bracket dependencies - irrelevant here).
 */
export interface MatchAggregate {
  slotId: string;
  /** Stage where this match happens: 'group' or 'r32'/'r16'/'qf'/'sf'/'final'/'3rd'. */
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd';
  /** Group letter for group-stage fixtures, undefined otherwise. */
  group?: string;
  /** Home team ID (fixed for group fixtures, varies per sim for knockout). */
  home: string;
  /** Away team ID. */
  away: string;
  count: number;
  winsHome: number;
  draws: number;
  winsAway: number;
  sumGoalsHome: number;
  sumGoalsAway: number;
  /** 8×8 score histogram, index = goalsHome*8 + goalsAway. */
  scoreHist: Int32Array;
}

/** Serialization-friendly version of MatchAggregate (Int32Array → number[]). */
export interface MatchAggregateSerialized extends Omit<MatchAggregate, 'scoreHist'> {
  scoreHist: number[];
}

/**
 * One captured-in-full simulation. The engine samples ~1 every (N / SAMPLE_SIZE)
 * sims and stores the complete match list so the UI can let users browse
 * actual tournaments - not just aggregates. Memory cost is ~2KB per sample.
 */
export interface SampleSim {
  /** Index of this sim within the full run (0..N-1). */
  simIdx: number;
  matches: Array<{
    /** 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final' */
    stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';
    /** For groups: 'A:0'..'L:5'. For KO: match.id as string. */
    slotId: string;
    /** Team indices in the global teams array. */
    home: number;
    away: number;
    gh: number;
    ga: number;
  }>;
  champion: number;       // team idx
  runnerUp: number;
  thirdPlace: number;
  fourthPlace: number;
}

export interface AggregateResult {
  numSimulations: number;
  teams: Team[];
  /** for each team: number of times they reached each stage */
  stageCounts: {
    r32: Int32Array;
    r16: Int32Array;
    qf: Int32Array;
    sf: Int32Array;
    final: Int32Array;
    third: Int32Array;
    champion: Int32Array;
  };
  /** for each team: sum of goalsFor across all sims (use /N for avg per tournament) */
  totalGoalsFor: Float64Array;
  totalGoalsAgainst: Float64Array;
  /** for each team: number of times they finished 1st/2nd/3rd-advancing/3rd-out/4th in their group */
  groupFinish: {
    first: Int32Array;
    second: Int32Array;
    thirdAdvances: Int32Array;
    thirdOut: Int32Array;
    fourth: Int32Array;
  };
  /** histogram of total goals scored across the tournament (regular time, group + knockout) */
  tournamentGoalsHistogram: Int32Array;
  /**
   * Per-fixture aggregates. Keys are slotId for group stage ("A:0", "A:1", ...
   * "L:5"); for knockout, key is "{slotId}|{home}-{away}" so different matchups
   * at the same slot are tracked independently.
   */
  fixtures: Map<string, MatchAggregate>;
  /**
   * Scorer accumulator. Key = "TEAMID|PlayerName" (e.g. "ARG|Lionel Messi").
   * Value = total goals across all sims for that player.
   */
  scorers: Map<string, number>;
  /**
   * Captured sample of complete simulations (every Math.floor(N/SAMPLE_SIZE)-th
   * sim). Lets the UI show real tournaments instead of just aggregates. Cost
   * is ~2KB per sample → ~600KB for N=100k at SAMPLE_SIZE=300.
   */
  sampleSims: SampleSim[];
}
