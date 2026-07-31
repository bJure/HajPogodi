import { NextResponse } from 'next/server';
import { getPredictionBoard } from '@/application/services/predictionService';
import { withRoute } from '@/lib/api';
import { requireUser } from '@/infrastructure/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Everyone's prediction for one match, fetched when a result row is expanded.
 *
 * Deliberately outside `/api/live`: this is asked once per click for a finished
 * match, so it takes no part in polling.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return withRoute('utakmica/prognoze', async () => {
    const [{ matchId }] = await Promise.all([params, requireUser()]);
    const entries = await getPredictionBoard(matchId, new Date());

    return NextResponse.json({ entries });
  });
}
