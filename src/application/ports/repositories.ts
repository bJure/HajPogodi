import type { Prisma } from '@prisma/client';

/**
 * Persistence contracts the application layer depends on.
 *
 * They live here rather than in `infrastructure` so the dependency arrow always
 * points inward: services import these interfaces, and the composition root is
 * the only place that knows a Prisma implementation exists. Tests substitute
 * in-memory fakes without touching a database.
 *
 * The row shapes are intentionally the Prisma models themselves - inventing a
 * parallel set of entity classes for a schema this size would be ceremony with
 * no payoff. Mapping to DTOs happens in `application/mappers`.
 */

export type UserRow = Prisma.UserGetPayload<object>;
export type SeasonRow = Prisma.SeasonGetPayload<object>;
export type CompetitionRow = Prisma.CompetitionGetPayload<object>;
export type TeamRow = Prisma.TeamGetPayload<object>;
export type MatchRow = Prisma.MatchGetPayload<{
  include: { opponent: true; competition: true; result: true };
}>;
export type MatchWithCountsRow = Prisma.MatchGetPayload<{
  include: { opponent: true; competition: true; result: true; _count: { select: { predictions: true } } };
}>;
export type PredictionRow = Prisma.PredictionGetPayload<{
  include: { score: true; user: { select: { id: true; nickname: true } } };
}>;
export type LeaderboardRow = Prisma.LeaderboardEntryGetPayload<{
  include: { user: { select: { id: true; nickname: true } } };
}>;
export type AchievementRow = Prisma.AchievementGetPayload<object>;
export type UserAchievementRow = Prisma.UserAchievementGetPayload<{ include: { achievement: true } }>;
export type NotificationRow = Prisma.NotificationGetPayload<object>;

