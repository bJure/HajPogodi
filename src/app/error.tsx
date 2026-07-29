'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server logs already have the full stack; this puts the digest in the
    // browser console so a user can quote it in a bug report.
    console.error('HajPogodi:', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md rounded-[--radius-card] p-6 text-center">
        <p className="text-4xl">🥅</p>
        <h1 className="mt-3 text-xl font-bold text-ink">Promašaj s bijele točke</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Nešto je puklo na našoj strani. Pokušaj ponovno — ako se ponovi, javi adminu.
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-ink-faint">šifra: {error.digest}</p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-hajduk-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hajduk-red-soft"
        >
          Pokušaj ponovno
        </button>
      </div>
    </div>
  );
}
