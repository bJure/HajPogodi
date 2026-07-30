import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUserStats } from '@/application/services/statsService';
import { Card, CardHeader } from '@/components/ui/Card';
import { PointsChart } from '@/components/stats/PointsChart';
import { formatPercent, formatStreak } from '@/lib/format';
import { requirePageUser } from '@/infrastructure/auth/session';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Statistika' };
export const dynamic = 'force-dynamic';

export default async function StatsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [viewer, season, { userId }] = await Promise.all([
    requirePageUser(),
    seasonRepository.findActive(),
    params,
  ]);
  if (!season) notFound();

  const stats = await getUserStats(userId, season.id);
  const unlocked = stats.achievements.filter((a) => a.unlockedAt !== null);

  return (
    <div className="animate-[--animate-fade-up] space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {stats.nickname}
          {stats.userId === viewer.id ? (
            <span className="ml-2 align-middle text-xs font-semibold uppercase text-hajduk-red-soft">
              ti
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {season.name} · {stats.rank}. od {stats.totalPlayers}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Bodovi" value={String(stats.points)} accent />
        <StatTile label="Pogodaka" value={String(stats.exactHits)} />
        <StatTile label="Uspješnost" value={formatPercent(stats.accuracyPct)} />
        <StatTile label="Prosjek/ut." value={stats.avgPoints.toFixed(2)} />
        <StatTile label="Najbolji niz" value={String(stats.bestStreak)} />
        <StatTile label="Najgori niz" value={String(stats.worstStreak)} />
      </div>

      <Card strong>
        <CardHeader
          title="Bodovi kroz sezonu"
          subtitle={`Trenutni niz: ${formatStreak(stats.currentStreak)}`}
        />
        <PointsChart data={stats.progression} />
      </Card>

      <Card>
        <CardHeader
          title="Postignuća"
          subtitle={`${unlocked.length} od ${stats.achievements.length} otključano`}
        />

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {stats.achievements.map((achievement) => {
            const earned = achievement.unlockedAt !== null;
            return (
              <li
                key={achievement.code}
                className={cn(
                  'flex gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  earned
                    ? 'border-gold/30 bg-gold/8'
                    : 'border-white/8 bg-white/3 opacity-50 grayscale',
                )}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {achievement.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{achievement.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{achievement.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Odigrano i propušteno" />
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Dao prognozu" value={String(stats.played)} />
          <StatTile label="Propustio" value={String(stats.missed)} />
        </div>
        {stats.missed > 0 ? (
          <p className="mt-3 text-xs text-ink-faint">Propuštena kola se broje kao promašaj!</p>
        ) : null}
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl px-3 py-3.5 text-center">
      <p
        className={cn(
          'tabular text-3xl font-black leading-none',
          accent ? 'text-hajduk-red-soft' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs uppercase tracking-wider text-ink-faint">{label}</p>
    </div>
  );
}
