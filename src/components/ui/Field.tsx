import { cn } from '@/lib/utils';

export function Input({
  className,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-11 w-full rounded-xl border bg-navy-950/60 px-3.5 text-sm text-ink',
        'placeholder:text-ink-faint transition-colors',
        'focus:border-hajduk-red/60 focus:outline-none',
        invalid ? 'border-danger/60' : 'border-white/12',
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        'h-11 w-full rounded-xl border bg-navy-950/60 px-3 text-sm text-ink',
        'transition-colors focus:border-hajduk-red/60 focus:outline-none',
        invalid ? 'border-danger/60' : 'border-white/12',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium tracking-wide text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/35 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
    >
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-success/35 bg-success/10 px-3.5 py-2.5 text-sm text-success"
    >
      {message}
    </div>
  );
}
