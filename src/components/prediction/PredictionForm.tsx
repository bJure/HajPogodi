'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchDto } from '@/application/dto/match';
import type { PredictionDto } from '@/application/dto/prediction';
import { LOCK_MESSAGES } from '@/domain/match/lockPolicy';
import { SubmitButton } from '@/components/ui/Button';
import { FormError, FormSuccess } from '@/components/ui/Field';
import { submitPredictionAction } from '@/app/(app)/pocetna/actions';
import { cn } from '@/lib/utils';

const MAX_GOALS = 20;

function GoalPicker({
  name,
  label,
  value,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="max-w-full truncate text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </span>

      <div className="flex w-full items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label={`Smanji ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-9 w-9 shrink-0 rounded-lg border border-white/12 text-lg leading-none text-ink-muted transition-colors hover:bg-white/5 disabled:opacity-30"
        >
          −
        </button>

        <input
          type="number"
          name={name}
          min={0}
          max={MAX_GOALS}
          required
          disabled={disabled}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next)) return;
            onChange(Math.min(MAX_GOALS, Math.max(0, Math.trunc(next))));
          }}
          aria-label={`Golovi: ${label}`}
          className="tabular h-16 min-w-0 max-w-16 flex-1 rounded-xl border border-white/12 bg-navy-950/60 text-center text-3xl font-bold text-ink [appearance:textfield] focus:border-hajduk-red/60 focus:outline-none disabled:opacity-60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          aria-label={`Povećaj ${label}`}
          disabled={disabled || value >= MAX_GOALS}
          onClick={() => onChange(Math.min(MAX_GOALS, value + 1))}
          className="h-9 w-9 shrink-0 rounded-lg border border-white/12 text-lg leading-none text-ink-muted transition-colors hover:bg-white/5 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PredictionForm({
  match,
  prediction,
}: {
  match: MatchDto;
  prediction: PredictionDto | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(submitPredictionAction, null);
  const [home, setHome] = useState(prediction?.homeGoals ?? 1);
  const [away, setAway] = useState(prediction?.awayGoals ?? 0);

  /*
   * Keep the inputs in step when polling brings a newer prediction - e.g. the
   * same user submitted from their phone. This is React's documented
   * "adjust state during render" pattern rather than an effect: an effect would
   * render once with stale numbers and then immediately render again.
   */
  const [syncedFrom, setSyncedFrom] = useState(prediction?.submittedAt ?? null);
  if (prediction && prediction.submittedAt !== syncedFrom) {
    setSyncedFrom(prediction.submittedAt);
    setHome(prediction.homeGoals);
    setAway(prediction.awayGoals);
  }

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (match.isLocked) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-ink-muted">
          {LOCK_MESSAGES[match.lockReason]}
        </p>

        {prediction ? (
          <div className="flex items-center justify-center gap-4 rounded-xl border border-white/10 bg-navy-950/50 py-4">
            <span className="text-xs uppercase tracking-wider text-ink-faint">Tvoja prognoza</span>
            <span className="tabular text-2xl font-bold text-ink">
              {prediction.homeGoals} : {prediction.awayGoals}
            </span>
          </div>
        ) : (
          <p className="text-center text-sm text-ink-faint">
            Nisi stigao dati prognozu. Bodovi ovog kola idu mimo tebe.
          </p>
        )}
      </div>
    );
  }

  const general = state?.ok === false ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="matchId" value={match.id} />

      <FormError message={general} />
      {state?.ok ? (
        <FormSuccess
          message={
            state.data.editCount > 0 ? 'Prognoza je promijenjena.' : 'Prognoza je spremljena.'
          }
        />
      ) : null}

      <div className="flex items-center gap-2 sm:gap-3">
        <GoalPicker
          name="homeGoals"
          label={match.homeName}
          value={home}
          onChange={setHome}
          disabled={false}
        />
        <span className="pt-6 text-2xl font-bold text-ink-faint">:</span>
        <GoalPicker
          name="awayGoals"
          label={match.awayName}
          value={away}
          onChange={setAway}
          disabled={false}
        />
      </div>

      <SubmitButton
        size="lg"
        className={cn('w-full', prediction && 'bg-white/10 hover:bg-white/15 shadow-none')}
        pendingLabel="Spremam..."
      >
        {prediction ? 'Promijeni prognozu' : 'Spremi prognozu'}
      </SubmitButton>

      <p className="text-center text-xs text-ink-faint">
        Možeš mijenjati koliko želiš — do prve minute utakmice.
      </p>
    </form>
  );
}
