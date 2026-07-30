import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/application/services/leaderboardService';
import { withRoute } from '@/lib/api';
import { requireUser } from '@/infrastructure/auth/session';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';

export const dynamic = 'force-dynamic';

/** Polled by the leaderboard page so new points appear without a refresh. */
export async function GET() {
  return withRoute('live/ljestvica', async () => {
    const now = new Date();
    const [user, season] = await Promise.all([requireUser(), seasonRepository.findActive()]);

    if (!season) {
      return NextResponse.json({
        seasonId: null,
        seasonName: null,
        rows: [],
        updatedAt: new Date().toISOString(),
        pollHint: { mode: 'idle', intervalMs: 300_000 },
      });
    }

    // Handed over unresolved so the table query does not wait on it.
    const nextKickoffAt = matchRepository
      .findNextOpen(season.id, now)
      .then((match) => match?.kickoffAt ?? null);

    const leaderboard = await getLeaderboard(season, user.id, now, nextKickoffAt);
    return NextResponse.json(leaderboard);
  });
}
