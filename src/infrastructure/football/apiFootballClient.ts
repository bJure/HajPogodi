import 'server-only';
import type { FixtureDto, FootballApiPort } from '@/application/ports/services';
import { getEnv } from '@/lib/env';
import { logger } from '@/infrastructure/logging/logger';

/**
 * API-Football adapter.
 *
 * Chosen over scraping because it is a real API with an official free tier and
 * it covers HNL, the Croatian Cup and every UEFA competition in one call - a
 * single `fixtures?team=&season=` request returns Hajduk's whole season.
 *
 * At 100 requests/day the quota is generous for a club playing twice a week,
 * but the poller is still written to spend as few as possible.
 *
 * Mapping conventions here mirror the WorldCup project's sync endpoint
 * (`server/api/sync/fixtures.post.ts`): status short codes to our enum, and
 * upsert by the provider's own ids.
 */
const BASE_URL = 'https://v3.football.api-sports.io';

const STATUS_MAP: Record<string, FixtureDto['status']> = {
  TBD: 'SCHEDULED',
  NS: 'SCHEDULED',
  '1H': 'LIVE',
  HT: 'LIVE',
  '2H': 'LIVE',
  ET: 'LIVE',
  BT: 'LIVE',
  P: 'LIVE',
  SUSP: 'LIVE',
  INT: 'LIVE',
  LIVE: 'LIVE',
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  PST: 'POSTPONED',
  CANC: 'CANCELLED',
  ABD: 'CANCELLED',
  AWD: 'FINISHED',
  WO: 'FINISHED',
};

/** League ids we classify explicitly; anything else falls back by name. */
const LEAGUE_TYPES: Record<number, FixtureDto['competition']['type']> = {
  210: 'LEAGUE', // SuperSport HNL
  211: 'CUP', // Hrvatski kup
  2: 'EUROPE', // Liga prvaka
  3: 'EUROPE', // Europska liga
  848: 'EUROPE', // Konferencijska liga
};

interface ApiFixture {
  fixture: {
    id: number;
    timestamp: number;
    status: { short: string };
    venue: { name: string | null } | null;
  };
  league: { id: number; name: string; round: string | null; logo: string | null; type: string };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
}

function classifyCompetition(league: ApiFixture['league']): FixtureDto['competition']['type'] {
  const known = LEAGUE_TYPES[league.id];
  if (known) return known;

  const name = league.name.toLowerCase();
  if (name.includes('friendl') || name.includes('prijatelj')) return 'FRIENDLY';
  if (name.includes('cup') || name.includes('kup')) return 'CUP';
  if (league.type?.toLowerCase() === 'cup') return 'CUP';
  return 'LEAGUE';
}

function shortenTeamName(name: string): string {
  // Provider names carry the legal form ("GNK Dinamo Zagreb"); the UI wants the
  // part people actually say.
  const cleaned = name
    .replace(/\b(NK|HNK|GNK|FC|AC|SK|FK|CF|SC)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : name;
}

export function mapFixture(raw: ApiFixture, ourTeamId: number): FixtureDto | null {
  const isHome = raw.teams.home.id === ourTeamId;
  const isAway = raw.teams.away.id === ourTeamId;
  // Defensive: the provider should only return our club's fixtures here.
  if (!isHome && !isAway) return null;

  const opponent = isHome ? raw.teams.away : raw.teams.home;
  const status = STATUS_MAP[raw.fixture.status.short] ?? 'SCHEDULED';

  const hasScore =
    status === 'FINISHED' && raw.goals.home !== null && raw.goals.away !== null;

  return {
    fixtureId: raw.fixture.id,
    kickoffAt: new Date(raw.fixture.timestamp * 1000),
    status,
    round: raw.league.round,
    venue: raw.fixture.venue?.name ?? null,
    isHome,
    opponent: {
      apiTeamId: opponent.id,
      name: opponent.name,
      logoUrl: opponent.logo,
    },
    competition: {
      apiLeagueId: raw.league.id,
      name: raw.league.name,
      type: classifyCompetition(raw.league),
      logoUrl: raw.league.logo,
    },
    score: hasScore
      ? { homeGoals: raw.goals.home as number, awayGoals: raw.goals.away as number }
      : null,
    raw,
  };
}

export { shortenTeamName };

async function request(path: string): Promise<ApiFixture[]> {
  const env = getEnv();
  if (!env.API_FOOTBALL_KEY) {
    throw new Error('API_FOOTBALL_KEY nije postavljen');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API-Football greška ${response.status}`);
  }

  const payload = (await response.json()) as {
    response?: ApiFixture[];
    errors?: unknown;
  };

  // The provider answers 200 with an `errors` object for quota and key problems.
  const errors = payload.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors !== undefined && errors !== null && Object.keys(errors as object).length > 0;

  if (hasErrors) {
    logger.error({ errors }, 'API-Football je vratio gresku');
    throw new Error(`API-Football: ${JSON.stringify(errors)}`);
  }

  return payload.response ?? [];
}

export const apiFootballClient: FootballApiPort = {
  async listSeasonFixtures(seasonApiYear) {
    const ourTeamId = getEnv().API_FOOTBALL_TEAM_ID;
    const raw = await request(`/fixtures?team=${ourTeamId}&season=${seasonApiYear}`);

    return raw
      .map((fixture) => mapFixture(fixture, ourTeamId))
      .filter((fixture): fixture is FixtureDto => fixture !== null);
  },

  async getFixture(fixtureId) {
    const ourTeamId = getEnv().API_FOOTBALL_TEAM_ID;
    const raw = await request(`/fixtures?id=${fixtureId}`);
    const first = raw[0];
    if (!first) return null;
    return mapFixture(first, ourTeamId);
  },
};
