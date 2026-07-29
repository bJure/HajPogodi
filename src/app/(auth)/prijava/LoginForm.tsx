'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { loginAction } from './actions';

export function LoginForm({ nastavi }: { nastavi: string | null }) {
  const router = useRouter();
  const [state, formAction] = useActionState(loginAction, null);

  // Auth.js sets the session cookie inside the action; a client-side refresh is
  // what makes the new session visible to the server components on the target
  // page. A plain <a> navigation would work too but would flash a full reload.
  useEffect(() => {
    if (state?.ok) {
      router.replace(state.data.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const fieldError = state?.ok === false ? state.error.fields : undefined;
  const generalError =
    state?.ok === false && !state.error.fields ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {nastavi ? <input type="hidden" name="nastavi" value={nastavi} /> : null}

      <FormError message={generalError} />

      <Field label="Korisničko ime" htmlFor="username" error={fieldError?.username}>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          placeholder="npr. torcida1950"
          invalid={Boolean(fieldError?.username)}
        />
      </Field>

      <Field label="Lozinka" htmlFor="password" error={fieldError?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          invalid={Boolean(fieldError?.password)}
        />
      </Field>

      <SubmitButton size="lg" className="w-full" pendingLabel="Prijavljujem...">
        Prijavi se
      </SubmitButton>
    </form>
  );
}
