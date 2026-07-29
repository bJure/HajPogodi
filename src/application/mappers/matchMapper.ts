import 'server-only';
import type { AdminMatchDto, MatchDto } from '@/application/dto/match';
import type { MatchRow, MatchWithCountsRow } from '@/application/ports/repositories';
import { lockReason } from '@/domain/match/lockPolicy';
import { needsManualAttention } from '@/domain/match/resultWindow';

/** Our club's display name; matches are always shown Hajduk-relative. */
const OUR_CLUB = 'Hajduk';

export function toMatchDto(row: MatchRow, now: Date): MatchDto {
  const reason = lockReason(
    {
      kickoffAt: row.kickoffAt,
      lockOverride: row.lockOverride,
      status: row.status,
      syncState: row.syncState,
    },
    now,
  );

  return {
    id: row.id,
    opponent: {
      id: row.opponent.id,
      name: row.opponent.name,
      shortName: row.opponent.shortName,
      logoUrl: row.opponent.logoUrl,
    },
    competition: {
      id: row.competition.id,
      name: row.competition.name,
      shortName: row.competition.shortName,
      type: row.competition.type,
    },
    isHome: row.isHome,
    kickoffAt: row.kickoffAt.toISOString(),
    round: row.round,
    venue: row.venue,
    status: row.status,
    syncState: row.syncState,
    lockOverride: row.lockOverride,
    isLocked: reason !== 'OPEN',
    lockReason: reason,
    result: row.result
      ? {
          homeGoals: row.result.homeGoals,
          awayGoals: row.result.awayGoals,
          source: row.result.source,
          correctedAt: row.result.correctedAt?.toISOString() ?? null,
        }
      : null,
    scoredAt: row.scoredAt?.toISOString() ?? null,
    homeName: row.isHome ? OUR_CLUB : row.opponent.shortName,
    awayName: row.isHome ? row.opponent.shortName : OUR_CLUB,
  };
}

export function toAdminMatchDto(row: MatchWithCountsRow, now: Date): AdminMatchDto {
  return {
    ...toMatchDto(row, now),
    apiFootballFixtureId: row.apiFootballFixtureId,
    manualOverrides: row.manualOverrides,
    resultPollAttempts: row.resultPollAttempts,
    predictionCount: row._count.predictions,
    needsAttention: needsManualAttention(
      {
        kickoffAt: row.kickoffAt,
        status: row.status,
        resultPollAttempts: row.resultPollAttempts,
        hasResult: row.result !== null,
      },
      now,
    ),
  };
}

/** Goals from Hajduk's perspective, for stats and achievements. */
export function ourGoals(row: MatchRow): { goalsFor: number; goalsAgainst: number } {
  if (!row.result) return { goalsFor: 0, goalsAgainst: 0 };
  return row.isHome
    ? { goalsFor: row.result.homeGoals, goalsAgainst: row.result.awayGoals }
    : { goalsFor: row.result.awayGoals, goalsAgainst: row.result.homeGoals };
}
