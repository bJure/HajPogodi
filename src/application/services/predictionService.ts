import 'server-only';
import type { PredictionDto, PredictionWithMatchDto } from '@/application/dto/prediction';
import type { MatchRow, PredictionRow } from '@/application/ports/repositories';
import { isOpenForPredictions, LOCK_MESSAGES, lockReason } from '@/domain/match/lockPolicy';
import { buildPredictionBoard, type BoardEntry } from '@/domain/prediction/predictionBoard';
import type { RuleHit } from '@/domain/scoring/ScoringRule';
import { Errors, domainError } from '@/domain/shared/DomainError';
import { toMatchDto } from '@/application/mappers/matchMapper';
import { throwDomain } from '@/lib/action';
import { matchRepository } from '@/infrastructure/repositories/matchRepository';
import { predictionRepository } from '@/infrastructure/repositories/predictionRepository';
import { userRepository } from '@/infrastructure/repositories/userRepository';
import { logger } from '@/infrastructure/logging/logger';

/**
 * The stored breakdown is JSON, so it is validated rather than cast - a schema
 * change or a hand-edited row must not crash the page that renders it.
 */
function parseBreakdown(value: unknown): RuleHit[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const hit = entry as Record<string, unknown>;
    if (
      typeof hit.ruleId !== 'string' ||
      typeof hit.label !== 'string' ||
      typeof hit.points !== 'number'
    ) {
      return [];
    }
    return [{ ruleId: hit.ruleId, label: hit.label, points: hit.points }];
  });
}

function toPredictionDto(row: PredictionRow): PredictionDto {
  const breakdown = parseBreakdown(row.score?.breakdown);
  return {
    id: row.id,
    matchId: row.matchId,
    userId: row.userId,
    nickname: row.user.nickname,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    submittedAt: row.submittedAt.toISOString(),
    editCount: row.editCount,
    points: row.score?.points ?? null,
    breakdown,
    exact: (row.score?.points ?? 0) > 0,
  };
}

export { toPredictionDto };

/**
 * Submits or edits a prediction.
 *
 * The lock is re-checked here against the freshly loaded match, not against
 * anything the client sent. A stale page, a replayed request or a hand-crafted
 * POST after kickoff all fail at this exact line.
 */
export async function submitPrediction(
  userId: string,
  input: { matchId: string; homeGoals: number; awayGoals: number },
  now: Date,
): Promise<PredictionDto> {
  const match = await matchRepository.findById(input.matchId);
  if (!match) throwDomain(Errors.notFound('Utakmica'));

  const lockable = {
    kickoffAt: match.kickoffAt,
    lockOverride: match.lockOverride,
    status: match.status,
    syncState: match.syncState,
  };

  if (!isOpenForPredictions(lockable, now)) {
    const reason = lockReason(lockable, now);
    throwDomain(
      reason === 'NOT_CONFIRMED'
        ? Errors.matchNotOpen()
        : domainError('PREDICTION_LOCKED', LOCK_MESSAGES[reason]),
    );
  }

  const saved = await predictionRepository.upsert({
    userId,
    matchId: input.matchId,
    homeGoals: input.homeGoals,
    awayGoals: input.awayGoals,
  });

  logger.info(
    { userId, matchId: input.matchId, score: `${input.homeGoals}:${input.awayGoals}` },
    'prognoza spremljena',
  );

  return toPredictionDto(saved);
}

export async function getMyPrediction(
  userId: string,
  matchId: string,
): Promise<PredictionDto | null> {
  const row = await predictionRepository.findByUserAndMatch(userId, matchId);
  return row ? toPredictionDto(row) : null;
}

/** History for the "my predictions" list, newest first. */
export async function listMyPredictions(
  userId: string,
  seasonId: string,
  now: Date,
): Promise<PredictionWithMatchDto[]> {
  const [matches, predictions] = await Promise.all([
    matchRepository.listConfirmedBySeason(seasonId),
    predictionRepository.listByUserAndSeason(userId, seasonId),
  ]);

  const byMatch = new Map(predictions.map((p) => [p.matchId, p] as const));

  return [...matches]
    .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime())
    .map((match) => {
      const prediction = byMatch.get(match.id);
      return {
        match: toMatchDto(match, now),
        prediction: prediction ? toPredictionDto(prediction) : null,
      };
    });
}

/**
 * All predictions for one match. Other players' picks stay hidden until the
 * match locks - otherwise the last person to submit could simply copy the
 * leader.
 */
export async function listMatchPredictions(
  match: MatchRow,
  now: Date,
  options: { revealBeforeLock: boolean },
): Promise<PredictionDto[]> {
  const locked = !isOpenForPredictions(
    {
      kickoffAt: match.kickoffAt,
      lockOverride: match.lockOverride,
      status: match.status,
      syncState: match.syncState,
    },
    now,
  );

  if (!locked && !options.revealBeforeLock) return [];

  const rows = await predictionRepository.listByMatch(match.id);
  return rows.map(toPredictionDto);
}

/**
 * Everyone's prediction for one match, including the players who never voted.
 *
 * Built from the active players outwards rather than from the predictions, so a
 * missing pick shows up as a gap instead of quietly disappearing from the list.
 */
export async function getPredictionBoard(matchId: string, now: Date): Promise<BoardEntry[]> {
  const match = await matchRepository.findById(matchId);
  if (!match) throwDomain(Errors.notFound('Utakmica'));

  // Same protection `listMatchPredictions` gets by returning an empty list: the
  // last person to submit must not be able to read the leader's pick first. It
  // is checked here against the freshly loaded match, never against the id the
  // client happened to ask for.
  if (
    isOpenForPredictions(
      {
        kickoffAt: match.kickoffAt,
        lockOverride: match.lockOverride,
        status: match.status,
        syncState: match.syncState,
      },
      now,
    )
  ) {
    throwDomain(
      domainError('FORBIDDEN', 'Prognoze ostalih vidljive su tek nakon zaključavanja.'),
    );
  }

  const [users, predictions] = await Promise.all([
    userRepository.listActive(),
    predictionRepository.listByMatch(matchId),
  ]);

  return buildPredictionBoard(users, predictions.map(toPredictionDto));
}

/** Recent finished matches with their results, for the home page. */
export async function listRecentResults(
  seasonId: string,
  userId: string,
  limit: number,
  now: Date,
): Promise<PredictionWithMatchDto[]> {
  const matches: MatchRow[] = await matchRepository.listRecentFinished(seasonId, limit);
  if (matches.length === 0) return [];

  // One query for all of them - asking per match cost `limit` extra round trips
  // to the database for a list that is never longer than a handful of rows.
  const predictions = await predictionRepository.listByUserAndMatches(
    userId,
    matches.map((match) => match.id),
  );
  const byMatch = new Map(predictions.map((p) => [p.matchId, p] as const));

  return matches.map((match) => {
    const prediction = byMatch.get(match.id);
    return {
      match: toMatchDto(match, now),
      prediction: prediction ? toPredictionDto(prediction) : null,
    };
  });
}
