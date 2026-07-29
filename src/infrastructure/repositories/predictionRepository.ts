import 'server-only';
import type {
  LeaderboardRepository,
  PredictionRepository,
} from '@/application/ports/repositories';
import { prisma } from '@/infrastructure/db/prisma';

const PREDICTION_INCLUDE = {
  score: true,
  user: { select: { id: true, nickname: true } },
} as const;

export const predictionRepository: PredictionRepository = {
  findByUserAndMatch: (userId, matchId) =>
    prisma.prediction.findUnique({
      where: { userId_matchId: { userId, matchId } },
      include: PREDICTION_INCLUDE,
    }),

  listByMatch: (matchId) =>
    prisma.prediction.findMany({
      where: { matchId },
      include: PREDICTION_INCLUDE,
      orderBy: { submittedAt: 'asc' },
    }),

  listByUserAndSeason: (userId, seasonId) =>
    prisma.prediction.findMany({
      where: { userId, match: { seasonId } },
      include: PREDICTION_INCLUDE,
      orderBy: { match: { kickoffAt: 'desc' } },
    }),

  listBySeason: (seasonId) =>
    prisma.prediction.findMany({
      where: { match: { seasonId } },
      include: PREDICTION_INCLUDE,
    }),

  upsert: (data) =>
    prisma.prediction.upsert({
      where: { userId_matchId: { userId: data.userId, matchId: data.matchId } },
      create: {
        userId: data.userId,
        matchId: data.matchId,
        homeGoals: data.homeGoals,
        awayGoals: data.awayGoals,
      },
      update: {
        homeGoals: data.homeGoals,
        awayGoals: data.awayGoals,
        submittedAt: new Date(),
        editCount: { increment: 1 },
      },
      include: PREDICTION_INCLUDE,
    }),

  saveScore: async (predictionId, points, breakdown) => {
    const payload = { points, breakdown: breakdown as never, scoredAt: new Date() };
    await prisma.predictionScore.upsert({
      where: { predictionId },
      create: { predictionId, ...payload },
      update: payload,
    });
  },

  // Used before a re-score after an admin corrects a result.
  clearScoresForMatch: async (matchId) => {
    await prisma.predictionScore.deleteMany({ where: { prediction: { matchId } } });
  },
};

export const leaderboardRepository: LeaderboardRepository = {
  listBySeason: (seasonId) =>
    prisma.leaderboardEntry.findMany({
      where: { seasonId },
      orderBy: { rank: 'asc' },
      include: { user: { select: { id: true, nickname: true } } },
    }),

  findByUser: (seasonId, userId) =>
    prisma.leaderboardEntry.findUnique({
      where: { seasonId_userId: { seasonId, userId } },
      include: { user: { select: { id: true, nickname: true } } },
    }),

  /**
   * Rebuilds a season's table in one transaction. Delete-then-insert keeps the
   * operation idempotent: running it twice produces byte-identical rows, which
   * is what makes re-scoring safe.
   */
  replaceSeason: async (seasonId, rows) => {
    await prisma.$transaction([
      prisma.leaderboardEntry.deleteMany({ where: { seasonId } }),
      prisma.leaderboardEntry.createMany({
        data: rows.map((row) => ({ seasonId, ...row })),
      }),
    ]);
  },

  lastUpdatedAt: async (seasonId) => {
    const latest = await prisma.leaderboardEntry.findFirst({
      where: { seasonId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return latest?.updatedAt ?? null;
  },
};
