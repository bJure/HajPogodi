'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SubmitButton } from '@/components/ui/Button';
import { Field, FormError, FormSuccess, Input } from '@/components/ui/Field';
import { changePasswordAction } from './actions';

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [state, formAction] = useActionState(changePasswordAction, null);

  // The `mustChangePassword` flag lives in the JWT, so it has to be refreshed
  // client-side or middleware would keep redirecting back here.
  useEffect(() => {
    if (!state?.ok) return;
    void (async () => {
      await update({ mustChangePassword: false });
      router.replace('/pocetna');
      router.refresh();
    })();
  }, [state, update, router]);

  const fields = state?.ok === false ? state.error.fields : undefined;
  const general = state?.ok === false && !state.error.fields ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {forced ? (
        <p className="rounded-xl border border-gold/35 bg-gold/10 px-3.5 py-2.5 text-sm text-gold">
          Administrator ti je postavio novu lozinku. Odaberi svoju prije nego nastaviš.
        </p>
      ) : null}

      <FormError message={general} />
      {state?.ok ? <FormSuccess message="Lozinka je promijenjena." /> : null}

      <Field label="Trenutna lozinka" htmlFor="currentPassword" error={fields?.currentPassword}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(fields?.currentPassword)}
        />
      </Field>

      <Field
        label="Nova lozinka"
        htmlFor="newPassword"
        error={fields?.newPassword}
        hint="Barem 12 znakova."
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(fields?.newPassword)}
        />
      </Field>

      <Field label="Ponovi novu lozinku" htmlFor="confirmPassword" error={fields?.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(fields?.confirmPassword)}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Spremam...">
        Spremi lozinku
      </SubmitButton>
    </form>
  );
}
