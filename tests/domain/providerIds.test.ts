import { describe, expect, it } from 'vitest';
import {
  PROVIDER_BAND,
  isEspnId,
  isSemaforId,
  stripBand,
  toEspnId,
  toSemaforId,
} from '@/infrastructure/football/providerIds';

/**
 * Ids from the two providers share one column, so the band that separates them
 * has two hard constraints and both failed in production once already:
 *
 *  - it must survive the round trip, or the result poller asks the wrong
 *    provider and silently never finds the match;
 *  - the banded value must still fit an INT4 column, or the sync dies on write
 *    with a Postgres conversion error instead of storing anything.
 */
const INT4_MAX = 2_147_483_647;

/** Real ids observed on each provider, so the arithmetic is checked against life. */
const ESPN_EVENT = 401_896_235;
const ESPN_TEAM = 22_281;
const SEMAFOR_MATCH = 114_147_829;
const SEMAFOR_CLUB = 5_355;

describe('razdvajanje id-eva po izvoru', () => {
  it('banded ESPN id i dalje stane u INT4 stupac', () => {
    expect(toEspnId(ESPN_EVENT)).toBeLessThanOrEqual(INT4_MAX);
    expect(toEspnId(ESPN_TEAM)).toBeLessThanOrEqual(INT4_MAX);
  });

  it('ostavlja zapas i kad ESPN-ovi id-evi narastu', () => {
    // Ids only ever increase, so the ceiling is what matters.
    expect(toEspnId(PROVIDER_BAND - 1)).toBeLessThanOrEqual(INT4_MAX);
  });

  /**
   * ESPN team 489 is Hajduk and HNS club 489 is somebody else. Without this the
   * team upsert merges two different clubs into one row.
   */
  it('isti broj kod dva izvora ne daje isti id', () => {
    expect(toEspnId(489)).not.toBe(toSemaforId(489));
  });

  it('svaki id se prepoznaje kao vlastiti i ne kao tudji', () => {
    const espn = toEspnId(ESPN_EVENT);
    const semafor = toSemaforId(SEMAFOR_MATCH);

    expect(isEspnId(espn)).toBe(true);
    expect(isSemaforId(espn)).toBe(false);
    expect(isSemaforId(semafor)).toBe(true);
    expect(isEspnId(semafor)).toBe(false);
  });

  it('vraca izvorni broj kad ga treba poslati natrag providerima', () => {
    expect(stripBand(toEspnId(ESPN_EVENT))).toBe(ESPN_EVENT);
    expect(stripBand(toSemaforId(SEMAFOR_CLUB))).toBe(SEMAFOR_CLUB);
  });

  it('puca glasno ako id preraste raspon, umjesto tihog krivog usmjeravanja', () => {
    expect(() => toSemaforId(PROVIDER_BAND)).toThrow();
    expect(() => toEspnId(PROVIDER_BAND + 1)).toThrow();
  });
});
