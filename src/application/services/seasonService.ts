import 'server-only';
import type { SeasonDto } from '@/application/dto/season';
import { Errors } from '@/domain/shared/DomainError';
import { throwDomain } from '@/lib/action';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';
import { auditRepository } from '@/infrastructure/repositories/supportRepositories';
import { recalculateLeaderboard } from './leaderboardService';

export async function listSeasons(): Promise<SeasonDto[]> {
  const rows = await seasonRepository.list();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    apiYear: row.apiYear,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    isActive: row.isActive,
    scoringRuleIds: row.scoringRuleIds,
    matchCount: row._count.matches,
  }));
}

export async function createSeason(
  actorId: string,
  input: {
    name: string;
    apiYear: number;
    startsAt: Date;
    endsAt: Date;
    scoringRuleIds: string[];
  },
): Promise<string> {
  const season = await seasonRepository.create({ ...input, createdById: actorId });

  await auditRepository.record({
    actorId,
    action: 'SEASON_CREATE',
    entity: 'Season',
    entityId: season.id,
    after: { name: season.name, apiYear: season.apiYear },
  });

  return season.id;
}

export async function updateSeason(
  actorId: string,
  input: {
    id: string;
    name: string;
    apiYear: number;
    startsAt: Date;
    endsAt: Date;
    scoringRuleIds: string[];
  },
): Promise<void> {
  const before = await seasonRepository.findById(input.id);
  if (!before) throwDomain(Errors.notFound('Sezona'));

  await seasonRepository.update(input.id, { ...input, updatedById: actorId });

  await auditRepository.record({
    actorId,
    action: 'SEASON_UPDATE',
    entity: 'Season',
    entityId: input.id,
    before: { name: before.name, scoringRuleIds: before.scoringRuleIds },
    after: { name: input.name, scoringRuleIds: input.scoringRuleIds },
  });

  // Changing the rule set changes what past matches were worth, so the table
  // must be rebuilt rather than left describing the old rules.
  if (before.scoringRuleIds.join(',') !== input.scoringRuleIds.join(',')) {
    await recalculateLeaderboard(input.id);
  }
}

export async function activateSeason(actorId: string, seasonId: string): Promise<void> {
  const season = await seasonRepository.findById(seasonId);
  if (!season) throwDomain(Errors.notFound('Sezona'));

  await seasonRepository.activate(seasonId);

  await auditRepository.record({
    actorId,
    action: 'SEASON_ACTIVATE',
    entity: 'Season',
    entityId: seasonId,
    after: { name: season.name },
  });
}
