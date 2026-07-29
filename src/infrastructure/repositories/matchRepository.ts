import 'server-only';
import type {
  CompetitionRepository,
  MatchRepository,
  MatchResultRepository,
  SeasonRepository,
  TeamRepository,
} from '@/application/ports/repositories';
import { prisma } from '@/infrastructure/db/prisma';
import {
  RESULT_WINDOW_CLOSES_MIN,
  RESULT_WINDOW_OPENS_MIN,
  MAX_RESULT_POLL_ATTEMPTS,
} from '@/domain/match/resultWindow';

const MATCH_INCLUDE = { opponent: true, competition: true, result: true } as const;

export const seasonRepository: SeasonRepository = {
  findById: (id) => prisma.season.findUnique({ where: { id } }),

  findActive: () => prisma.season.findFirst({ where: { isActive: true } }),

  list: () =>
    prisma.season.findMany({
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { matches: true } } },
    }),

  create: (data) =>
    prisma.season.create({
      data: { ...data, updatedById: data.createdById },
    }),

  update: (id, data) => prisma.season.update({ where: { id }, data }),

  // Exactly one season may be active; both writes must land together.
  activate: async (id) => {
    await prisma.$transaction([
      prisma.season.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.season.update({ where: { id }, data: { isActive: true } }),
    ]);
  },
};

export const competitionRepository: CompetitionRepository = {
  list: () => prisma.competition.findMany({ orderBy: { name: 'asc' } }),

  findByApiLeagueId: (leagueId) =>
    prisma.competition.findUnique({ where: { apiFootballLeagueId: leagueId } }),

  upsertByApiLeagueId: (data) =>
    prisma.competition.upsert({
      where: { apiFootballLeagueId: data.apiFootballLeagueId },
      create: data,
      // Name and logo may legitimately change upstream; type is our own mapping.
      update: { name: data.name, logoUrl: data.logoUrl },
    }),
};

export const teamRepository: TeamRepository = {
  list: () => prisma.team.findMany({ orderBy: { name: 'asc' } }),

  findOurClub: () => prisma.team.findFirst({ where: { isOurClub: true } }),

  upsertByApiTeamId: (data) =>
    prisma.team.upsert({
      where: { apiFootballTeamId: data.apiFootballTeamId },
      create: data,
      update: { name: data.name, logoUrl: data.logoUrl },
    }),
};

export const matchRepository: MatchRepository = {
  findById: (id) => prisma.match.findUnique({ where: { id }, include: MATCH_INCLUDE }),

  findByFixtureId: (fixtureId) =>
    prisma.match.findUnique({
      where: { apiFootballFixtureId: fixtureId },
      include: MATCH_INCLUDE,
    }),

  listBySeason: (seasonId) =>
    prisma.match.findMany({
      where: { seasonId },
      orderBy: { kickoffAt: 'asc' },
      include: { ...MATCH_INCLUDE, _count: { select: { predictions: true } } },
    }),

  listConfirmedBySeason: (seasonId) =>
    prisma.match.findMany({
      where: { seasonId, syncState: 'CONFIRMED' },
      orderBy: { kickoffAt: 'asc' },
      include: MATCH_INCLUDE,
    }),

  findNextOpen: (seasonId, now) =>
    prisma.match.findFirst({
      where: {
        seasonId,
        syncState: 'CONFIRMED',
        status: { notIn: ['CANCELLED', 'POSTPONED'] },
        kickoffAt: { gte: now },
      },
      orderBy: { kickoffAt: 'asc' },
      include: MATCH_INCLUDE,
    }),

  // Narrowed in SQL to the result window so the poller never loads the whole
  // season just to discard it; the exact predicate is re-checked in the domain.
  listAwaitingResult: (now) =>
    prisma.match.findMany({
      where: {
        syncState: 'CONFIRMED',
        result: null,
        status: { notIn: ['CANCELLED', 'POSTPONED'] },
        resultPollAttempts: { lt: MAX_RESULT_POLL_ATTEMPTS },
        kickoffAt: {
          gte: new Date(now.getTime() - RESULT_WINDOW_CLOSES_MIN * 60_000),
          lte: new Date(now.getTime() - RESULT_WINDOW_OPENS_MIN * 60_000),
        },
      },
      orderBy: { kickoffAt: 'asc' },
      include: MATCH_INCLUDE,
    }),

  listUnscored: (seasonId) =>
    prisma.match.findMany({
      where: { seasonId, syncState: 'CONFIRMED', scoredAt: null, result: { isNot: null } },
      orderBy: { kickoffAt: 'asc' },
      include: MATCH_INCLUDE,
    }),

  listRecentFinished: (seasonId, limit) =>
    prisma.match.findMany({
      where: { seasonId, syncState: 'CONFIRMED', result: { isNot: null } },
      orderBy: { kickoffAt: 'desc' },
      take: limit,
      include: MATCH_INCLUDE,
    }),

  create: (data) => prisma.match.create({ data, include: MATCH_INCLUDE }),

  update: (id, data) => prisma.match.update({ where: { id }, data, include: MATCH_INCLUDE }),

  delete: async (id) => {
    await prisma.match.delete({ where: { id } });
  },
};

export const matchResultRepository: MatchResultRepository = {
  upsert: async (data) => {
    const payload = {
      homeGoals: data.homeGoals,
      awayGoals: data.awayGoals,
      source: data.source,
      rawPayload: (data.rawPayload ?? undefined) as never,
      correctedById: data.correctedById,
      correctionNote: data.correctionNote,
      correctedAt: data.source === 'MANUAL' ? new Date() : null,
    };

    await prisma.matchResult.upsert({
      where: { matchId: data.matchId },
      create: { matchId: data.matchId, ...payload },
      update: payload,
    });
  },
};
