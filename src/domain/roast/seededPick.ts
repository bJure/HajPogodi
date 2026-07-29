/**
 * Deterministic selection from a bank of options.
 *
 * Ported from the WorldCup project's `shared/mileVoice.ts`: an FNV-1a hash of a
 * seed string gives a stable index, so the same user on the same day always
 * sees the same message (testable, no flicker between server and client render)
 * while a new day produces a fresh one.
 */

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  // FNV-1a alone leaves neighbouring seeds correlated in the low bits, and we
  // reduce modulo small bank sizes (~12). Without this avalanche step, seeds
  // that differ only by one day collapse onto the same few combinations - we
  // measured 235 unique messages over 400 days instead of ~396. This is the
  // murmur3 finaliser; it only mixes bits, so results stay deterministic.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;

  return h >>> 0;
}

/** Picks one element deterministically. Returns null for an empty bank. */
export function seededPick<T>(bank: readonly T[], seed: string): T | null {
  if (bank.length === 0) return null;
  return bank[hashSeed(seed) % bank.length] ?? null;
}

/**
 * Picks from several banks with one seed while keeping the choices independent,
 * by salting the seed per slot. Without the salt, banks of equal length would
 * always move in lockstep and the combinations would collapse.
 */
export function seededPickSlot<T>(bank: readonly T[], seed: string, slot: string): T | null {
  return seededPick(bank, `${seed}|${slot}`);
}

/** Deterministic day bucket, so the roast rotates once per calendar day. */
export function dayBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}
