import { cn } from '@/lib/utils';

/** Frosted panel. `strong` is for surfaces that sit over busy backgrounds. */
export function Card({
  className,
  strong = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-[--radius-card] p-5 sm:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
        <div className="rule-red mt-2 h-px w-16" />
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
