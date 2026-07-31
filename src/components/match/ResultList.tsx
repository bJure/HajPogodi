'use client';

import { useCallback, useState } from 'react';
import type { PredictionWithMatchDto } from '@/application/dto/prediction';
import type { BoardEntry } from '@/domain/prediction/predictionBoard';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Recent results next to what the user predicted. A hit is marked green, a miss
 * stays neutral - nobody needs a red X on every row of a season.
 *
 * A played row expands to show what everybody else wrote; there the colours are
 * blunt, because that list is short and the whole point of it is who was right.
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
      {items.map((item) => (
        <ResultRow key={item.match.id} item={item} />
      ))}
    </ul>
  );
}

type BoardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entries: BoardEntry[] }
  | { status: 'error'; message: string };

function ResultRow({ item }: { item: PredictionWithMatchDto }) {
  const { match, prediction } = item;
  const hit = (prediction?.points ?? 0) > 0;
  // Without a result there is nothing to reveal, so the row stays a plain row.
  const expandable = match.result !== null;

  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<BoardState>({ status: 'idle' });

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);

    // A finished match never changes, so one successful fetch is enough for the
    // life of the page - reopening the row must not ask again.
    if (!next || board.status === 'ready' || board.status === 'loading') return;

    setBoard({ status: 'loading' });

    try {
      const response = await fetch(`/api/utakmica/${match.id}/prognoze`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      const payload = (await response.json()) as { entries?: BoardEntry[]; error?: string };

      if (!response.ok) {
        setBoard({ status: 'error', message: payload.error ?? 'Ne mogu dohvatiti prognoze.' });
        return;
      }

      setBoard({ status: 'ready', entries: payload.entries ?? [] });
    } catch {
      setBoard({ status: 'error', message: 'Ne mogu dohvatiti prognoze.' });
    }
  }, [board.status, match.id, open]);

  const summary = (
    <>
      <span className="w-11 shrink-0 text-[11px] text-ink-faint">
        {formatShortDate(match.kickoffAt)}
      </span>

      <span className="min-w-0 flex-1 truncate text-left text-sm text-ink">
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
        {prediction?.points === null || prediction === null ? '—' : `+${prediction.points ?? 0}`}
      </span>
    </>
  );

  return (
    <li
      className={cn(
        'rounded-xl border',
        hit ? 'border-success/30 bg-success/8' : 'border-white/8 bg-white/3',
      )}
    >
      {expandable ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/4"
        >
          {summary}
          <span
            aria-hidden
            className={cn(
              'shrink-0 text-[10px] text-ink-faint transition-transform',
              open && 'rotate-90',
            )}
          >
            ▶
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">{summary}</div>
      )}

      {open ? (
        <div className="border-t border-white/8 px-3 py-3">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Prognoze ostalih
          </p>
          <PredictionBoard state={board} />
        </div>
      ) : null}
    </li>
  );
}

function PredictionBoard({ state }: { state: BoardState }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <p className="text-sm text-ink-muted">Učitavam…</p>;
  }

  if (state.status === 'error') {
    return <p className="text-sm text-danger">{state.message}</p>;
  }

  if (state.entries.length === 0) {
    return <p className="text-sm text-ink-muted">Nitko nije upisao prognozu.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {state.entries.map((entry) => (
        <li key={entry.userId} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-ink-muted">{entry.nickname}</span>

          {entry.prediction === null ? (
            <span className="shrink-0 text-xs text-ink-faint">nema prognoze</span>
          ) : (
            <span
              className={cn(
                'tabular shrink-0 font-semibold',
                entry.hit ? 'text-success' : 'text-danger',
              )}
            >
              {entry.prediction.homeGoals} : {entry.prediction.awayGoals}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