export interface UserRepository {
  findById(id: string): Promise<UserRow | null>;
  findByUsername(username: string): Promise<UserRow | null>;
  list(): Promise<UserRow[]>;
  listActive(): Promise<UserRow[]>;
  create(data: {
    username: string;
    passwordHash: string;
    nickname: string;
    role: 'ADMIN' | 'USER';
    createdById: string | null;
  }): Promise<UserRow>;
  update(id: string, data: { nickname?: string; role?: 'ADMIN' | 'USER'; updatedById: string }): Promise<UserRow>;
  setActive(id: string, isActive: boolean, updatedById: string): Promise<UserRow>;
  setPassword(id: string, passwordHash: string, mustChange: boolean, updatedById: string | null): Promise<UserRow>;
  markLogin(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  countAdmins(excludingId?: string): Promise<number>;
}

export interface SeasonRepository {
  findById(id: string): Promise<SeasonRow | null>;
  findActive(): Promise<SeasonRow | null>;
  list(): Promise<(SeasonRow & { _count: { matches: number } })[]>;
  create(data: {
    name: string;
    apiYear: number;
    startsAt: Date;
    endsAt: Date;
    scoringRuleIds: string[];
    createdById: string | null;
  }): Promise<SeasonRow>;
  update(
    id: string,
    data: {
      name: string;
      apiYear: number;
      startsAt: Date;
      endsAt: Date;
      scoringRuleIds: string[];
      updatedById: string;
    },
  ): Promise<SeasonRow>;
  activate(id: string): Promise<void>;
}

export interface CompetitionRepository {
  list(): Promise<CompetitionRow[]>;
  findByApiLeagueId(leagueId: number): Promise<CompetitionRow | null>;
  upsertByApiLeagueId(data: {
    apiFootballLeagueId: number;
    name: string;
    shortName: string;
    type: 'LEAGUE' | 'CUP' | 'EUROPE' | 'FRIENDLY';
    logoUrl: string | null;
  }): Promise<CompetitionRow>;
}

export interface TeamRepository {
  list(): Promise<TeamRow[]>;
  findOurClub(): Promise<TeamRow | null>;
  upsertByApiTeamId(data: {
    apiFootballTeamId: number;
    name: string;
    shortName: string;
    logoUrl: string | null;
  }): Promise<TeamRow>;
}

export interface MatchRepository {
  findById(id: string): Promise<MatchRow | null>;
  findByFixtureId(fixtureId: number): Promise<MatchRow | null>;
  listBySeason(seasonId: string): Promise<MatchWithCountsRow[]>;
  listConfirmedBySeason(seasonId: string): Promise<MatchRow[]>;
  /** Next confirmed match that has not kicked off yet. */
  findNextOpen(seasonId: string, now: Date): Promise<MatchRow | null>;
  /** Confirmed matches whose result window may be open. */
  listAwaitingResult(now: Date): Promise<MatchRow[]>;
  /** Unconfirmed matches close enough to kickoff to publish themselves. */
  listDueForAutoConfirm(horizon: Date): Promise<MatchRow[]>;
  /** Finished matches with a stored result that have not been scored yet. */
  listUnscored(seasonId: string): Promise<MatchRow[]>;
  listRecentFinished(seasonId: string, limit: number): Promise<MatchRow[]>;
  create(data: {
    seasonId: string;
    competitionId: string;
    opponentId: string;
    isHome: boolean;
    kickoffAt: Date;
    round: string | null;
    venue: string | null;
    syncState: 'NEEDS_CONFIRMATION' | 'CONFIRMED';
    apiFootballFixtureId: number | null;
    createdById: string | null;
  }): Promise<MatchRow>;
  update(
    id: string,
    data: Partial<{
      competitionId: string;
      opponentId: string;
      isHome: boolean;
      kickoffAt: Date;
      round: string | null;
      venue: string | null;
      status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
      syncState: 'NEEDS_CONFIRMATION' | 'CONFIRMED';
      lockOverride: boolean | null;
      manualOverrides: string[];
      resultPollAttempts: number;
      lastPolledAt: Date | null;
      scoredAt: Date | null;
      updatedById: string | null;
    }>,
  ): Promise<MatchRow>;
  delete(id: string): Promise<void>;
}

export interface MatchResultRepository {
  upsert(data: {
    matchId: string;
    homeGoals: number;
    awayGoals: number;
    source: 'API' | 'MANUAL';
    rawPayload: unknown;
    correctedById: string | null;
    correctionNote: string | null;
  }): Promise<void>;
}

export interface PredictionRepository {
  findByUserAndMatch(userId: string, matchId: string): Promise<PredictionRow | null>;
  listByMatch(matchId: string): Promise<PredictionRow[]>;
  listByUserAndSeason(userId: string, seasonId: string): Promise<PredictionRow[]>;
  listBySeason(seasonId: string): Promise<PredictionRow[]>;
  upsert(data: {
    userId: string;
    matchId: string;
    homeGoals: number;
    awayGoals: number;
  }): Promise<PredictionRow>;
  saveScore(predictionId: string, points: number, breakdown: unknown): Promise<void>;
  clearScoresForMatch(matchId: string): Promise<void>;
}

export interface LeaderboardRepository {
  listBySeason(seasonId: string): Promise<LeaderboardRow[]>;
  findByUser(seasonId: string, userId: string): Promise<LeaderboardRow | null>;
  replaceSeason(
    seasonId: string,
    rows: {
      userId: string;
      rank: number;
      points: number;
      exactHits: number;
      played: number;
      missed: number;
      accuracyPct: number;
      avgPoints: number;
      currentStreak: number;
      bestStreak: number;
      worstStreak: number;
      lastPredictionAt: Date | null;
    }[],
  ): Promise<void>;
  lastUpdatedAt(seasonId: string): Promise<Date | null>;
}

export interface AchievementRepository {
  listCatalogue(): Promise<AchievementRow[]>;
  listForUser(userId: string, seasonId: string): Promise<UserAchievementRow[]>;
  listCodesForUser(userId: string, seasonId: string): Promise<string[]>;
  unlock(data: {
    userId: string;
    seasonId: string;
    achievementCode: string;
    context: unknown;
  }): Promise<void>;
}

export interface NotificationRepository {
  listForUser(userId: string, limit: number): Promise<NotificationRow[]>;
  countUnread(userId: string): Promise<number>;
  createMany(
    rows: {
      userId: string;
      type: 'MATCH_OPEN' | 'LOCK_SOON' | 'POINTS_READY' | 'ACHIEVEMENT';
      title: string;
      body: string;
      matchId: string | null;
    }[],
  ): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export interface AuditRepository {
  record(entry: {
    actorId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void>;
  list(limit: number): Promise<Prisma.AuditLogGetPayload<{ include: { actor: { select: { nickname: true } } } }>[]>;
}

export interface LoginAttemptRepository {
  record(username: string, ip: string, success: boolean): Promise<void>;
  countRecentFailures(username: string, ip: string, since: Date): Promise<{ byUsername: number; byIp: number }>;
  clearFor(username: string): Promise<void>;
}

export interface RoastCacheRepository {
  find(userId: string, contextHash: string, now: Date): Promise<{ text: string; tone: string } | null>;
  save(data: {
    userId: string;
    seasonId: string;
    tone: string;
    text: string;
    source: 'GENERATED' | 'AI' | 'SEED';
    contextHash: string;
    expiresAt: Date;
  }): Promise<void>;
}

export interface JobRunRepository {
  /** Returns false when this run key was already claimed - the idempotency gate. */
  claim(jobName: string, runKey: string): Promise<boolean>;
  finish(runKey: string, summary: unknown): Promise<void>;
  fail(runKey: string, error: string): Promise<void>;
  lastRun(jobName: string): Promise<{ startedAt: Date; status: string } | null>;
}
