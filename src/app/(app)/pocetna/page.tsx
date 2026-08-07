import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { pollHintFor } from '@/domain/match/pollHint';
import { toMatchDto } from '@/application/mappers/matchMapper';
import { getLeaderboard } from '@/application/services/leaderboardService';
import {
  getMyPrediction,
  listMatchPredictions,
  listRecentResults,
} from '@/application/services/predictionService';
import { Card, CardHeader } from '@/components/ui/Card';
import { Hero } from '@/components/layout/Hero';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { NextMatchCard } from '@/components/match/NextMatchCard';
import { ResultList } from '@/components/match/ResultList';
import { RoastBanner, RoastBannerSkeleton } from '@/components/roast/RoastBanner';
import { requirePageUser } from '@/infrastructure/auth/session';
import {
  matchRepository,
  seasonRepository,
} from '@/infrastructure/repositories/matchRepository';

export const metadata: Metadata = { title: 'Početna' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const now = new Date();
  // Independent reads, so they must not queue behind each other: every one is a
  // round trip to Neon and this page already needs several in sequence.
  const [user, season] = await Promise.all([requirePageUser(), seasonRepository.findActive()]);

  if (!season) {
    return (
      <Card strong className="mx-auto max-w-lg text-center">
        <p className="text-4xl">🗓️</p>
        <h1 className="mt-3 text-xl font-bold text-ink">Nema aktivne sezone</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Administrator još nije otvorio sezonu. Bez nje nema ni prognoza ni ljestvice.
        </p>
        {user.role === 'ADMIN' ? (
          <Link
            href="/admin/sezone"
            className="mt-4 inline-block rounded-xl bg-hajduk-red px-4 py-2 text-sm font-semibold text-white"
          >
            Otvori sezonu
          </Link>
        ) : null}
      </Card>
    );
  }

  const nextMatch = await matchRepository.findNextOpen(season.id, now);

  const [prediction, others, leaderboard, recent] = await Promise.all([
    nextMatch ? getMyPrediction(user.id, nextMatch.id) : Promise.resolve(null),
    nextMatch
      ? listMatchPredictions(nextMatch, now, { revealBeforeLock: false })
      : Promise.resolve([]),
    getLeaderboard(season, user.id, now, nextMatch?.kickoffAt ?? null),
    listRecentResults(season.id, user.id, 5, now),
  ]);

  const myRow = leaderboard.rows.find((row) => row.userId === user.id);

  return (
    <div className="-mt-6 space-y-5 sm:-mt-8 sm:space-y-6">
      <Hero
        title={`Dobrodošao natrag, ${user.nickname}.`}
        subtitle={
          myRow
            ? `${myRow.rank}. mjesto, ${myRow.points} bodova, ${myRow.exactHits} pogodaka. Ljestvica pamti sve.`
            : 'Još nisi na ljestvici. Prva prognoza te upisuje u priču.'
        }
      >
        {/* The optional AI call lives behind Suspense so it can never delay the page. */}
        <Suspense fallback={<RoastBannerSkeleton />}>
          <RoastBanner userId={user.id} nickname={user.nickname} seasonId={season.id} />
        </Suspense>
      </Hero>

      {/*
        * min-w-0 on both columns: a grid item defaults to min-width:auto, so the
        * min-content of the widest row inside (a long fixture name in "Zadnji
        * rezultati") sets the column width and pushes both cards off a phone
        * screen. Letting the columns shrink is what makes the rows truncate.
        */}
      <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr] sm:gap-6">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <NextMatchCard
            initial={{
              match: nextMatch ? toMatchDto(nextMatch, now) : null,
              prediction,
              others,
              pollHint: pollHintFor(nextMatch?.kickoffAt ?? null, now),
            }}
          />

          <Card>
            <CardHeader
              title="Zadnji rezultati"
              subtitle="Rezultat, tvoja prognoza, bodovi."
              action={
                <Link
                  href="/povijest"
                  className="text-xs font-semibold text-ink-muted transition-colors hover:text-hajduk-red-soft"
                >
                  Sve →
                </Link>
              }
            />
            <ResultList items={recent} />
          </Card>
        </div>

        <div className="min-w-0 space-y-5 sm:space-y-6">
          <Card>
            {/*
              * No subtitle: it carried the season name, which reads as
              * "HNL 2026/27" and so claims the table only counts league
              * matches. It counts the cup and Europe too.
              */}
            <CardHeader title="Tvoja pozicija" />
            {myRow ? (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Mjesto" value={`${myRow.rank}.`} accent />
                <Stat label="Bodovi" value={String(myRow.points)} />
                <Stat label="Pogodaka" value={`${myRow.exactHits}/${myRow.played}`} />
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-ink-muted">
                Još nisi na ljestvici. Prva prognoza te upisuje.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Ljestvica"
              action={
                <Link
                  href="/ljestvica"
                  className="text-xs font-semibold text-ink-muted transition-colors hover:text-hajduk-red-soft"
                >
                  Sve →
                </Link>
              }
            />
            <LeaderboardTable initial={leaderboard} compact />
          </Card>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3 text-center">
      <p
        className={`tabular text-2xl font-black leading-none ${
          accent ? 'text-hajduk-red-soft' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
    </div>
  );
}
