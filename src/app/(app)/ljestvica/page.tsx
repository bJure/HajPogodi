import type { Metadata } from 'next';
import { getLeaderboard } from '@/application/services/leaderboardService';
import { Card, CardHeader } from '@/components/ui/Card';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { requirePageUser } from '@/infrastructure/auth/session';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';

export const metadata: Metadata = { title: 'Ljestvica' };
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const user = await requirePageUser();
  const season = await seasonRepository.findActive();

  if (!season) {
    return (
      <Card className="text-center">
        <p className="text-sm text-ink-muted">Nema aktivne sezone.</p>
      </Card>
    );
  }

  const leaderboard = await getLeaderboard(season.id, user.id, new Date());

  return (
    <div className="animate-[--animate-fade-up] space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Ljestvica</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {leaderboard.seasonName} · osvježava se sama nakon svakog obračuna.
        </p>
      </div>

      <Card strong>
        <CardHeader title="Poredak" subtitle={`${leaderboard.rows.length} igrača u igri`} />
        <LeaderboardTable initial={leaderboard} />
      </Card>

      <Card>
        <CardHeader title="Kako se boduje" />
        <ul className="space-y-2 text-sm text-ink-muted">
          <li className="flex gap-2">
            <span className="text-success">✓</span>
            <span>
              <span className="font-semibold text-ink">Točan rezultat</span> — 1 bod.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint">✗</span>
            <span>Sve ostalo — 0 bodova. Blizu se ne broji.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-ink-faint">↕</span>
            <span>
              Kod jednakog broja bodova ispred je onaj s manje odigranih prognoza — isti
              učinak iz manje pokušaja vrijedi više.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
