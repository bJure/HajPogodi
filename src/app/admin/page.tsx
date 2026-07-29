import type { Metadata } from 'next';
import { messageSpaceSize } from '@/domain/roast/RoastEngine';
import { listSeasonMatches } from '@/application/services/matchService';
import { listUsers } from '@/application/services/userService';
import { Card, CardHeader } from '@/components/ui/Card';
import { ActionButton } from '@/components/admin/ActionForm';
import { SyncButton } from './SyncButton';
import { formatDateTime } from '@/lib/format';
import { isRoastAiEnabled } from '@/lib/env';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';
import {
  auditRepository,
  jobRunRepository,
} from '@/infrastructure/repositories/supportRepositories';
import { recalculateAction } from './actions';

export const metadata: Metadata = { title: 'Administracija' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const now = new Date();
  const season = await seasonRepository.findActive();

  const [users, matches, audit, lastSync, lastPoll] = await Promise.all([
    listUsers(),
    season ? listSeasonMatches(season.id, now) : Promise.resolve([]),
    auditRepository.list(15),
    jobRunRepository.lastRun('sync-fixtures'),
    jobRunRepository.lastRun('poll-results'),
  ]);

  const pending = matches.filter((m) => m.syncState === 'NEEDS_CONFIRMATION');
  const attention = matches.filter((m) => m.needsAttention);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Korisnici" value={`${users.filter((u) => u.isActive).length}/${users.length}`} />
        <Tile label="Utakmice" value={String(matches.length)} />
        <Tile label="Čeka potvrdu" value={String(pending.length)} accent={pending.length > 0} />
        <Tile label="Bez rezultata" value={String(attention.length)} accent={attention.length > 0} />
      </div>

      {pending.length > 0 ? (
        <Card className="border-gold/30 bg-gold/5">
          <p className="text-sm text-gold">
            {pending.length === 1
              ? 'Jedna utakmica čeka potvrdu i nije vidljiva igračima.'
              : `${pending.length} utakmica čeka potvrdu i nije vidljivo igračima.`}
          </p>
        </Card>
      ) : null}

      {attention.length > 0 ? (
        <Card className="border-danger/30 bg-danger/5">
          <p className="text-sm text-danger">
            {attention.length === 1
              ? 'Jedna odigrana utakmica još nema rezultat. Unesi ga ručno.'
              : `${attention.length} odigranih utakmica nema rezultat. Unesi ih ručno.`}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card strong>
          <CardHeader title="Operacije" subtitle="Ručno pokretanje pozadinskih poslova." />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SyncButton />
              {season ? (
                <ActionButton
                  action={recalculateAction}
                  fields={{ seasonId: season.id }}
                  variant="outline"
                  size="sm"
                >
                  Preračunaj ljestvicu
                </ActionButton>
              ) : null}
            </div>

            <p className="text-xs text-ink-faint">
              Raspored dolazi s HNS semafora (HNL i kup) i ESPN-a (europska natjecanja). Nijedan
              ne traži ključ. Utakmice se uvijek mogu unijeti i ručno.
            </p>

            <dl className="space-y-1.5 border-t border-white/8 pt-3 text-xs">
              <Row label="Zadnja sinkronizacija" value={lastSync ? formatDateTime(lastSync.startedAt.toISOString()) : 'nikad'} />
              <Row label="Zadnja provjera rezultata" value={lastPoll ? formatDateTime(lastPoll.startedAt.toISOString()) : 'nikad'} />
              <Row
                label="Roast poruke"
                value={`${messageSpaceSize().toLocaleString('hr-HR')} kombinacija${
                  isRoastAiEnabled() ? ' + AI sloj' : ''
                }`}
              />
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Zadnje promjene" subtitle="Svaka administratorska radnja ostavlja trag." />

          {audit.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">Još nema zapisa.</p>
          ) : (
            <ul className="space-y-1.5">
              {audit.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-2 text-xs">
                  <span className="w-28 shrink-0 text-ink-faint">
                    {formatDateTime(entry.createdAt.toISOString())}
                  </span>
                  <span className="font-mono text-ink-muted">{entry.action}</span>
                  <span className="truncate text-ink-faint">
                    {entry.actor?.nickname ?? 'sustav'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-xl px-3 py-3.5 text-center">
      <p
        className={`tabular text-2xl font-black leading-none ${
          accent ? 'text-gold' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink-muted">{value}</dd>
    </div>
  );
}
