import { ACHIEVEMENTS, type AchievementContext, type AchievementDefinition } from './definitions';

/**
 * Decides which achievements a user has newly earned.
 *
 * Idempotent by construction: already-unlocked codes are passed in and filtered
 * out, so re-running after a re-score never produces duplicate unlocks.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: readonly string[],
): AchievementDefinition[] {
  const owned = new Set(alreadyUnlocked);

  return ACHIEVEMENTS.filter(
    (achievement) => !owned.has(achievement.code) && achievement.isUnlocked(ctx),
  );
}
