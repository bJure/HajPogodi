import 'server-only';
import type { FootballApiPort } from '@/application/ports/services';
import { shouldPollForResult } from '@/domain/match/resultWindow';
import { scoreMatch } from '@/application/services/scoringService';
import { logger } from '@/infrastructure/logging/logger';
import { compositeFootballApi } from '@/infrastructure/football/compositeClient';
import {
  matchRepository,
  matchResultRepository,
} from '@/infrastructure/repositories/matchRepository';

/**
 * Fetches final scores for matches that have just finished, then scores them.
 *
 * This is the whole "automatic" story, and it is deliberately lazy: it does
 * nothing at all unless a match is inside its result window, so the cron tick
 * that fires between matches costs one indexed query and returns.
 */
export interface PollResultsSummary {
  readonly checked: number;
  readonly resolved: number;
  readonly stillPending: number;
  readonly failed: number;
}

export async function runPollResults(
  now: Date,
  api: FootballApiPort = compositeFootballApi,
): Promise<PollResultsSummary> {
  const candidates = await matchRepository.listAwaitingResult(now);

  if (candidates.length === 0) {
    return { checked: 0, resolved: 0, stillPending: 0, failed: 0 };
  }

  let resolved = 0;
  let stillPending = 0;
  let failed = 0;

  for (const match of candidates) {
    // The SQL query narrows; the domain rule decides.
    const pollable = {
      kickoffAt: match.kickoffAt,
      status: match.status,
      resultPollAttempts: match.resultPollAttempts,
      hasResult: match.result !== null,
    };
    if (!shouldPollForResult(pollable, now)) continue;

    if (match.apiFootballFixtureId === null) {
      // Manually created match - only an admin can enter its result.
      stillPending += 1;
      continue;
    }

    try {
      await matchRepository.update(match.id, {
        resultPollAttempts: match.resultPollAttempts + 1,
        lastPolledAt: now,
      });

      const fixture = await api.getFixture(match.apiFootballFixtureId);

      if (!fixture) {
        stillPending += 1;
        continue;
      }

      if (fixture.status === 'POSTPONED' || fixture.status === 'CANCELLED') {
        await matchRepository.update(match.id, { status: fixture.status });
        logger.info({ matchId: match.id, status: fixture.status }, 'utakmica odgodena ili otkazana');
        continue;
      }

      if (fixture.status !== 'FINISHED' || !fixture.score) {
        stillPending += 1;
        continue;
      }

      await matchResultRepository.upsert({
        matchId: match.id,
        homeGoals: fixture.score.homeGoals,
        awayGoals: fixture.score.awayGoals,
        source: 'API',
        rawPayload: fixture.raw,
        correctedById: null,
        correctionNote: null,
      });

      await scoreMatch(match.id);
      resolved += 1;
    } catch (error) {
      failed += 1;
      logger.error({ err: error, matchId: match.id }, 'dohvat rezultata nije uspio');
    }
  }

  const summary = { checked: candidates.length, resolved, stillPending, failed };
  logger.info(summary, 'provjera rezultata gotova');
  return summary;
}
