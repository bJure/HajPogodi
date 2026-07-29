import { cn } from '@/lib/utils';

/**
 * Full-bleed hero at the top of the home page.
 *
 * The background is layered: a dark gradient over an optional `/hero.jpg`. If
 * that file is absent the gradient simply shows on its own, so the app looks
 * finished out of the box - no broken image, no placeholder. Drop your own
 * wallpaper at `public/hero.jpg` to personalise it (see README; an official
 * club wallpaper is not shipped because it is not ours to redistribute).
 */
export function Hero({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative -mx-4 overflow-hidden border-b border-white/8 px-4 py-10 sm:py-14',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: [
            'linear-gradient(180deg, rgba(6,15,29,0.55) 0%, rgba(6,15,29,0.85) 60%, var(--color-navy-950) 100%)',
            'radial-gradient(ellipse 70% 60% at 20% 0%, rgba(227,6,19,0.28), transparent 60%)',
            "url('/hero.jpg')",
          ].join(', '),
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex items-center gap-2">
          <span className="h-px w-8 bg-hajduk-red" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-hajduk-red-soft">
            Ajmo bijeli ale
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
          {title}
        </h1>

        {subtitle ? (
          <p className="mt-2 max-w-xl text-balance text-sm text-ink-muted sm:text-base">
            {subtitle}
          </p>
        ) : null}

        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}
