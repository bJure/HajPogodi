/**
 * When a synced match stops waiting for an admin and becomes visible on its own.
 *
 * Synced fixtures arrive as NEEDS_CONFIRMATION so nobody predicts against data
 * the provider got wrong. That gate is worth having weeks out, when kickoff
 * times are still provisional - but it turns into a trap close to the match: a
 * fixture nobody happened to confirm is invisible, and the round passes with no
 * predictions at all.
 *
 * Three days out the schedule has settled, so the gate opens by itself. An
 * admin can still correct anything afterwards; confirmation is about visibility,
 * not about freezing the data.
 */
export const AUTO_CONFIRM_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AutoConfirmableMatch {
  readonly kickoffAt: Date;
  readonly syncState: 'NEEDS_CONFIRMATION' | 'CONFIRMED';
  readonly status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
}

/** The latest kickoff that is close enough to confirm right now. */
export function autoConfirmHorizon(now: Date): Date {
  return new Date(now.getTime() + AUTO_CONFIRM_DAYS * DAY_MS);
}

export function shouldAutoConfirm(match: AutoConfirmableMatch, now: Date): boolean {
  if (match.syncState === 'CONFIRMED') return false;

  /**
   * A postponed match has a kickoff time that no longer means anything, and a
   * cancelled one will never be played. Publishing either would invite
   * predictions on a match that is not going to happen at that hour.
   */
  if (match.status === 'POSTPONED' || match.status === 'CANCELLED') return false;

  return match.kickoffAt.getTime() <= autoConfirmHorizon(now).getTime();
}
