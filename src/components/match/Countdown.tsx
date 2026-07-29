'use client';

import { useEffect, useState } from 'react';

/**
 * Countdown to kickoff.
 *
 * Rendered client-side only after mount: the server and the browser are never
 * on the exact same millisecond, and a hydration mismatch on a ticking clock is
 * guaranteed otherwise.
 */
function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function Countdown({
  target,
  onExpire,
}: {
  target: string;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const targetMs = new Date(target).getTime();

    const tick = () => {
      const next = targetMs - Date.now();
      setRemaining(next);
      if (next <= 0) onExpire?.();
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, onExpire]);

  if (remaining === null) {
    return <div className="h-16" aria-hidden />;
  }

  if (remaining <= 0) {
    return (
      <p className="text-sm font-semibold uppercase tracking-wider text-hajduk-red-soft">
        Prognoze zaključane
      </p>
    );
  }

  const { days, hours, minutes, seconds } = parts(remaining);
  const urgent = remaining <= 60 * 60 * 1000;

  const cells: [number, string][] = [
    [days, 'dana'],
    [hours, 'h'],
    [minutes, 'min'],
    [seconds, 's'],
  ];

  return (
    <div
      className="flex gap-2"
      role="timer"
      aria-label={`Do zaključavanja: ${days} dana, ${hours} sati, ${minutes} minuta`}
    >
      {cells.map(([value, label], index) => {
        // Hide leading day/hour cells once they are zero - "0 dana 0h" is noise.
        if (index === 0 && value === 0) return null;
        if (index === 1 && value === 0 && days === 0) return null;

        return (
          <div
            key={label}
            className={`flex min-w-14 flex-col items-center rounded-xl border px-2.5 py-2 ${
              urgent
                ? 'border-hajduk-red/40 bg-hajduk-red/10'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <span className="tabular text-xl font-bold leading-none text-ink">
              {String(value).padStart(2, '0')}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-ink-faint">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
