/**
 * How often the browser should re-fetch, derived from the schedule.
 *
 * The server computes this and ships it inside every live payload, so the
 * client never has to guess and we never poll hard on a quiet Tuesday.
 */
export const POLL_INTERVAL_MS = {
  live: 15_000,
  today: 60_000,
  idle: 300_000,
} as const;

export type PollMode = keyof typeof POLL_INTERVAL_MS;

export interface PollHint {
  readonly mode: PollMode;
  readonly intervalMs: number;
}

/** Window before kickoff during which we treat the match as effectively live. */
const PRE_KICKOFF_HOT_MIN = 15;
/** Window after kickoff during which results may land at any moment. */
const POST_KICKOFF_HOT_MIN = 300;

export function pollHintFor(nextKickoffAt: Date | null, now: Date): PollHint {
  if (!nextKickoffAt) return { mode: 'idle', intervalMs: POLL_INTERVAL_MS.idle };

  const diffMin = (nextKickoffAt.getTime() - now.getTime()) / 60_000;

  // Kickoff is imminent, or the match is running / awaiting its result.
  if (diffMin <= PRE_KICKOFF_HOT_MIN && diffMin >= -POST_KICKOFF_HOT_MIN) {
    return { mode: 'live', intervalMs: POLL_INTERVAL_MS.live };
  }

  if (diffMin > PRE_KICKOFF_HOT_MIN && diffMin <= 24 * 60) {
    return { mode: 'today', intervalMs: POLL_INTERVAL_MS.today };
  }

  return { mode: 'idle', intervalMs: POLL_INTERVAL_MS.idle };
}
