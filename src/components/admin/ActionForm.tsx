'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, SubmitButton, type ButtonProps } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import type { ActionResult } from '@/lib/action';

type Action<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/**
 * Thin wrapper around a server action: renders errors, refreshes the route on
 * success and prevents double submission. Used by every admin form so error
 * handling is identical everywhere rather than re-implemented per screen.
 */
export function ActionForm<T>({
  action,
  children,
  onSuccess,
  className,
}: {
  action: Action<T>;
  children: React.ReactNode;
  onSuccess?: (data: T) => void;
  className?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (!state?.ok) return;
    onSuccess?.(state.data);
    router.refresh();
    // `onSuccess` is a fresh closure each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  const fields = state?.ok === false ? state.error.fields : undefined;
  const general = state?.ok === false && !fields ? state.error.message : undefined;

  return (
    <form action={formAction} className={className}>
      <FormError message={general} />
      {fields
        ? Object.entries(fields).map(([key, message]) => (
            <p key={key} role="alert" className="mt-1 text-xs text-danger">
              {message}
            </p>
          ))
        : null}
      {children}
    </form>
  );
}

/**
 * One-click action with an optional confirmation. Confirmation is deliberately
 * required for anything destructive - deleting a user cascades to their whole
 * prediction history.
 */
export function ActionButton<T>({
  action,
  fields,
  confirm,
  children,
  ...buttonProps
}: {
  action: Action<T>;
  fields: Record<string, string>;
  confirm?: string;
  children: React.ReactNode;
} & Omit<ButtonProps, 'action'>) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className="inline"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton {...buttonProps}>{children}</SubmitButton>
      {state?.ok === false ? (
        <span className="ml-2 text-xs text-danger">{state.error.message}</span>
      ) : null}
    </form>
  );
}

export { Button };
