import type { PredictionWithMatchDto } from '@/application/dto/prediction';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Recent results next to what the user predicted. A hit is marked green, a miss
 * stays neutral - nobody needs a red X on every row of a season.
 */
export function ResultList({
  items,
  emptyLabel = 'Još nema odigranih utakmica.',
}: {
  items: readonly PredictionWithMatchDto[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map(({ match, prediction }) => {
        const hit = (prediction?.points ?? 0) > 0;

        return (
          <li
            key={match.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-2.5',
              hit ? 'border-success/30 bg-success/8' : 'border-white/8 bg-white/3',
            )}
          >
            <span className="w-11 shrink-0 text-[11px] text-ink-faint">
              {formatShortDate(match.kickoffAt)}
            </span>

            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {match.homeName} <span className="text-ink-faint">–</span> {match.awayName}
            </span>

            <span className="tabular shrink-0 text-sm font-bold text-ink">
              {match.result ? `${match.result.homeGoals}:${match.result.awayGoals}` : '–'}
            </span>

            <span className="tabular w-14 shrink-0 text-right text-xs text-ink-muted">
              {prediction ? `${prediction.homeGoals}:${prediction.awayGoals}` : '—'}
            </span>

            <span
              className={cn(
                'w-8 shrink-0 text-right text-xs font-bold',
                hit ? 'text-success' : 'text-ink-faint',
              )}
            >
              {prediction?.points === null || prediction === null
                ? '—'
                : `+${prediction.points ?? 0}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
