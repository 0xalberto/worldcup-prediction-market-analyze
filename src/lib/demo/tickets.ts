import groupsData from '@/data/groups.json';
import type { SerializedResult } from '@/lib/sim/worker';
import type { DemoTicketListing } from './types';

const GROUPS = (groupsData as { groups: Record<string, string[]> }).groups;

const VENUES: Record<string, string> = {
  final: 'MetLife Stadium, East Rutherford NJ',
  sf: 'AT&T Stadium, Arlington TX',
  qf: 'SoFi Stadium, Inglewood CA',
  r16: 'Mercedes-Benz Stadium, Atlanta GA',
  r32: 'Lumen Field, Seattle WA',
  group: 'Estadio Azteca, Mexico City',
};

const STAGE_FACE: Record<DemoTicketListing['stage'], number> = {
  group: 120,
  r32: 280,
  r16: 450,
  qf: 750,
  sf: 1200,
  final: 2500,
};

const STAGE_DEMAND: Record<DemoTicketListing['stage'], number> = {
  group: 0,
  r32: 0.12,
  r16: 0.22,
  qf: 0.38,
  sf: 0.55,
  final: 1.1,
};

function hashJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 100) / 1000;
}

function champProb(result: SerializedResult, teamId: string): number {
  const idx = result.teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return 0;
  return result.stageCounts.champion[idx] / result.numSimulations;
}

function teamLabel(result: SerializedResult, teamId: string, locale: 'es' | 'en'): string {
  const t = result.teams.find((x) => x.id === teamId);
  if (!t) return teamId;
  return locale === 'es' ? t.name_es : t.name_en;
}

function makeListing(
  result: SerializedResult,
  locale: 'es' | 'en',
  opts: {
    id: string;
    matchLabel: string;
    stage: DemoTicketListing['stage'];
    category: string;
    teamIds: string[];
    venue?: string;
    faceOverride?: number;
  },
): DemoTicketListing {
  const teamDemand = opts.teamIds.length
    ? Math.max(...opts.teamIds.map((id) => champProb(result, id)))
    : 0.35;
  const demand = 1 + STAGE_DEMAND[opts.stage] + teamDemand * 0.85;
  const faceValue = opts.faceOverride ?? STAGE_FACE[opts.stage];
  const jitter = hashJitter(opts.id);
  const fairPrice = Math.round(faceValue * demand * (0.92 + jitter));
  const askPrice = Math.round(fairPrice * (1.06 + jitter * 0.8));

  return {
    id: opts.id,
    matchLabel: opts.matchLabel,
    venue: opts.venue ?? VENUES[opts.stage],
    category: opts.category,
    stage: opts.stage,
    faceValue,
    fairPrice,
    askPrice,
    teamIds: opts.teamIds,
    available: 2 + Math.floor(jitter * 8),
  };
}

/** Synthetic secondary-market ticket inventory priced off sim demand. */
export function buildTicketListings(result: SerializedResult, locale: 'es' | 'en' = 'en'): DemoTicketListing[] {
  const listings: DemoTicketListing[] = [];

  listings.push(
    makeListing(result, locale, {
      id: 'ticket-final-cat1',
      matchLabel: locale === 'es' ? 'Final - Copa del Mundo 2026' : 'Final - FIFA World Cup 2026',
      stage: 'final',
      category: 'Category 1',
      teamIds: [],
      venue: VENUES.final,
    }),
    makeListing(result, locale, {
      id: 'ticket-final-cat2',
      matchLabel: locale === 'es' ? 'Final - Copa del Mundo 2026' : 'Final - FIFA World Cup 2026',
      stage: 'final',
      category: 'Category 2',
      teamIds: [],
      faceOverride: 1400,
    }),
    makeListing(result, locale, {
      id: 'ticket-sf-1',
      matchLabel: locale === 'es' ? 'Semifinal' : 'Semi-final',
      stage: 'sf',
      category: 'Category 1',
      teamIds: [],
    }),
    makeListing(result, locale, {
      id: 'ticket-qf-1',
      matchLabel: locale === 'es' ? 'Cuartos de final' : 'Quarter-final',
      stage: 'qf',
      category: 'Category 2',
      teamIds: [],
    }),
  );

  const hostMatchups: Array<{ id: string; home: string; away: string; group: string; venue?: string }> = [
    { id: 'ticket-mex-rsa', home: 'MEX', away: 'RSA', group: 'A', venue: 'Estadio Azteca, Mexico City' },
    { id: 'ticket-usa-par', home: 'USA', away: 'PAR', group: 'D', venue: 'SoFi Stadium, Inglewood CA' },
    { id: 'ticket-can-sui', home: 'CAN', away: 'SUI', group: 'B', venue: 'BMO Field, Toronto' },
    { id: 'ticket-bra-mar', home: 'BRA', away: 'MAR', group: 'C' },
    { id: 'ticket-esp-uru', home: 'ESP', away: 'URU', group: 'H' },
    { id: 'ticket-arg-alg', home: 'ARG', away: 'ALG', group: 'J' },
    { id: 'ticket-fra-sen', home: 'FRA', away: 'SEN', group: 'I' },
    { id: 'ticket-eng-gha', home: 'ENG', away: 'GHA', group: 'L' },
  ];

  for (const m of hostMatchups) {
    listings.push(
      makeListing(result, locale, {
        id: m.id,
        matchLabel: locale === 'es'
          ? `Grupo ${m.group}: ${teamLabel(result, m.home, locale)} vs ${teamLabel(result, m.away, locale)}`
          : `Group ${m.group}: ${teamLabel(result, m.home, locale)} vs ${teamLabel(result, m.away, locale)}`,
        stage: 'group',
        category: 'Upper tier',
        teamIds: [m.home, m.away],
        venue: m.venue,
      }),
    );
  }

  // One listing per group opener (first team in group).
  for (const [letter, teamIds] of Object.entries(GROUPS)) {
    if (listings.length > 24) break;
    const fav = teamIds.reduce((best, id) =>
      champProb(result, id) > champProb(result, best) ? id : best,
    teamIds[0]);
    listings.push(
      makeListing(result, locale, {
        id: `ticket-group-${letter}`,
        matchLabel: locale === 'es'
          ? `Grupo ${letter} - partido destacado`
          : `Group ${letter} - featured match`,
        stage: 'group',
        category: 'General admission',
        teamIds: [fav],
      }),
    );
  }

  return listings.sort((a, b) => b.askPrice - a.askPrice);
}
