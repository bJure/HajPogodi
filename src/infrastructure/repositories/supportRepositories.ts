import 'server-only';
import type {
  AchievementRepository,
  AuditRepository,
  JobRunRepository,
  LoginAttemptRepository,
  NotificationRepository,
  RoastCacheRepository,
} from '@/application/ports/repositories';
import { prisma } from '@/infrastructure/db/prisma';

export const achievementRepository: AchievementRepository = {
  listCatalogue: () => prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } }),

  listForUser: (userId, seasonId) =>
    prisma.userAchievement.findMany({
      where: { userId, seasonId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    }),

  listCodesForUser: async (userId, seasonId) => {
    const rows = await prisma.userAchievement.findMany({
      where: { userId, seasonId },
      select: { achievement: { select: { code: true } } },
    });
    return rows.map((row) => row.achievement.code);
  },

  unlock: async ({ userId, seasonId, achievementCode, context }) => {
    const achievement = await prisma.achievement.findUnique({
      where: { code: achievementCode },
      select: { id: true },
    });
    if (!achievement) return;

    // The unique constraint is the real guard; skipDuplicates keeps a concurrent
    // re-score from turning a harmless race into an error.
    await prisma.userAchievement.createMany({
      data: [
        {
          userId,
          seasonId,
          achievementId: achievement.id,
          context: (context ?? undefined) as never,
        },
      ],
      skipDuplicates: true,
    });
  },
};

export const notificationRepository: NotificationRepository = {
  listForUser: (userId, limit) =>
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),

  countUnread: (userId) => prisma.notification.count({ where: { userId, readAt: null } }),

  createMany: async (rows) => {
    if (rows.length === 0) return;
    await prisma.notification.createMany({ data: rows });
  },

  markAllRead: async (userId) => {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};

export const auditRepository: AuditRepository = {
  record: async (entry) => {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  },

  list: (limit) =>
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { nickname: true } } },
    }),
};

export const loginAttemptRepository: LoginAttemptRepository = {
  record: async (username, ip, success) => {
    await prisma.loginAttempt.create({ data: { username, ip, success } });
  },

  countRecentFailures: async (username, ip, since) => {
    const [byUsername, byIp] = await Promise.all([
      prisma.loginAttempt.count({
        where: { username, success: false, createdAt: { gte: since } },
      }),
      prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
    ]);
    return { byUsername, byIp };
  },

  clearFor: async (username) => {
    await prisma.loginAttempt.deleteMany({ where: { username, success: false } });
  },
};

export const roastCacheRepository: RoastCacheRepository = {
  find: async (userId, contextHash, now) => {
    const row = await prisma.roastMessage.findFirst({
      where: { userId, contextHash, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: 'desc' },
      select: { text: true, tone: true },
    });
    return row ?? null;
  },

  save: async (data) => {
    await prisma.roastMessage.create({ data: { ...data, shownAt: new Date() } });
  },
};

export const jobRunRepository: JobRunRepository = {
  /**
   * The idempotency gate. `runKey` is unique, so a duplicated cron trigger loses
   * the insert race and gets `false` back instead of running the job twice.
   */
  claim: async (jobName, runKey) => {
    try {
      await prisma.jobRun.create({ data: { jobName, runKey, status: 'RUNNING' } });
      return true;
    } catch {
      return false;
    }
  },

  finish: async (runKey, summary) => {
    await prisma.jobRun.update({
      where: { runKey },
      data: { status: 'SUCCESS', finishedAt: new Date(), summary: (summary ?? undefined) as never },
    });
  },

  fail: async (runKey, error) => {
    await prisma.jobRun.update({
      where: { runKey },
      data: { status: 'FAILED', finishedAt: new Date(), error: error.slice(0, 1000) },
    });
  },

  lastRun: async (jobName) => {
    const row = await prisma.jobRun.findFirst({
      where: { jobName, status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    });
    return row ?? null;
  },
};
