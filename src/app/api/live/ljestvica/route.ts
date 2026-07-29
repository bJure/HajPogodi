import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/application/services/leaderboardService';
import { withRoute } from '@/lib/api';
import { requireUser } from '@/infrastructure/auth/session';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';

export const dynamic = 'force-dynamic';

/** Polled by the leaderboard page so new points appear without a refresh. */
export async function GET() {
  return withRoute('live/ljestvica', async () => {
    const user = await requireUser();
    const season = await seasonRepository.findActive();

    if (!season) {
      return NextResponse.json({
        seasonId: null,
        seasonName: null,
        rows: [],
        updatedAt: new Date().toISOString(),
        pollHint: { mode: 'idle', intervalMs: 300_000 },
      });
    }

    const leaderboard = await getLeaderboard(season.id, user.id, new Date());
    return NextResponse.json(leaderboard);
  });
}
