import 'server-only';
import type { UserStatsDto } from '@/application/dto/leaderboard';
import { computeUserStats, type ScoredMatch } from '@/domain/stats/computeUserStats';
import { ACHIEVEMENTS } from '@/domain/achievement/definitions';
import { Errors } from '@/domain/shared/DomainError';
import { throwDomain } from '@/lib/action';
import { formatShortDate } from '@/lib/format';
import { matchRepository } from '@/infrastructure/repositories/matchRepository';
import {
  leaderboardRepository,
  predictionRepository,
} from '@/infrastructure/repositories/predictionRepository';
import { achievementRepository } from '@/infrastructure/repositories/supportRepositories';
import { userRepository } from '@/infrastructure/repositories/userRepository';

/**
 * Per-user season statistics, including the points-over-time series the chart
 * draws and the achievement showcase.
 *
 * The numbers are recomputed from predictions rather than read off the
 * leaderboard, so this page is also a cross-check: if it ever disagreed with
 * the table, the table is the thing that is stale.
 */
export async function getUserStats(userId: string, seasonId: string): Promise<UserStatsDto> {
  const user = await userRepository.findById(userId);
  if (!user) throwDomain(Errors.notFound('Korisnik'));

  const [matches, predictions, entries, unlocked] = await Promise.all([
    matchRepository.listConfirmedBySeason(seasonId),
    predictionRepository.listByUserAndSeason(userId, seasonId),
    leaderboardRepository.listBySeason(seasonId),
    achievementRepository.listForUser(userId, seasonId),
  ]);

  const byMatch = new Map(predictions.map((p) => [p.matchId, p] as const));
  const scoredMatches = matches.filter((m) => m.result !== null && m.scoredAt !== null);

  const history: ScoredMatch[] = scoredMatches.map((match) => {
    const prediction = byMatch.get(match.id);
    const points = prediction?.score?.points ?? 0;
    return {
      matchId: match.id,
      kickoffAt: match.kickoffAt,
      opponent: match.opponent.shortName,
      predicted: prediction !== undefined,
      points,
      exact: points > 0,
    };
  });

  const stats = computeUserStats(history);
  const myEntry = entries.find((entry) => entry.userId === userId);
  const unlockedAtByCode = new Map(
    unlocked.map((row) => [row.achievement.code, row.unlockedAt.toISOString()] as const),
  );

  return {
    userId,
    nickname: user.nickname,
    rank: myEntry?.rank ?? entries.length + 1,
    totalPlayers: Math.max(entries.length, 1),
    points: stats.points,
    played: stats.played,
    missed: stats.missed,
    exactHits: stats.exactHits,
    accuracyPct: stats.accuracyPct,
    avgPoints: stats.avgPoints,
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    worstStreak: stats.worstStreak,
    progression: stats.progression.map((point) => ({
      matchId: point.matchId,
      label: `${point.opponent} ${formatShortDate(point.kickoffAt.toISOString())}`,
      kickoffAt: point.kickoffAt.toISOString(),
      points: point.points,
      cumulative: point.cumulative,
    })),
    achievements: ACHIEVEMENTS.map((achievement) => ({
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      tier: achievement.tier,
      unlockedAt: unlockedAtByCode.get(achievement.code) ?? null,
    })),
  };
}
