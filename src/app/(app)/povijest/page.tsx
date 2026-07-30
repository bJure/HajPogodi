import type { Metadata } from 'next';
import { listMyPredictions } from '@/application/services/predictionService';
import { Card, CardHeader } from '@/components/ui/Card';
import { ResultList } from '@/components/match/ResultList';
import { formatDateTime } from '@/lib/format';
import { requirePageUser } from '@/infrastructure/auth/session';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';

export const metadata: Metadata = { title: 'Povijest' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const [user, season] = await Promise.all([requirePageUser(), seasonRepository.findActive()]);

  if (!season) {
    return (
      <Card className="text-center">
        <p className="text-sm text-ink-muted">Nema aktivne sezone.</p>
      </Card>
    );
  }

  const all = await listMyPredictions(user.id, season.id, new Date());
  const played = all.filter((item) => item.match.result !== null);
  const upcoming = all
    .filter((item) => item.match.result === null && item.match.status !== 'CANCELLED')
    .reverse();

  return (
    <div className="animate-[--animate-fade-up] space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Povijest</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sve tvoje prognoze u sezoni {season.name}.
        </p>
      </div>

      <Card strong>
        <CardHeader
          title="Odigrano"
          subtitle={`${played.filter((i) => (i.prediction?.points ?? 0) > 0).length} pogodaka u ${played.length} utakmica`}
        />
        <ResultList items={played} emptyLabel="Još nijedna utakmica nije odigrana." />
      </Card>

      <Card>
        <CardHeader title="Nadolazeće" subtitle="Prognoze koje još možeš mijenjati." />

        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nema zakazanih utakmica.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map(({ match, prediction }) => (
              <li
                key={match.id}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {match.homeName} <span className="text-ink-faint">–</span> {match.awayName}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {formatDateTime(match.kickoffAt)} · {match.competition.shortName}
                  </span>
                </span>

                {prediction ? (
                  <span className="tabular shrink-0 rounded-lg bg-white/8 px-2.5 py-1 text-sm font-bold text-ink">
                    {prediction.homeGoals} : {prediction.awayGoals}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold">
                    bez prognoze
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
