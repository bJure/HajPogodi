import 'server-only';
import { isLockImminent, LOCK_WARNING_MINUTES } from '@/domain/match/lockPolicy';
import { getLockNudge } from '@/application/services/roastService';
import { logger } from '@/infrastructure/logging/logger';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';
import { predictionRepository } from '@/infrastructure/repositories/predictionRepository';
import { notificationRepository } from '@/infrastructure/repositories/supportRepositories';
import { userRepository } from '@/infrastructure/repositories/userRepository';

/**
 * Nudges players who have not predicted the match that is about to lock.
 *
 * Only ever notifies people who actually still need to act, and the caller
 * guards it with a per-match job key so a player cannot be nagged twice for the
 * same kickoff.
 */
export interface LockReminderSummary {
  readonly matchId: string | null;
  readonly notified: number;
}

export async function runLockReminders(now: Date): Promise<LockReminderSummary> {
  const season = await seasonRepository.findActive();
  if (!season) return { matchId: null, notified: 0 };

  const next = await matchRepository.findNextOpen(season.id, now);
  if (!next) return { matchId: null, notified: 0 };

  const imminent = isLockImminent(
    {
      kickoffAt: next.kickoffAt,
      lockOverride: next.lockOverride,
      status: next.status,
      syncState: next.syncState,
    },
    now,
  );
  if (!imminent) return { matchId: null, notified: 0 };

  const [users, predictions] = await Promise.all([
    userRepository.listActive(),
    predictionRepository.listByMatch(next.id),
  ]);

  const predicted = new Set(predictions.map((p) => p.userId));
  const missing = users.filter((user) => !predicted.has(user.id));

  if (missing.length === 0) return { matchId: next.id, notified: 0 };

  const rows = await Promise.all(
    missing.map(async (user) => ({
      userId: user.id,
      type: 'LOCK_SOON' as const,
      title: `Još nemaš prognozu: ${next.opponent.shortName}`,
      body: await getLockNudge(user.id, user.nickname, season.id, now),
      matchId: next.id,
    })),
  );

  await notificationRepository.createMany(rows);

  logger.info(
    { matchId: next.id, notified: rows.length, withinMinutes: LOCK_WARNING_MINUTES },
    'poslani podsjetnici na zakljucavanje',
  );

  return { matchId: next.id, notified: rows.length };
}
