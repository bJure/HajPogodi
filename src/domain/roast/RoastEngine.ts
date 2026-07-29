import { bodovi, kola } from './croatian';
import { dayBucket, hashSeed, seededPickSlot } from './seededPick';
import { extractSignals, type RoastContext, type RoastSignals } from './signals';
import { TEMPLATES } from './templates';
import { pickTone, type Tone } from './tone';

/**
 * Composes a personalised roast.
 *
 * Pure and deterministic: the same context on the same day always yields the
 * same text, which keeps server and client renders identical and makes the
 * whole thing unit-testable. Rotation comes from the day bucket in the seed.
 */
export interface Roast {
  readonly text: string;
  readonly tone: Tone;
  readonly signals: RoastSignals;
  /** Stable fingerprint of the inputs - used as the AI cache key. */
  readonly contextHash: string;
}

export interface RoastOptions {
  readonly userId: string;
  readonly seasonId: string;
  readonly now: Date;
  /** Extra salt so the same user can get a different line in a different place. */
  readonly variant?: string;
}

function placeholders(ctx: RoastContext): Record<string, string> {
  return {
    nick: ctx.nickname,
    rank: String(ctx.rank),
    total: String(ctx.totalPlayers),
    points: bodovi(ctx.points),
    gap: bodovi(ctx.gapToLeader),
    gapNext: bodovi(ctx.gapToNext),
    streak: kola(Math.max(ctx.scorelessStreak, ctx.hitStreak)),
    acc: String(Math.round(ctx.accuracyPct)),
  };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function buildContextHash(ctx: RoastContext, dayKey: string): string {
  const parts = [
    dayKey,
    ctx.rank,
    ctx.totalPlayers,
    ctx.points,
    ctx.gapToLeader,
    ctx.gapToNext,
    ctx.lastThree.join(','),
    Math.round(ctx.accuracyPct),
    ctx.scorelessStreak,
    ctx.hitStreak,
    ctx.matchesPlayed,
    ctx.rankDelta,
  ].join(':');

  return hashSeed(parts).toString(36);
}

export function generateRoast(ctx: RoastContext, options: RoastOptions): Roast {
  const signals = extractSignals(ctx);
  const tone = pickTone(signals);
  const bank = TEMPLATES[tone];

  const dayKey = dayBucket(options.now);
  const seed = [options.userId, options.seasonId, dayKey, options.variant ?? 'home', tone].join(':');
  const values = placeholders(ctx);

  // Each slot gets its own salt so banks of equal length do not move in lockstep,
  // which would collapse the number of reachable combinations.
  const parts = (['opener', 'jab', 'twist', 'closer'] as const).map((slot) => {
    const picked = seededPickSlot(bank[slot], seed, slot);
    return picked ? fill(picked, values) : '';
  });

  return {
    text: parts.filter(Boolean).join(' '),
    tone,
    signals,
    contextHash: buildContextHash(ctx, dayKey),
  };
}

/**
 * Theoretical size of the message space, used by tests and shown in the admin
 * panel so the "at least 300 messages" requirement is verifiable rather than
 * asserted.
 */
export function messageSpaceSize(): number {
  return Object.values(TEMPLATES).reduce(
    (sum, bank) =>
      sum + bank.opener.length * bank.jab.length * bank.twist.length * bank.closer.length,
    0,
  );
}
