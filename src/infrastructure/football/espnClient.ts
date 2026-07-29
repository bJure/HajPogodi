import 'server-only';
import type { FixtureDto } from '@/application/ports/services';
import { logger } from '@/infrastructure/logging/logger';
import { toEspnId, stripBand } from './providerIds';

/**
 * ESPN adapter - European competitions only.
 *
 * ESPN publishes an unauthenticated JSON feed that carries Hajduk's UEFA ties
 * with kickoff times, venues and final scores. It does not cover Croatian
 * domestic football at all: their league list has 220 entries and not one is
 * Croatian, which is why `cro.1` answers 400. HNL and the cup come from HNS
 * semafor instead; this adapter deliberately ignores everything that is not a
 * UEFA competition rather than guessing at leagues it cannot see.
 *
 * The feed is undocumented and carries no stability promise, so every field is
 * read defensively and a fixture that fails to map is dropped rather than
 * allowed to poison a sync.
 */
const BASE_URL = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/teams';

/** ESPN's own numeric id for Hajduk Split, taken from their team URL. */
export const ESPN_HAJDUK_ID = 489;

/**
 * ESPN league slug to the competition our database already carries.
 *
 * Qualifying rounds map onto the same competition as the tournament proper -
 * from a predictor's point of view a Conference League qualifier is still the
 * Conference League.
 *
 * The name is ours, not ESPN's. Competitions are upserted by league id, so
 * passing `event.league.name` through would rename the seeded Croatian
 * competition to whatever English label the feed used that week: the first sync
 * turned "UEFA Europska liga" into "UEFA Europa League Qualifying".
 */
const COMPETITIONS: Record<string, { apiLeagueId: number; name: string }> = {
  'uefa.champions': { apiLeagueId: 2, name: 'UEFA Liga prvaka' },
  'uefa.champions_qual': { apiLeagueId: 2, name: 'UEFA Liga prvaka' },
  'uefa.europa': { apiLeagueId: 3, name: 'UEFA Europska liga' },
  'uefa.europa_qual': { apiLeagueId: 3, name: 'UEFA Europska liga' },
  'uefa.europa.conf': { apiLeagueId: 848, name: 'UEFA Konferencijska liga' },
  'uefa.europa.conf_qual': { apiLeagueId: 848, name: 'UEFA Konferencijska liga' },
};

interface EspnCompetitor {
  homeAway?: string;
  team?: {
    id?: string;
    displayName?: string;
    logos?: { href?: string }[];
  };
  score?: { value?: number } | number | string;
}

interface EspnEvent {
  id?: string;
  date?: string;
  league?: { slug?: string; name?: string };
  competitions?: {
    status?: { type?: { state?: string; name?: string; completed?: boolean } };
    venue?: { fullName?: string };
    competitors?: EspnCompetitor[];
  }[];
}

function readScore(score: EspnCompetitor['score']): number | null {
  // The feed returns an object here, but older payloads used a bare number or
  // a string - all three are cheap to accept.
  if (typeof score === 'number') return Number.isFinite(score) ? score : null;
  if (typeof score === 'string') {
    const parsed = Number.parseInt(score, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const value = score?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapStatus(
  type: { state?: string; name?: string; completed?: boolean } | undefined,
): FixtureDto['status'] {
  const name = type?.name ?? '';
  if (name.includes('POSTPONED')) return 'POSTPONED';
  if (name.includes('CANCELED') || name.includes('CANCELLED')) return 'CANCELLED';
  if (type?.completed) return 'FINISHED';
  if (type?.state === 'in') return 'LIVE';
  return 'SCHEDULED';
}

/** Pure mapper, exported so the shape can be tested without the network. */
export function mapEspnEvent(event: EspnEvent, ourTeamId: number): FixtureDto | null {
  const slug = event.league?.slug ?? '';
  const competitionInfo = COMPETITIONS[slug];
  // Not a UEFA competition we track - domestic fixtures are semafor's job.
  if (!competitionInfo) return null;

  const rawId = Number.parseInt(event.id ?? '', 10);
  if (Number.isNaN(rawId)) return null;

  const kickoffAt = event.date ? new Date(event.date) : null;
  if (!kickoffAt || Number.isNaN(kickoffAt.getTime())) return null;

  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];

  const ours = competitors.find((c) => Number.parseInt(c.team?.id ?? '', 10) === ourTeamId);
  const opponent = competitors.find((c) => Number.parseInt(c.team?.id ?? '', 10) !== ourTeamId);
  if (!ours || !opponent) return null;

  const opponentId = Number.parseInt(opponent.team?.id ?? '', 10);
  const opponentName = opponent.team?.displayName;
  if (Number.isNaN(opponentId) || !opponentName) return null;

  const status = mapStatus(competition?.status?.type);
  const ourScore = readScore(ours.score);
  const theirScore = readScore(opponent.score);
  const isHome = ours.homeAway === 'home';

  const hasScore = status === 'FINISHED' && ourScore !== null && theirScore !== null;

  return {
    fixtureId: toEspnId(rawId),
    kickoffAt,
    status,
    round: null,
    venue: competition?.venue?.fullName ?? null,
    isHome,
    opponent: {
      apiTeamId: toEspnId(opponentId),
      name: opponentName,
      logoUrl: opponent.team?.logos?.[0]?.href ?? null,
    },
    competition: {
      apiLeagueId: competitionInfo.apiLeagueId,
      name: competitionInfo.name,
      type: 'EUROPE',
      logoUrl: null,
    },
    score: hasScore
      ? {
          homeGoals: isHome ? (ourScore as number) : (theirScore as number),
          awayGoals: isHome ? (theirScore as number) : (ourScore as number),
        }
      : null,
    raw: event,
  };
}

async function fetchSchedule(teamId: number, upcoming: boolean): Promise<EspnEvent[]> {
  const url = `${BASE_URL}/${teamId}/schedule${upcoming ? '?fixture=true' : ''}`;

  const response = await fetch(url, {
    // The feed answers 403 to clients that send no user agent at all.
    headers: { 'user-agent': 'HajPogodi/1.0 (+https://hajpogodi.vercel.app)' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`ESPN greška ${response.status}`);
  }

  const payload = (await response.json()) as { events?: EspnEvent[] };
  return payload.events ?? [];
}

/**
 * Both halves of the season in two requests: `fixture=true` returns what is
 * still to be played, the bare call returns what already has a score.
 */
export async function listEspnFixtures(teamId = ESPN_HAJDUK_ID): Promise<FixtureDto[]> {
  const [upcoming, played] = await Promise.all([
    fetchSchedule(teamId, true),
    fetchSchedule(teamId, false),
  ]);

  const byId = new Map<number, FixtureDto>();
  for (const event of [...played, ...upcoming]) {
    const fixture = mapEspnEvent(event, teamId);
    // Upcoming wins over played on collision: it is the fresher of the two.
    if (fixture) byId.set(fixture.fixtureId, fixture);
  }

  logger.info({ count: byId.size }, 'ESPN raspored dohvacen');
  return [...byId.values()];
}

export async function getEspnFixture(
  fixtureId: number,
  teamId = ESPN_HAJDUK_ID,
): Promise<FixtureDto | null> {
  // The feed has no per-event endpoint on this host, so the poller re-reads the
  // schedule and picks its match out. One request either way.
  const all = await listEspnFixtures(teamId);
  return all.find((f) => f.fixtureId === fixtureId) ?? null;
}

export { stripBand };
