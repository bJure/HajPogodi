import { describe, expect, it } from 'vitest';
import { mapFixture, shortenTeamName } from '@/infrastructure/football/apiFootballClient';

/**
 * The fixture mapper is pure, so it is testable without a network or a database
 * - which matters, because a wrong home/away flip would silently invert every
 * score in the app.
 */
const HAJDUK_ID = 620;

function rawFixture(overrides: {
  homeId?: number;
  awayId?: number;
  status?: string;
  goals?: [number | null, number | null];
  leagueId?: number;
  leagueName?: string;
}) {
  return {
    fixture: {
      id: 1234,
      timestamp: 1_787_000_000,
      status: { short: overrides.status ?? 'NS' },
      venue: { name: 'Poljud' },
    },
    league: {
      id: overrides.leagueId ?? 210,
      name: overrides.leagueName ?? 'SuperSport HNL',
      round: 'Regular Season - 5',
      logo: null,
      type: 'League',
    },
    teams: {
      home: { id: overrides.homeId ?? HAJDUK_ID, name: 'Hajduk Split', logo: null },
      away: { id: overrides.awayId ?? 700, name: 'HNK Rijeka', logo: null },
    },
    goals: { home: overrides.goals?.[0] ?? null, away: overrides.goals?.[1] ?? null },
  };
}

describe('mapiranje utakmica iz API-Footballa', () => {
  it('prepoznaje da je Hajduk domacin i tko je protivnik', () => {
    const mapped = mapFixture(rawFixture({}), HAJDUK_ID);

    expect(mapped?.isHome).toBe(true);
    expect(mapped?.opponent.name).toBe('HNK Rijeka');
  });

  it('prepoznaje gostovanje, jer bi zamjena strana obrnula svaki rezultat', () => {
    const mapped = mapFixture(
      rawFixture({ homeId: 700, awayId: HAJDUK_ID }),
      HAJDUK_ID,
    );

    expect(mapped?.isHome).toBe(false);
    expect(mapped?.opponent.name).toBe('Hajduk Split');
  });

  it('odbacuje utakmicu u kojoj Hajduk uopce ne igra', () => {
    expect(mapFixture(rawFixture({ homeId: 1, awayId: 2 }), HAJDUK_ID)).toBeNull();
  });

  it('vraca rezultat tek kad je utakmica zavrsena', () => {
    expect(mapFixture(rawFixture({ status: '2H', goals: [1, 0] }), HAJDUK_ID)?.score).toBeNull();
    expect(mapFixture(rawFixture({ status: 'FT', goals: [2, 1] }), HAJDUK_ID)?.score).toEqual({
      homeGoals: 2,
      awayGoals: 1,
    });
  });

  it('tretira produzetke i penale kao zavrsenu utakmicu', () => {
    expect(mapFixture(rawFixture({ status: 'AET', goals: [3, 2] }), HAJDUK_ID)?.status).toBe(
      'FINISHED',
    );
    expect(mapFixture(rawFixture({ status: 'PEN', goals: [1, 1] }), HAJDUK_ID)?.score).toEqual({
      homeGoals: 1,
      awayGoals: 1,
    });
  });

  it('preslikava odgodu i otkazivanje na vlastite statuse', () => {
    expect(mapFixture(rawFixture({ status: 'PST' }), HAJDUK_ID)?.status).toBe('POSTPONED');
    expect(mapFixture(rawFixture({ status: 'CANC' }), HAJDUK_ID)?.status).toBe('CANCELLED');
  });

  it('nepoznat status tretira kao zakazanu utakmicu umjesto da pukne', () => {
    expect(mapFixture(rawFixture({ status: 'NESTO_NOVO' }), HAJDUK_ID)?.status).toBe('SCHEDULED');
  });

  it('razvrstava natjecanja po poznatim ligama', () => {
    expect(mapFixture(rawFixture({ leagueId: 210 }), HAJDUK_ID)?.competition.type).toBe('LEAGUE');
    expect(mapFixture(rawFixture({ leagueId: 211 }), HAJDUK_ID)?.competition.type).toBe('CUP');
    expect(mapFixture(rawFixture({ leagueId: 848 }), HAJDUK_ID)?.competition.type).toBe('EUROPE');
  });

  it('razvrstava nepoznata natjecanja po nazivu', () => {
    const cup = mapFixture(
      rawFixture({ leagueId: 9999, leagueName: 'Some Domestic Cup' }),
      HAJDUK_ID,
    );
    expect(cup?.competition.type).toBe('CUP');

    const friendly = mapFixture(
      rawFixture({ leagueId: 9998, leagueName: 'Club Friendlies' }),
      HAJDUK_ID,
    );
    expect(friendly?.competition.type).toBe('FRIENDLY');
  });

  it('pretvara vremensku oznaku u ispravan trenutak', () => {
    const mapped = mapFixture(rawFixture({}), HAJDUK_ID);
    expect(mapped?.kickoffAt.getTime()).toBe(1_787_000_000 * 1000);
  });
});

describe('skracivanje naziva klubova', () => {
  it('mice pravni oblik iz naziva', () => {
    expect(shortenTeamName('HNK Rijeka')).toBe('Rijeka');
    expect(shortenTeamName('GNK Dinamo Zagreb')).toBe('Dinamo Zagreb');
    expect(shortenTeamName('NK Osijek')).toBe('Osijek');
  });

  it('ostavlja naziv na miru kad nema sto skratiti', () => {
    expect(shortenTeamName('Rijeka')).toBe('Rijeka');
  });

  it('ne vraca prazan naziv ni za sam pravni oblik', () => {
    expect(shortenTeamName('NK')).toBe('NK');
  });
});
