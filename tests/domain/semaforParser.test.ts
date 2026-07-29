import { describe, expect, it } from 'vitest';
import {
  SEMAFOR_COMPETITIONS,
  parseSemaforSchedule,
  zagrebToUtc,
  type SemaforCompetition,
} from '@/infrastructure/football/semaforClient';
import { toSemaforId } from '@/infrastructure/football/providerIds';
import type { FixtureDto } from '@/application/ports/services';

/**
 * The semafor parser reads HNS's markup, so it is the one place where a page
 * redesign turns into wrong data rather than an obvious crash. These tests pin
 * the parts that would fail silently: which side Hajduk is on, whether a match
 * counts as played, and what happens to a round that has no kickoff time yet.
 */
const HNL: SemaforCompetition | undefined = SEMAFOR_COMPETITIONS.find((c) => c.type === 'LEAGUE');
if (!HNL) throw new Error('nedostaje konfiguracija SuperSport HNL-a');

/** Narrows the array and fails loudly if the parser found nothing at all. */
function first(fixtures: FixtureDto[]): FixtureDto {
  const [fixture] = fixtures;
  if (!fixture) throw new Error('parser nije vratio nijednu utakmicu');
  return fixture;
}

/** Markup copied from the live page, trimmed to the fields we read. */
function row(options: {
  matchId: number;
  round?: number;
  date: string;
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
  res1?: string;
  res2?: string;
  venue?: string;
}): string {
  const { res1 = '-', res2 = '-', round = 1, venue = 'Stadion Poljud, Split' } = options;
  return `<li class="row visible" data-round="${round}" data-match="${options.matchId}"><div>
    <div class="date">${options.date}</div>
    <div class="club1" data-id="${options.homeId}"><a href="/klubovi/${options.homeId}/x/">${options.homeName}<div class="logo"><img src="https://hns.family/h.png" alt=""></div></a></div>
    <div class="result"><div class="resRegular"><div class="res1">${res1}</div><div class="sep">:</div><div class="res2">${res2}</div></div></div>
    <div class="club2" data-id="${options.awayId}"><a href="/klubovi/${options.awayId}/y/">${options.awayName}<div class="logo"><img src="https://hns.family/a.png" alt=""></div></a></div>
    <div class="facility">${venue}</div>
  </div></li>`;
}

const AWAY_AT_VARAZDIN = row({
  matchId: 114147829,
  date: '02.08.2026. 18:30',
  homeId: 5355,
  homeName: 'NK Varaždin',
  awayId: 515,
  awayName: 'HNK Hajduk',
  venue: 'Stadion Varteks, Varaždin',
});

describe('parser HNS semafora', () => {
  it('cita utakmicu iz Hajdukove perspektive kad je Hajduk gost', () => {
    const fixture = first(parseSemaforSchedule(AWAY_AT_VARAZDIN, HNL));

    expect(fixture.isHome).toBe(false);
    expect(fixture.opponent.name).toBe('NK Varaždin');
    expect(fixture.opponent.apiTeamId).toBe(toSemaforId(5355));
    expect(fixture.venue).toBe('Stadion Varteks, Varaždin');
  });

  it('cita utakmicu kad je Hajduk domacin', () => {
    const html = row({
      matchId: 1,
      date: '08.08.2026. 21:00',
      homeId: 515,
      homeName: 'HNK Hajduk',
      awayId: 1274,
      awayName: 'NK Istra 1961',
    });

    const fixture = first(parseSemaforSchedule(html, HNL));
    expect(fixture.isHome).toBe(true);
    expect(fixture.opponent.name).toBe('NK Istra 1961');
  });

  it('preskace utakmice drugih klubova', () => {
    const html = row({
      matchId: 2,
      date: '01.08.2026. 21:00',
      homeId: 1274,
      homeName: 'HNK Gorica s.d.d.',
      awayId: 150,
      awayName: 'NK Osijek',
    });

    expect(parseSemaforSchedule(html, HNL)).toHaveLength(0);
  });

  /**
   * A crossed home/away would invert every stored score, and nothing downstream
   * could detect it - the numbers would simply be wrong forever.
   */
  it('sprema rezultat u perspektivi utakmice, ne Hajduka', () => {
    const html = row({
      matchId: 3,
      date: '23.05.2027. 18:00',
      homeId: 5355,
      homeName: 'NK Varaždin',
      awayId: 515,
      awayName: 'HNK Hajduk',
      res1: '1',
      res2: '3',
    });

    const fixture = first(parseSemaforSchedule(html, HNL));
    expect(fixture.status).toBe('FINISHED');
    expect(fixture.score).toEqual({ homeGoals: 1, awayGoals: 3 });
    expect(fixture.isHome).toBe(false);
  });

  it('utakmica bez rezultata je zakazana, ne zavrsena s 0:0', () => {
    const fixture = first(parseSemaforSchedule(AWAY_AT_VARAZDIN, HNL));

    expect(fixture.status).toBe('SCHEDULED');
    expect(fixture.score).toBeNull();
  });

  it('koristi id utakmice sa stranice, jer ga neodigrane vec imaju', () => {
    const fixture = first(parseSemaforSchedule(AWAY_AT_VARAZDIN, HNL));
    expect(fixture.fixtureId).toBe(toSemaforId(114147829));
  });

  /**
   * Later rounds are published as a bare date. The placeholder must land before
   * any plausible kickoff: locking too early is an admin override away from
   * fixed, while locking too late means predicting a match already in progress.
   */
  it('datum bez satnice dobiva rani placeholder, ne kraj dana', () => {
    const html = row({
      matchId: 4,
      date: '08.08.2026.',
      homeId: 515,
      homeName: 'HNK Hajduk',
      awayId: 150,
      awayName: 'NK Osijek',
    });

    const fixture = first(parseSemaforSchedule(html, HNL));
    // 12:00 in Zagreb during summer time is 10:00 UTC.
    expect(fixture.kickoffAt.toISOString()).toBe('2026-08-08T10:00:00.000Z');
  });

  it('nosi natjecanje koje mu je zadano', () => {
    const fixture = first(parseSemaforSchedule(AWAY_AT_VARAZDIN, HNL));
    expect(fixture.competition.apiLeagueId).toBe(210);
    expect(fixture.competition.type).toBe('LEAGUE');
  });

  it('vraca prazno umjesto da baci kad se markup promijeni', () => {
    expect(parseSemaforSchedule('<div>redizajn</div>', HNL)).toEqual([]);
  });
});

/**
 * Kickoff times are published as Croatian wall-clock time. Reading them as UTC
 * would shift every fixture by an hour or two, which silently moves the moment
 * predictions lock.
 */
describe('pretvorba zagrebackog vremena u UTC', () => {
  it('ljeti oduzima dva sata', () => {
    expect(zagrebToUtc(2026, 8, 2, 18, 30).toISOString()).toBe('2026-08-02T16:30:00.000Z');
  });

  it('zimi oduzima jedan sat', () => {
    expect(zagrebToUtc(2026, 12, 6, 15, 0).toISOString()).toBe('2026-12-06T14:00:00.000Z');
  });

  it('ne gubi sat na dan prelaska na zimsko racunanje', () => {
    // DST ends 25.10.2026; an evening kickoff that day is already on CET.
    expect(zagrebToUtc(2026, 10, 25, 20, 0).toISOString()).toBe('2026-10-25T19:00:00.000Z');
  });
});
