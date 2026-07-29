import { describe, expect, it } from 'vitest';
import { ESPN_HAJDUK_ID, mapEspnEvent } from '@/infrastructure/football/espnClient';
import { toEspnId } from '@/infrastructure/football/providerIds';

/**
 * ESPN's feed is undocumented, so the mapper's job is as much rejection as
 * translation: anything it cannot read confidently must be dropped rather than
 * turned into a fixture with invented values.
 */
function event(options: {
  id?: string;
  slug?: string;
  date?: string;
  homeId?: number;
  awayId?: number;
  homeScore?: number | null;
  awayScore?: number | null;
  completed?: boolean;
  statusName?: string;
}): unknown {
  const {
    id = '401896235',
    slug = 'uefa.europa_qual',
    date = '2026-07-23T19:00Z',
    homeId = ESPN_HAJDUK_ID,
    awayId = 22281,
    homeScore = null,
    awayScore = null,
    completed = false,
    statusName = 'STATUS_SCHEDULED',
  } = options;

  const competitor = (teamId: number, homeAway: string, score: number | null) => ({
    homeAway,
    team: {
      id: String(teamId),
      displayName: teamId === ESPN_HAJDUK_ID ? 'Hajduk Split' : 'Pafos',
      logos: [{ href: 'https://a.espncdn.com/logo.png' }],
    },
    score: { value: score },
  });

  return {
    id,
    date,
    league: { slug, name: 'UEFA Europa League Qualifying' },
    competitions: [
      {
        status: { type: { name: statusName, completed, state: completed ? 'post' : 'pre' } },
        venue: { fullName: 'Stadion Poljud' },
        competitors: [
          competitor(homeId, 'home', homeScore),
          competitor(awayId, 'away', awayScore),
        ],
      },
    ],
  };
}

describe('ESPN mapper', () => {
  it('mapira europsku utakmicu na natjecanje koje vec postoji u bazi', () => {
    const fixture = mapEspnEvent(event({}) as never, ESPN_HAJDUK_ID);

    expect(fixture?.competition.apiLeagueId).toBe(3);
    expect(fixture?.competition.type).toBe('EUROPE');
    expect(fixture?.venue).toBe('Stadion Poljud');
  });

  it('kvalifikacije vodi pod isto natjecanje kao i glavni turnir', () => {
    const qual = mapEspnEvent(event({ slug: 'uefa.europa.conf_qual' }) as never, ESPN_HAJDUK_ID);
    const main = mapEspnEvent(event({ slug: 'uefa.europa.conf' }) as never, ESPN_HAJDUK_ID);

    expect(qual?.competition.apiLeagueId).toBe(848);
    expect(main?.competition.apiLeagueId).toBe(848);
  });

  /**
   * Competitions are upserted by league id, so a name coming from the feed
   * renames the seeded row. The first live sync did exactly that: it turned
   * "UEFA Europska liga" into "UEFA Europa League Qualifying".
   */
  it('koristi nase ime natjecanja, ne ESPN-ovo', () => {
    const qual = mapEspnEvent(event({ slug: 'uefa.europa_qual' }) as never, ESPN_HAJDUK_ID);
    expect(qual?.competition.name).toBe('UEFA Europska liga');
  });

  /**
   * ESPN carries no Croatian football at all, so anything domestic that shows
   * up here is a slug we do not understand - dropping it lets semafor stay the
   * single source for the league and the cup.
   */
  it('odbacuje natjecanje koje nije UEFA-ino', () => {
    expect(mapEspnEvent(event({ slug: 'cro.1' }) as never, ESPN_HAJDUK_ID)).toBeNull();
    expect(mapEspnEvent(event({ slug: 'fifa.friendly' }) as never, ESPN_HAJDUK_ID)).toBeNull();
  });

  it('cuva perspektivu utakmice kad je Hajduk gost', () => {
    const fixture = mapEspnEvent(
      event({
        homeId: 22281,
        awayId: ESPN_HAJDUK_ID,
        homeScore: 1,
        awayScore: 2,
        completed: true,
        statusName: 'STATUS_FULL_TIME',
      }) as never,
      ESPN_HAJDUK_ID,
    );

    expect(fixture?.isHome).toBe(false);
    expect(fixture?.score).toEqual({ homeGoals: 1, awayGoals: 2 });
    expect(fixture?.opponent.name).toBe('Pafos');
  });

  it('rezultat uzima tek kad je utakmica zavrsena', () => {
    const live = mapEspnEvent(
      event({ homeScore: 1, awayScore: 0, completed: false, statusName: 'STATUS_FIRST_HALF' }) as never,
      ESPN_HAJDUK_ID,
    );

    expect(live?.status).toBe('SCHEDULED');
    expect(live?.score).toBeNull();
  });

  it('prepoznaje odgodu i otkazivanje', () => {
    const postponed = mapEspnEvent(event({ statusName: 'STATUS_POSTPONED' }) as never, ESPN_HAJDUK_ID);
    const canceled = mapEspnEvent(event({ statusName: 'STATUS_CANCELED' }) as never, ESPN_HAJDUK_ID);

    expect(postponed?.status).toBe('POSTPONED');
    expect(canceled?.status).toBe('CANCELLED');
  });

  /**
   * ESPN team 489 and HNS club 489 are different clubs. Without separate id
   * bands the team upsert would merge them into one.
   */
  it('id-eve smjesta u vlastiti raspon', () => {
    const fixture = mapEspnEvent(event({}) as never, ESPN_HAJDUK_ID);

    expect(fixture?.fixtureId).toBe(toEspnId(401896235));
    expect(fixture?.opponent.apiTeamId).toBe(toEspnId(22281));
    expect(fixture?.opponent.apiTeamId).not.toBe(22281);
  });

  it('odbacuje event bez upotrebljivog datuma ili protivnika', () => {
    expect(mapEspnEvent(event({ date: '' }) as never, ESPN_HAJDUK_ID)).toBeNull();
    expect(
      mapEspnEvent(event({ homeId: ESPN_HAJDUK_ID, awayId: ESPN_HAJDUK_ID }) as never, ESPN_HAJDUK_ID),
    ).toBeNull();
  });
});
