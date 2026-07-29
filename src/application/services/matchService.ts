import 'server-only';
import type { AdminMatchDto } from '@/application/dto/match';
import { Errors } from '@/domain/shared/DomainError';
import { toAdminMatchDto } from '@/application/mappers/matchMapper';
import { throwDomain } from '@/lib/action';
import { logger } from '@/infrastructure/logging/logger';
import {
  matchRepository,
  matchResultRepository,
} from '@/infrastructure/repositories/matchRepository';
import { auditRepository } from '@/infrastructure/repositories/supportRepositories';
import { scoreMatch } from './scoringService';
import { recalculateLeaderboard } from './leaderboardService';

/**
 * Admin operations on matches.
 *
 * The theme throughout: the admin corrects, the sync proposes. Any field an
 * admin edits is recorded in `manualOverrides` so a later sync leaves it alone.
 */
export async function listSeasonMatches(seasonId: string, now: Date): Promise<AdminMatchDto[]> {
  const rows = await matchRepository.listBySeason(seasonId);
  return rows.map((row) => toAdminMatchDto(row, now));
}

export async function createMatch(
  actorId: string,
  input: {
    seasonId: string;
    competitionId: string;
    opponentId: string;
    isHome: boolean;
    kickoffAt: Date;
    round?: string;
    venue?: string;
  },
): Promise<string> {
  const match = await matchRepository.create({
    seasonId: input.seasonId,
    competitionId: input.competitionId,
    opponentId: input.opponentId,
    isHome: input.isHome,
    kickoffAt: input.kickoffAt,
    round: input.round ?? null,
    venue: input.venue ?? null,
    // Hand-created matches are trusted immediately - an admin just typed them.
    syncState: 'CONFIRMED',
    apiFootballFixtureId: null,
    createdById: actorId,
  });

  await auditRepository.record({
    actorId,
    action: 'MATCH_CREATE',
    entity: 'Match',
    entityId: match.id,
    after: { opponentId: input.opponentId, kickoffAt: input.kickoffAt, isHome: input.isHome },
  });

  return match.id;
}

export async function updateMatch(
  actorId: string,
  input: {
    id: string;
    competitionId: string;
    opponentId: string;
    isHome: boolean;
    kickoffAt: Date;
    round?: string;
    venue?: string;
  },
): Promise<void> {
  const before = await matchRepository.findById(input.id);
  if (!before) throwDomain(Errors.notFound('Utakmica'));

  // Record which fields the admin has taken ownership of, so the next sync
  // does not silently undo this edit.
  const overrides = new Set(before.manualOverrides);
  if (before.competitionId !== input.competitionId) overrides.add('competitionId');
  if (before.opponentId !== input.opponentId) overrides.add('opponentId');
  if (before.isHome !== input.isHome) overrides.add('isHome');
  if (before.kickoffAt.getTime() !== input.kickoffAt.getTime()) overrides.add('kickoffAt');
  if (before.round !== (input.round ?? null)) overrides.add('round');
  if (before.venue !== (input.venue ?? null)) overrides.add('venue');

  await matchRepository.update(input.id, {
    competitionId: input.competitionId,
    opponentId: input.opponentId,
    isHome: input.isHome,
    kickoffAt: input.kickoffAt,
    round: input.round ?? null,
    venue: input.venue ?? null,
    manualOverrides: [...overrides],
    updatedById: actorId,
  });

  await auditRepository.record({
    actorId,
    action: 'MATCH_UPDATE',
    entity: 'Match',
    entityId: input.id,
    before: {
      competitionId: before.competitionId,
      opponentId: before.opponentId,
      isHome: before.isHome,
      kickoffAt: before.kickoffAt,
    },
    after: {
      competitionId: input.competitionId,
      opponentId: input.opponentId,
      isHome: input.isHome,
      kickoffAt: input.kickoffAt,
    },
  });
}

export async function confirmMatch(actorId: string, matchId: string): Promise<void> {
  const match = await matchRepository.findById(matchId);
  if (!match) throwDomain(Errors.notFound('Utakmica'));

  await matchRepository.update(matchId, { syncState: 'CONFIRMED', updatedById: actorId });

  await auditRepository.record({
    actorId,
    action: 'MATCH_CONFIRM',
    entity: 'Match',
    entityId: matchId,
    after: { syncState: 'CONFIRMED' },
  });

  logger.info({ actorId, matchId }, 'utakmica potvrdena');
}

export async function setMatchLock(
  actorId: string,
  matchId: string,
  lockOverride: boolean | null,
): Promise<void> {
  const match = await matchRepository.findById(matchId);
  if (!match) throwDomain(Errors.notFound('Utakmica'));

  await matchRepository.update(matchId, { lockOverride, updatedById: actorId });

  await auditRepository.record({
    actorId,
    action: 'MATCH_LOCK_OVERRIDE',
    entity: 'Match',
    entityId: matchId,
    before: { lockOverride: match.lockOverride },
    after: { lockOverride },
  });
}

/**
 * Manual result entry or correction.
 *
 * Always followed by a full re-score: old scores are wiped, points recomputed
 * and the leaderboard rebuilt, so a correction can never leave the table
 * describing a result that no longer exists.
 */
export async function setMatchResult(
  actorId: string,
  input: { matchId: string; homeGoals: number; awayGoals: number; note?: string },
): Promise<void> {
  const match = await matchRepository.findById(input.matchId);
  if (!match) throwDomain(Errors.notFound('Utakmica'));

  const before = match.result
    ? { homeGoals: match.result.homeGoals, awayGoals: match.result.awayGoals }
    : null;

  await matchResultRepository.upsert({
    matchId: input.matchId,
    homeGoals: input.homeGoals,
    awayGoals: input.awayGoals,
    source: 'MANUAL',
    rawPayload: null,
    correctedById: actorId,
    correctionNote: input.note ?? null,
  });

  await scoreMatch(input.matchId);

  await auditRepository.record({
    actorId,
    action: before ? 'MATCH_RESULT_CORRECT' : 'MATCH_RESULT_SET',
    entity: 'Match',
    entityId: input.matchId,
    before,
    after: { homeGoals: input.homeGoals, awayGoals: input.awayGoals, note: input.note ?? null },
  });

  logger.warn(
    { actorId, matchId: input.matchId, before, after: `${input.homeGoals}:${input.awayGoals}` },
    'rezultat rucno postavljen',
  );
}

export async function deleteMatch(actorId: string, matchId: string): Promise<void> {
  const match = await matchRepository.findById(matchId);
  if (!match) throwDomain(Errors.notFound('Utakmica'));

  await auditRepository.record({
    actorId,
    action: 'MATCH_DELETE',
    entity: 'Match',
    entityId: matchId,
    before: { opponentId: match.opponentId, kickoffAt: match.kickoffAt },
  });

  await matchRepository.delete(matchId);
  await recalculateLeaderboard(match.seasonId);
}
