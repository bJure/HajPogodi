/**
 * When it makes sense to ask the football API for a final score.
 *
 * Hajduk plays roughly twice a week, so the poller must stay asleep almost all
 * the time. A match only enters its "result window" once it could plausibly be
 * over, and leaves it after a few hours so a postponed fixture cannot keep
 * burning the free tier's 100 requests per day.
 */

/** 90 minutes plus half-time and stoppage - earliest a full-time score exists. */
export const RESULT_WINDOW_OPENS_MIN = 105;
/** Covers extra time, penalties and long delays. */
export const RESULT_WINDOW_CLOSES_MIN = 300;
/** Hard cap on API calls per match before an admin has to step in. */
export const MAX_RESULT_POLL_ATTEMPTS = 40;

export interface PollableMatch {
  readonly kickoffAt: Date;
  readonly status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  readonly resultPollAttempts: number;
  readonly hasResult: boolean;
}

export function isInResultWindow(match: PollableMatch, now: Date): boolean {
  const elapsedMin = (now.getTime() - match.kickoffAt.getTime()) / 60_000;
  return elapsedMin >= RESULT_WINDOW_OPENS_MIN && elapsedMin <= RESULT_WINDOW_CLOSES_MIN;
}

/** The single predicate the poller uses to decide whether to spend a request. */
export function shouldPollForResult(match: PollableMatch, now: Date): boolean {
  if (match.hasResult) return false;
  if (match.status === 'CANCELLED' || match.status === 'POSTPONED') return false;
  if (match.resultPollAttempts >= MAX_RESULT_POLL_ATTEMPTS) return false;
  return isInResultWindow(match, now);
}

/** True once a match is over but still has no stored result - admin needs to know. */
export function needsManualAttention(match: PollableMatch, now: Date): boolean {
  if (match.hasResult) return false;
  if (match.status === 'CANCELLED' || match.status === 'POSTPONED') return false;
  const elapsedMin = (now.getTime() - match.kickoffAt.getTime()) / 60_000;
  return elapsedMin > RESULT_WINDOW_CLOSES_MIN;
}
