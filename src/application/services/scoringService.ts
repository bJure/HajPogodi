import 'server-only';
import type { RuleHit } from '@/domain/scoring/ScoringRule';
import { scoreWithRuleIds } from '@/domain/scoring/ScoringEngine';
import { evaluateAchievements } from '@/domain/achievement/AchievementEvaluator';
import type { AchievementMatch } from '@/domain/achievement/definitions';
import { ourGoals } from '@/application/mappers/matchMapper';
import { logger } from '@/infrastructure/logging/logger';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';
import {
  leaderboardRepository,
  predictionRepository,
} from '@/infrastructure/repositories/predictionRepository';
import {
  achievementRepository,
  notificationRepository,
} from '@/infrastructure/repositories/supportRepositories';
import { userRepository } from '@/infrastructure/repositories/userRepository';
import { recalculateLeaderboard } from './leaderboardService';

/**
 * Turns a stored result into points, achievements and notifications.
 *
 * Idempotent end to end: existing scores for the match are cleared first, the
 * leaderboard is rebuilt from scratch, and achievement unlocks are filtered
 * against what the user already owns. Running it twice - or re-running it after
 * an admin corrects a result - produces the same final state.
 */
export interface ScoreMatchOutcome {
  readonly matchId: string;
  readonly scoredPredictions: number;
  readonly pointsAwarded: number;
  readonly achievementsUnlocked: number;
}

export async function scoreMatch(matchId: string): Promise<ScoreMatchOutcome> {
  const match = await matchRepository.findById(matchId);
  if (!match) throw new Error(`Utakmica ${matchId} ne postoji`);
  if (!match.result) throw new Error(`Utakmica ${matchId} nema rezultat`);

  const season = await seasonRepository.findById(match.seasonId);
  if (!season) throw new Error(`Sezona ${match.seasonId} ne postoji`);

  const predictions = await predictionRepository.listByMatch(matchId);

  // Wipe first so a re-score after a correction cannot leave stale points behind.
  await predictionRepository.clearScoresForMatch(matchId);

  let pointsAwarded = 0;

  for (const prediction of predictions) {
    const breakdown = scoreWithRuleIds(
      {
        prediction: { homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals },
        result: { homeGoals: match.result.homeGoals, awayGoals: match.result.awayGoals },
        isHome: match.isHome,
        competitionType: match.competition.type,
      },
      season.scoringRuleIds,
    );

    await predictionRepository.saveScore(
      prediction.id,
      breakdown.total,
      breakdown.hits as RuleHit[],
    );
    pointsAwarded += breakdown.total;
  }

  await matchRepository.update(matchId, { status: 'FINISHED', scoredAt: new Date() });

  await recalculateLeaderboard(match.seasonId);
  const achievementsUnlocked = await evaluateSeasonAchievements(match.seasonId);

  await notifyPointsReady(match.seasonId, matchId, match.opponent.shortName);

  logger.info(
    { matchId, scored: predictions.length, pointsAwarded, achievementsUnlocked },
    'utakmica obracunata',
  );

  return {
    matchId,
    scoredPredictions: predictions.length,
    pointsAwarded,
    achievementsUnlocked,
  };
}

/** Scores every finished-but-unscored match of a season, oldest first. */
export async function scorePendingMatches(seasonId: string): Promise<ScoreMatchOutcome[]> {
  const pending = await matchRepository.listUnscored(seasonId);
  const outcomes: ScoreMatchOutcome[] = [];

  for (const match of pending) {
    outcomes.push(await scoreMatch(match.id));
  }

  return outcomes;
}

/**
 * Re-evaluates achievements for everyone in the season. Cheap at this scale
 * (a handful of users, a few dozen matches) and far simpler to reason about
 * than incremental bookkeeping.
 */
export async function evaluateSeasonAchievements(seasonId: string): Promise<number> {
  const [matches, users, leaderboard] = await Promise.all([
    matchRepository.listConfirmedBySeason(seasonId),
    userRepository.listActive(),
    leaderboardRepository.listBySeason(seasonId),
  ]);

  const scoredMatches = matches.filter((m) => m.result !== null && m.scoredAt !== null);
  if (scoredMatches.length === 0) return 0;

  const predictionsBySeason = await predictionRepository.listBySeason(seasonId);
  const rankByUser = new Map(leaderboard.map((row) => [row.userId, row.rank]));

  // How many players nailed each match - the "lone wolf" achievement needs it.
  const exactCountByMatch = new Map<string, number>();
  for (const prediction of predictionsBySeason) {
    if ((prediction.score?.points ?? 0) > 0) {
      exactCountByMatch.set(
        prediction.matchId,
        (exactCountByMatch.get(prediction.matchId) ?? 0) + 1,
      );
    }
  }

  let unlocked = 0;

  for (const user of users) {
    const byMatch = new Map(
      predictionsBySeason
        .filter((p) => p.userId === user.id)
        .map((p) => [p.matchId, p] as const),
    );

    const history: AchievementMatch[] = scoredMatches.map((match) => {
      const prediction = byMatch.get(match.id);
      const points = prediction?.score?.points ?? 0;
      const goals = ourGoals(match);

      return {
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        opponent: match.opponent.name,
        competitionType: match.competition.type,
        isHome: match.isHome,
        predicted: prediction !== undefined,
        points,
        exact: points > 0,
        exactPredictorCount: exactCountByMatch.get(match.id) ?? 0,
        goalsFor: goals.goalsFor,
        goalsAgainst: goals.goalsAgainst,
      };
    });

    const owned = await achievementRepository.listCodesForUser(user.id, seasonId);
    const newlyEarned = evaluateAchievements(
      { history, rank: rankByUser.get(user.id) ?? users.length, totalPlayers: users.length },
      owned,
    );

    for (const achievement of newlyEarned) {
      await achievementRepository.unlock({
        userId: user.id,
        seasonId,
        achievementCode: achievement.code,
        context: { name: achievement.name },
      });
      unlocked += 1;
    }

    if (newlyEarned.length > 0) {
      await notificationRepository.createMany(
        newlyEarned.map((achievement) => ({
          userId: user.id,
          type: 'ACHIEVEMENT' as const,
          title: `Novo postignuće: ${achievement.name}`,
          body: achievement.description,
          matchId: null,
        })),
      );
    }
  }

  return unlocked;
}

async function notifyPointsReady(
  seasonId: string,
  matchId: string,
  opponent: string,
): Promise<void> {
  const users = await userRepository.listActive();
  const entries = await leaderboardRepository.listBySeason(seasonId);
  const rankByUser = new Map(entries.map((row) => [row.userId, row.rank]));

  await notificationRepository.createMany(
    users.map((user) => {
      const rank = rankByUser.get(user.id);
      return {
        userId: user.id,
        type: 'POINTS_READY' as const,
        title: 'Bodovi su obračunati',
        body: rank
          ? `Utakmica protiv ${opponent} je obračunata. Trenutno si ${rank}. na ljestvici.`
          : `Utakmica protiv ${opponent} je obračunata.`,
        matchId,
      };
    }),
  );
}
