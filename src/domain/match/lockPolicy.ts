/**
 * Lock rules for predictions.
 *
 * Deliberately computed rather than stored: if locking depended on a background
 * job having flipped a flag, a missed cron run would leave predictions open
 * after kickoff. Here, correctness holds even if no job ever runs.
 */

export interface LockableMatch {
  readonly kickoffAt: Date;
  /** null = automatic, true = admin locked early, false = admin reopened. */
  readonly lockOverride: boolean | null;
  readonly status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  readonly syncState: 'NEEDS_CONFIRMATION' | 'CONFIRMED';
}

export type LockReason =
  | 'OPEN'
  | 'ADMIN_LOCKED'
  | 'KICKOFF_PASSED'
  | 'NOT_CONFIRMED'
  | 'MATCH_OVER'
  | 'CANCELLED';

/** Minutes before kickoff at which the UI starts warning about the lock. */
export const LOCK_WARNING_MINUTES = 60;

export function lockReason(match: LockableMatch, now: Date): LockReason {
  if (match.syncState !== 'CONFIRMED') return 'NOT_CONFIRMED';
  if (match.status === 'CANCELLED') return 'CANCELLED';

  // An explicit admin decision wins over everything below it, in both
  // directions: it can close a match early or reopen one after kickoff.
  if (match.lockOverride === true) return 'ADMIN_LOCKED';
  if (match.lockOverride === false) return 'OPEN';

  if (match.status === 'FINISHED') return 'MATCH_OVER';
  if (match.status === 'LIVE') return 'KICKOFF_PASSED';
  if (now.getTime() >= match.kickoffAt.getTime()) return 'KICKOFF_PASSED';

  return 'OPEN';
}

export function isLocked(match: LockableMatch, now: Date): boolean {
  return lockReason(match, now) !== 'OPEN';
}

export function isOpenForPredictions(match: LockableMatch, now: Date): boolean {
  return !isLocked(match, now);
}

/** Milliseconds until automatic lock; 0 once kickoff has passed. */
export function msUntilLock(match: LockableMatch, now: Date): number {
  return Math.max(0, match.kickoffAt.getTime() - now.getTime());
}

/** True inside the window where the UI nags the user to submit. */
export function isLockImminent(match: LockableMatch, now: Date): boolean {
  if (isLocked(match, now)) return false;
  return msUntilLock(match, now) <= LOCK_WARNING_MINUTES * 60_000;
}

export const LOCK_MESSAGES: Record<LockReason, string> = {
  OPEN: 'Prognoze su otvorene.',
  ADMIN_LOCKED: 'Administrator je zaključao prognoze za ovu utakmicu.',
  KICKOFF_PASSED: 'Utakmica je počela — prognoze su zaključane.',
  NOT_CONFIRMED: 'Utakmica još čeka potvrdu administratora.',
  MATCH_OVER: 'Utakmica je odigrana.',
  CANCELLED: 'Utakmica je otkazana.',
};
