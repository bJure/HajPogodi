'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/components/ui/Button';
import { syncFixturesAction } from './actions';

/**
 * Manual trigger for the schedule sync. The same job runs daily from cron; this
 * exists so an admin does not have to wait for the next tick after adding an
 * API key or fixing a season year.
 */
export function SyncButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [state, formAction] = useActionState(syncFixturesAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <SubmitButton size="sm" disabled={disabled} pendingLabel="Sinkroniziram...">
        Sinkroniziraj raspored
      </SubmitButton>

      {state?.ok ? (
        <span className="text-xs text-success">
          {state.data.created} novih, {state.data.updated} ažurirano
        </span>
      ) : null}
      {state?.ok === false ? (
        <span className="text-xs text-danger">{state.error.message}</span>
      ) : null}
    </form>
  );
}
