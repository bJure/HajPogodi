import 'server-only';
import type { LeaderboardDto, LeaderboardRowDto } from '@/application/dto/leaderboard';
import type { SeasonRow } from '@/application/ports/repositories';
import { pollHintFor } from '@/domain/match/pollHint';
import { computeUserStats, type ScoredMatch } from '@/domain/stats/computeUserStats';
import { matchRepository } from '@/infrastructure/repositories/matchRepository';
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

/**
 * Reads the stored table for a season.
 *
 * The season and the next kickoff are passed in rather than looked up: every
 * caller already holds them, and re-reading them here cost two extra database
 * round trips on the home page, which is the slowest page in the app.
 *
 * `nextKickoffAt` may be a promise so that a caller who still has to fetch the
 * next match can hand it over unresolved - it only feeds the poll interval, so
 * it is awaited after the table query has already been sent rather than before.
 */
export async function getLeaderboard(
  season: SeasonRow,
  currentUserId: string,
  now: Date,
  nextKickoffAt: Date | null | Promise<Date | null>,
): Promise<LeaderboardDto> {
  const entries = await leaderboardRepository.listBySeason(season.id);

  // `updatedAt` of the newest row is the table's age - the rows are rewritten
  // wholesale by `replaceSeason`, so a separate MAX query told us nothing the
  // rows we just loaded did not already say.
  const updatedAt = entries.reduce<Date | null>(
    (latest, entry) =>
      latest === null || entry.updatedAt > latest ? entry.updatedAt : latest,
    null,
  );

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
    seasonId: season.id,
    seasonName: season.name,
    rows,
    updatedAt: (updatedAt ?? now).toISOString(),
    pollHint: pollHintFor(await nextKickoffAt, now),
  };
}
