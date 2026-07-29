'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { MatchDto } from '@/application/dto/match';
import type { PredictionDto } from '@/application/dto/prediction';
import { useLiveData } from '@/components/live/useLiveData';
import { Card } from '@/components/ui/Card';
import { Countdown } from '@/components/match/Countdown';
import { PredictionForm } from '@/components/prediction/PredictionForm';
import { formatDateTime } from '@/lib/format';
import { OUR_CLUB_CREST_URL, OUR_CLUB_INITIAL } from '@/lib/club';
import type { PollHint } from '@/domain/match/pollHint';

interface NextMatchPayload {
  match: MatchDto | null;
  prediction: PredictionDto | null;
  others: PredictionDto[];
  pollHint: PollHint;
}

/**
 * The centrepiece of the home page.
 *
 * Server-rendered first for instant content, then kept fresh by polling - which
 * is what makes the form actually lock at kickoff on a page that has been open
 * for hours.
 */
export function NextMatchCard({ initial }: { initial: NextMatchPayload }) {
  const router = useRouter();
  const { data } = useLiveData<NextMatchPayload>('/api/live/utakmica', initial);

  const payload = data ?? initial;
  const { match, prediction, others } = payload;

  // When the countdown hits zero the server's view has changed; re-render from it.
  const onExpire = useCallback(() => router.refresh(), [router]);

  if (!match) {
    return (
      <Card strong className="text-center">
        <p className="text-4xl">🏝️</p>
        <h2 className="mt-3 text-lg font-semibold text-ink">Nema utakmice na vidiku</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Kad Hajduk dobije sljedeći termin, pojavit će se ovdje. Odmori prste.
        </p>
      </Card>
    );
  }

  return (
    <Card strong className="overflow-hidden">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-full border border-hajduk-red/30 bg-hajduk-red/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-hajduk-red-soft">
            {match.competition.shortName}
            {match.round ? ` · ${match.round}` : ''}
          </span>
          <p className="mt-2 text-sm text-ink-muted">{formatDateTime(match.kickoffAt)}</p>
        </div>
        <Countdown target={match.kickoffAt} onExpire={onExpire} />
      </div>

      <div className="mb-6 flex items-center justify-center gap-4 sm:gap-8">
        <TeamBadge
          name={match.homeName}
          logoUrl={match.isHome ? OUR_CLUB_CREST_URL : match.opponent.logoUrl}
        />
        <span className="text-lg font-bold text-ink-faint">vs</span>
        <TeamBadge
          name={match.awayName}
          logoUrl={match.isHome ? match.opponent.logoUrl : OUR_CLUB_CREST_URL}
        />
      </div>

      <PredictionForm match={match} prediction={prediction} />

      {match.isLocked && others.length > 0 ? (
        <div className="mt-6 border-t border-white/8 pt-4">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Prognoze ostalih
          </p>
          <ul className="space-y-1.5">
            {others.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-ink-muted">{entry.nickname}</span>
                <span className="tabular font-semibold text-ink">
                  {entry.homeGoals} : {entry.awayGoals}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function TeamBadge({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  // Crests are hotlinked from HNS and ESPN, so a moved file or a tightened CSP
  // shows a broken image rather than nothing. Falling back to the lettermark
  // keeps the badge looking deliberate either way.
  const [failed, setFailed] = useState(false);
  const showLogo = logoUrl !== null && !failed;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        {showLogo ? (
          // Provider logos are remote and tiny; a plain img avoids an optimizer
          // round-trip for an asset that is already a few kilobytes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-9 w-9 object-contain"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-xl font-black text-hajduk-red">{OUR_CLUB_INITIAL}</span>
        )}
      </div>
      <span className="max-w-full truncate text-center text-sm font-semibold text-ink">{name}</span>
    </div>
  );
}
