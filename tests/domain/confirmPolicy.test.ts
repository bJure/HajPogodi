import { describe, expect, it } from 'vitest';
import {
  AUTO_CONFIRM_DAYS,
  autoConfirmHorizon,
  shouldAutoConfirm,
  type AutoConfirmableMatch,
} from '@/domain/match/confirmPolicy';

/**
 * Auto-confirmation decides what players can see and predict on. Too eager and
 * a match goes public while its kickoff is still provisional; too shy and a
 * round passes with nobody able to predict at all.
 */
const NOW = new Date('2026-08-01T12:00:00Z');

function match(overrides: Partial<AutoConfirmableMatch> = {}): AutoConfirmableMatch {
  return {
    kickoffAt: new Date('2026-08-03T18:30:00Z'),
    syncState: 'NEEDS_CONFIRMATION',
    status: 'SCHEDULED',
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('automatska potvrda utakmice', () => {
  it('potvrduje utakmicu unutar prozora', () => {
    expect(shouldAutoConfirm(match(), NOW)).toBe(true);
  });

  it('ne dira utakmicu koja je jos dalje od prozora', () => {
    const far = match({ kickoffAt: new Date(NOW.getTime() + (AUTO_CONFIRM_DAYS + 1) * DAY_MS) });
    expect(shouldAutoConfirm(far, NOW)).toBe(false);
  });

  it('granica prozora je ukljucena', () => {
    const exactly = match({ kickoffAt: autoConfirmHorizon(NOW) });
    expect(shouldAutoConfirm(exactly, NOW)).toBe(true);

    const justAfter = match({ kickoffAt: new Date(autoConfirmHorizon(NOW).getTime() + 1000) });
    expect(shouldAutoConfirm(justAfter, NOW)).toBe(false);
  });

  it('vec potvrdenu utakmicu ostavlja na miru', () => {
    expect(shouldAutoConfirm(match({ syncState: 'CONFIRMED' }), NOW)).toBe(false);
  });

  /**
   * A postponed match keeps its old kickoff until a new one is published, so
   * publishing it would open predictions for an hour the match will not be
   * played at.
   */
  it('ne objavljuje odgodenu ni otkazanu utakmicu', () => {
    expect(shouldAutoConfirm(match({ status: 'POSTPONED' }), NOW)).toBe(false);
    expect(shouldAutoConfirm(match({ status: 'CANCELLED' }), NOW)).toBe(false);
  });

  /**
   * A fixture nobody confirmed in time still belongs in the history and has to
   * be scoreable; predictions stay locked because kickoff has passed.
   */
  it('potvrduje i utakmicu kojoj je pocetak vec prosao', () => {
    const past = match({ kickoffAt: new Date(NOW.getTime() - 2 * DAY_MS), status: 'FINISHED' });
    expect(shouldAutoConfirm(past, NOW)).toBe(true);
  });

  it('prozor je tri dana', () => {
    expect(AUTO_CONFIRM_DAYS).toBe(3);
    expect(autoConfirmHorizon(NOW).toISOString()).toBe('2026-08-04T12:00:00.000Z');
  });
});
