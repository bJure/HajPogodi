import 'server-only';

/**
 * Id namespacing across football data providers.
 *
 * Matches and teams are stored under the provider's own numeric ids, which was
 * safe while a single provider supplied everything. With two sources the raw
 * ids collide: ESPN team 489 is Hajduk, HNS club 489 is somebody else entirely,
 * and `upsertByApiTeamId` would happily merge the two into one club.
 *
 * ESPN ids are therefore shifted into a band above every id HNS issues, and the
 * band doubles as the routing rule - the poller reads the band off a stored id
 * to know which provider to ask. HNS ids are left as they are, so there is only
 * ever one offset to reason about.
 *
 * The band has to respect the column type: `apiFootballFixtureId` is a Prisma
 * `Int`, so Postgres stores INT4 and anything past 2_147_483_647 fails on
 * write. With the band at 1e9, ESPN's current ids (~4.0e8) land near 1.4e9 and
 * roughly 7e8 of headroom is left.
 */
export const PROVIDER_BAND = 1_000_000_000;

/** Largest value an INT4 column accepts. */
const INT4_MAX = 2_147_483_647;

function assertFits(raw: number, provider: string): void {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error(`${provider}: id nije prirodan broj (${raw})`);
  }
  // Loud on the way in beats a misrouted poll or a silent overflow later.
  if (raw >= PROVIDER_BAND) {
    throw new Error(`${provider}: id ${raw} je prerastao raspon od ${PROVIDER_BAND}`);
  }
}

/** HNS semafor keeps its own ids; the band is reserved for the other provider. */
export function toSemaforId(raw: number): number {
  assertFits(raw, 'semafor');
  return raw;
}

export function toEspnId(raw: number): number {
  assertFits(raw, 'espn');
  const banded = PROVIDER_BAND + raw;
  if (banded > INT4_MAX) {
    throw new Error(`espn: id ${banded} ne stane u INT4 stupac`);
  }
  return banded;
}

export function isEspnId(id: number): boolean {
  return id >= PROVIDER_BAND;
}

export function isSemaforId(id: number): boolean {
  return id >= 0 && id < PROVIDER_BAND;
}

/** Strips the band so the id can be sent back to the provider it came from. */
export function stripBand(id: number): number {
  return isEspnId(id) ? id - PROVIDER_BAND : id;
}
