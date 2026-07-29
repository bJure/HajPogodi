import 'server-only';

/**
 * Id namespacing across football data providers.
 *
 * Matches and teams are stored under the provider's own numeric ids, which was
 * safe while a single provider supplied everything. With two sources the raw
 * ids collide: ESPN team 489 is Hajduk, HNS club 489 is somebody else entirely,
 * and `upsertByApiTeamId` would happily merge the two into one club.
 *
 * Each provider therefore gets its own band. The offsets are far above any id
 * either provider issues today and still well inside `Number.MAX_SAFE_INTEGER`,
 * so the arithmetic stays exact.
 */
export const SEMAFOR_BAND = 800_000_000_000;
export const ESPN_BAND = 900_000_000_000;

export function toSemaforId(raw: number): number {
  return SEMAFOR_BAND + raw;
}

export function toEspnId(raw: number): number {
  return ESPN_BAND + raw;
}

/** True when a stored id came from HNS semafor - used by the composite router. */
export function isSemaforId(id: number): boolean {
  return id >= SEMAFOR_BAND && id < ESPN_BAND;
}

export function isEspnId(id: number): boolean {
  return id >= ESPN_BAND;
}

/** Strips the band so the id can be sent back to the provider it came from. */
export function stripBand(id: number): number {
  if (isEspnId(id)) return id - ESPN_BAND;
  if (isSemaforId(id)) return id - SEMAFOR_BAND;
  return id;
}
