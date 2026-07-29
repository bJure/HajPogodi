import 'server-only';
import { autoConfirmHorizon, shouldAutoConfirm } from '@/domain/match/confirmPolicy';
import { logger } from '@/infrastructure/logging/logger';
import { matchRepository } from '@/infrastructure/repositories/matchRepository';
import { auditRepository } from '@/infrastructure/repositories/supportRepositories';

export interface AutoConfirmSummary {
  readonly checked: number;
  readonly confirmed: number;
}

/**
 * Publishes synced matches once kickoff is close enough.
 *
 * Kept as its own step rather than folded into the fixture sync: the sync runs
 * once a day and only when a provider answers, while this has to keep working
 * on the days nothing is fetched at all. It is one indexed query when there is
 * nothing to do.
 *
 * The audit trail records these as a separate action with no actor, so a match
 * that appeared on its own is distinguishable from one an admin confirmed.
 */
export async function runAutoConfirm(now: Date): Promise<AutoConfirmSummary> {
  const candidates = await matchRepository.listDueForAutoConfirm(autoConfirmHorizon(now));

  let confirmed = 0;

  for (const match of candidates) {
    // The query narrows; the policy decides.
    if (!shouldAutoConfirm(match, now)) continue;

    await matchRepository.update(match.id, { syncState: 'CONFIRMED', updatedById: null });

    await auditRepository.record({
      actorId: null,
      action: 'MATCH_AUTO_CONFIRM',
      entity: 'Match',
      entityId: match.id,
      after: { syncState: 'CONFIRMED', kickoffAt: match.kickoffAt.toISOString() },
    });

    confirmed += 1;
    logger.info(
      { matchId: match.id, kickoffAt: match.kickoffAt.toISOString() },
      'utakmica automatski potvrdena',
    );
  }

  return { checked: candidates.length, confirmed };
}
