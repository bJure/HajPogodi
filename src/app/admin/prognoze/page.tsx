import type { Metadata } from 'next';
import { toMatchDto } from '@/application/mappers/matchMapper';
import { toPredictionDto } from '@/application/services/predictionService';
import { Card, CardHeader } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';
import { requirePageAdmin } from '@/infrastructure/auth/session';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';
import { predictionRepository } from '@/infrastructure/repositories/predictionRepository';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Prognoze' };
export const dynamic = 'force-dynamic';

/**
 * Read-only view of everyone's predictions, per match.
 *
 * Admins see picks even before a match locks - they need to, to answer "did my
 * submission go through?" - but this screen never offers a way to edit someone
 * else's prediction. Corrections happen through the result, not the picks.
 */
export default async function AdminPredictionsPage() {
  await requirePageAdmin();
  const season = await seasonRepository.findActive();

  if (!season) {
    return (
      <Card className="text-center">
        <p className="text-sm text-ink-muted">Nema aktivne sezone.</p>
      </Card>
    );
  }

  const now = new Date();
  const matches = await matchRepository.listConfirmedBySeason(season.id);
  const ordered = [...matches].sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime());

  const withPredictions = await Promise.all(
    ordered.map(async (match) => ({
      match: toMatchDto(match, now),
      predictions: (await predictionRepository.listByMatch(match.id)).map(toPredictionDto),
    })),
  );

  const nonEmpty = withPredictions.filter((entry) => entry.predictions.length > 0);

  return (
    <div className="space-y-5">
      {nonEmpty.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-ink-muted">Još nema nijedne prognoze.</p>
        </Card>
      ) : (
        nonEmpty.map(({ match, predictions }) => (
          <Card key={match.id}>
            <CardHeader
              title={`${match.homeName} – ${match.awayName}`}
              subtitle={`${formatDateTime(match.kickoffAt)} · ${match.competition.shortName}${
                match.result ? ` · završeno ${match.result.homeGoals}:${match.result.awayGoals}` : ''
              }`}
              action={
                <span className="text-xs text-ink-faint">{predictions.length} prognoza</span>
              }
            />

            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {predictions.map((prediction) => (
                <li
                  key={prediction.id}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-2',
                    prediction.exact
                      ? 'border-success/30 bg-success/8'
                      : 'border-white/8 bg-white/3',
                  )}
                >
                  <span className="min-w-0 truncate text-sm text-ink">{prediction.nickname}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular text-sm font-bold text-ink">
                      {prediction.homeGoals}:{prediction.awayGoals}
                    </span>
                    {prediction.points !== null ? (
                      <span
                        className={cn(
                          'text-xs font-bold',
                          prediction.exact ? 'text-success' : 'text-ink-faint',
                        )}
                      >
                        +{prediction.points}
                      </span>
                    ) : null}
                    {prediction.editCount > 0 ? (
                      <span
                        className="text-[10px] text-ink-faint"
                        title={`Mijenjano ${prediction.editCount}×`}
                      >
                        ✎{prediction.editCount}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
