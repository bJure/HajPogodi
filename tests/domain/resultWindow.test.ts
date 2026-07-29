import { describe, expect, it } from 'vitest';
import {
  MAX_RESULT_POLL_ATTEMPTS,
  needsManualAttention,
  shouldPollForResult,
  type PollableMatch,
} from '@/domain/match/resultWindow';
import { pollHintFor, POLL_INTERVAL_MS } from '@/domain/match/pollHint';

const KICKOFF = new Date('2026-08-15T19:00:00Z');

function match(overrides: Partial<PollableMatch> = {}): PollableMatch {
  return {
    kickoffAt: KICKOFF,
    status: 'SCHEDULED',
    resultPollAttempts: 0,
    hasResult: false,
    ...overrides,
  };
}

function minutesAfterKickoff(min: number): Date {
  return new Date(KICKOFF.getTime() + min * 60_000);
}

describe('prozor dohvata rezultata', () => {
  it('ne trosi zahtjev prije nego sto je utakmica mogla zavrsiti', () => {
    expect(shouldPollForResult(match(), minutesAfterKickoff(60))).toBe(false);
    expect(shouldPollForResult(match(), minutesAfterKickoff(104))).toBe(false);
  });

  it('dohvaca rezultat od 105. minute nadalje', () => {
    expect(shouldPollForResult(match(), minutesAfterKickoff(105))).toBe(true);
    expect(shouldPollForResult(match(), minutesAfterKickoff(200))).toBe(true);
  });

  it('prestaje dohvacati nakon pet sati, da odgodena utakmica ne potrosi dnevnu kvotu', () => {
    expect(shouldPollForResult(match(), minutesAfterKickoff(301))).toBe(false);
  });

  it('ne dohvaca ako rezultat vec postoji', () => {
    expect(shouldPollForResult(match({ hasResult: true }), minutesAfterKickoff(120))).toBe(false);
  });

  it('ne dohvaca otkazanu ili odgodenu utakmicu', () => {
    expect(shouldPollForResult(match({ status: 'CANCELLED' }), minutesAfterKickoff(120))).toBe(false);
    expect(shouldPollForResult(match({ status: 'POSTPONED' }), minutesAfterKickoff(120))).toBe(false);
  });

  it('postuje gornju granicu broja pokusaja', () => {
    const exhausted = match({ resultPollAttempts: MAX_RESULT_POLL_ATTEMPTS });
    expect(shouldPollForResult(exhausted, minutesAfterKickoff(120))).toBe(false);
  });

  it('oznacava utakmicu bez rezultata nakon isteka prozora za rucnu intervenciju', () => {
    expect(needsManualAttention(match(), minutesAfterKickoff(120))).toBe(false);
    expect(needsManualAttention(match(), minutesAfterKickoff(400))).toBe(true);
    expect(needsManualAttention(match({ hasResult: true }), minutesAfterKickoff(400))).toBe(false);
  });
});

describe('ucestalost osvjezavanja na klijentu', () => {
  it('osvjezava rijetko kad nema utakmice na vidiku', () => {
    expect(pollHintFor(null, KICKOFF).intervalMs).toBe(POLL_INTERVAL_MS.idle);
  });

  it('ubrzava petnaest minuta prije pocetka', () => {
    const tenBefore = new Date(KICKOFF.getTime() - 10 * 60_000);
    expect(pollHintFor(KICKOFF, tenBefore).mode).toBe('live');
  });

  it('ostaje brz dok se ceka rezultat nakon pocetka', () => {
    expect(pollHintFor(KICKOFF, minutesAfterKickoff(120)).mode).toBe('live');
  });

  it('usporava kad je utakmica danas ali jos daleko', () => {
    const fiveHoursBefore = new Date(KICKOFF.getTime() - 5 * 60 * 60_000);
    expect(pollHintFor(KICKOFF, fiveHoursBefore).mode).toBe('today');
  });

  it('usporava na najsporiji nacin kad je utakmica tek za tjedan dana', () => {
    const weekBefore = new Date(KICKOFF.getTime() - 7 * 24 * 60 * 60_000);
    expect(pollHintFor(KICKOFF, weekBefore).mode).toBe('idle');
  });

  it('usporava nakon sto je prozor rezultata davno prosao', () => {
    expect(pollHintFor(KICKOFF, minutesAfterKickoff(400)).mode).toBe('idle');
  });
});
