import { NextResponse } from 'next/server';
import { pollHintFor } from '@/domain/match/pollHint';
import { toMatchDto } from '@/application/mappers/matchMapper';
import { getMyPrediction, listMatchPredictions } from '@/application/services/predictionService';
import { withRoute } from '@/lib/api';
import { requireUser } from '@/infrastructure/auth/session';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';

export const dynamic = 'force-dynamic';

/**
 * State of the next match plus my prediction.
 *
 * This is what turns the countdown into a real lock: once the server says the
 * match is locked, the form disables itself on the next poll even if the page
 * has been open since yesterday.
 */
export async function GET() {
  return withRoute('live/utakmica', async () => {
    const now = new Date();
    const [user, season] = await Promise.all([requireUser(), seasonRepository.findActive()]);

    if (!season) {
      return NextResponse.json({
        match: null,
        prediction: null,
        others: [],
        pollHint: pollHintFor(null, now),
      });
    }

    const next = await matchRepository.findNextOpen(season.id, now);

    if (!next) {
      return NextResponse.json({
        match: null,
        prediction: null,
        others: [],
        pollHint: pollHintFor(null, now),
      });
    }

    const [prediction, others] = await Promise.all([
      getMyPrediction(user.id, next.id),
      listMatchPredictions(next, now, { revealBeforeLock: false }),
    ]);

    return NextResponse.json({
      match: toMatchDto(next, now),
      prediction,
      others,
      pollHint: pollHintFor(next.kickoffAt, now),
    });
  });
}
