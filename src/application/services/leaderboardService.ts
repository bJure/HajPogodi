import 'server-only';
import type { LeaderboardDto, LeaderboardRowDto } from '@/application/dto/leaderboard';
import { pollHintFor } from '@/domain/match/pollHint';
import { computeUserStats, type ScoredMatch } from '@/domain/stats/computeUserStats';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';
import {
  leaderboardRepository,
  predictionRepository,
} from '@/infrastructure/repositories/predictionRepository';
import { userRepository } from '@/infrastructure/repositories/userRepository';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Rebuilds a season's leaderboard from predictions and results.
 *
 * The table is a cache, not a source of truth: this function can always
 * regenerate it, which is why an admin correcting a result is safe and why the
 * "prerači ljestvicu" button exists.
 */
export async function recalculateLeaderboard(seasonId: string): Promise<number> {
  const [users, matches, predictions] = await Promise.all([
    userRepository.listActive(),
    matchRepository.listConfirmedBySeason(seasonId),
    predictionRepository.listBySeason(seasonId),
  ]);

  const scoredMatches = matches.filter((m) => m.result !== null && m.scoredAt !== null);

  const rows = users.map((user) => {
    const byMatch = new Map(
      predictions.filter((p) => p.userId === user.id).map((p) => [p.matchId, p] as const),
    );

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

    return {
      userId: user.id,
      nickname: user.nickname,
      points: stats.points,
      exactHits: stats.exactHits,
      played: stats.played,
      missed: stats.missed,
      accuracyPct: stats.accuracyPct,
      avgPoints: stats.avgPoints,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      worstStreak: stats.worstStreak,
      lastPredictionAt: stats.lastPredictionAt,
    };
  });

  /*
   * Ranking order, most to least significant:
   *   1. points          - the actual competition
   *   2. exact hits      - rewards accuracy over volume when points tie
   *   3. fewer played    - the same points from fewer guesses is a better record
   *   4. nickname        - deterministic, so equal players do not swap places
   *                        between two recalculations of identical data
   */
  const sorted = [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.exactHits - a.exactHits ||
      a.played - b.played ||
      a.nickname.localeCompare(b.nickname, 'hr'),
  );

  // Equal records share a rank; the next distinct record skips accordingly.
  let lastRank = 0;
  let lastKey = '';
  const ranked = sorted.map((row, index) => {
    const key = `${row.points}|${row.exactHits}|${row.played}`;
    if (key !== lastKey) {
      lastRank = index + 1;
      lastKey = key;
    }
    const { nickname: _nickname, ...rest } = row;
    return { ...rest, rank: lastRank };
  });

  await leaderboardRepository.replaceSeason(seasonId, ranked);
  logger.info({ seasonId, players: ranked.length }, 'ljestvica prerecunata');

  return ranked.length;
}

export async function getLeaderboard(
  seasonId: string,
  currentUserId: string,
  now: Date,
): Promise<LeaderboardDto> {
  const [season, entries, nextMatch, updatedAt] = await Promise.all([
    seasonRepository.findById(seasonId),
    leaderboardRepository.listBySeason(seasonId),
    matchRepository.findNextOpen(seasonId, now),
    leaderboardRepository.lastUpdatedAt(seasonId),
  ]);

  const rows: LeaderboardRowDto[] = entries.map((entry) => ({
    userId: entry.userId,
    nickname: entry.user.nickname,
    rank: entry.rank,
    points: entry.points,
    exactHits: entry.exactHits,
    played: entry.played,
    accuracyPct: entry.accuracyPct,
    avgPoints: entry.avgPoints,
    currentStreak: entry.currentStreak,
    bestStreak: entry.bestStreak,
    lastPredictionAt: entry.lastPredictionAt?.toISOString() ?? null,
    isCurrentUser: entry.userId === currentUserId,
  }));

  return {
    seasonId,
    seasonName: season?.name ?? 'Sezona',
    rows,
    updatedAt: (updatedAt ?? now).toISOString(),
    pollHint: pollHintFor(nextMatch?.kickoffAt ?? null, now),
  };
}
