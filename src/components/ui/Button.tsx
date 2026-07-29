'use client';

import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-hajduk-red text-white hover:bg-hajduk-red-soft active:bg-hajduk-red-dim shadow-lg shadow-hajduk-red/25',
  ghost: 'bg-white/5 text-ink hover:bg-white/10',
  outline: 'border border-white/15 bg-transparent text-ink hover:bg-white/5',
  danger: 'bg-danger/15 text-danger border border-danger/35 hover:bg-danger/25',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        'transition-all duration-200 active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Submit button that disables itself while the surrounding server action runs.
 * Prevents the double-submit that would otherwise create a duplicate prediction
 * edit or a second user.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingLabel ?? 'Trenutak...') : children}
    </Button>
  );
}
