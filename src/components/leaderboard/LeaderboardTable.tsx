'use client';

import Link from 'next/link';
import type { LeaderboardDto } from '@/application/dto/leaderboard';
import { useLiveData } from '@/components/live/useLiveData';
import { formatPercent, formatStreak } from '@/lib/format';
import { cn } from '@/lib/utils';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Leaderboard that keeps itself current by polling. `compact` drops the
 * secondary columns for the home page sidebar.
 */
export function LeaderboardTable({
  initial,
  compact = false,
}: {
  initial: LeaderboardDto;
  compact?: boolean;
}) {
  const { data } = useLiveData<LeaderboardDto>('/api/live/ljestvica', initial);
  const rows = (data ?? initial).rows;

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        Ljestvica je prazna. Čim padne prvo kolo, ovdje će biti krvi.
      </p>
    );
  }

  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-full border-collapse">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
            <th className="px-2 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Igrač</th>
            <th className="px-2 py-2 text-right font-medium">Bodovi</th>
            {!compact ? (
              <>
                <th className="px-2 py-2 text-right font-medium">Pogodaka</th>
                <th className="px-2 py-2 text-right font-medium">Uspješnost</th>
                <th className="px-2 py-2 text-right font-medium">Niz</th>
              </>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.userId}
              className={cn(
                'border-t border-white/6 transition-colors',
                row.isCurrentUser && 'bg-hajduk-red/8',
              )}
            >
              <td className="px-2 py-2.5">
                <span className="tabular text-sm font-bold text-ink-muted">
                  {MEDALS[row.rank] ?? row.rank}
                </span>
              </td>

              <td className="max-w-40 px-2 py-2.5">
                <Link
                  href={`/statistika/${row.userId}`}
                  className={cn(
                    'block truncate text-sm transition-colors hover:text-hajduk-red-soft',
                    row.isCurrentUser ? 'font-bold text-ink' : 'font-medium text-ink',
                  )}
                >
                  {row.nickname}
                  {row.isCurrentUser ? (
                    <span className="ml-1.5 text-[10px] uppercase text-hajduk-red-soft">ti</span>
                  ) : null}
                </Link>
              </td>

              <td className="tabular px-2 py-2.5 text-right text-sm font-bold text-ink">
                {row.points}
              </td>

              {!compact ? (
                <>
                  <td className="tabular px-2 py-2.5 text-right text-sm text-ink-muted">
                    {row.exactHits}/{row.played}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-sm text-ink-muted">
                    {formatPercent(row.accuracyPct)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-xs text-ink-muted">
                    {formatStreak(row.currentStreak)}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
