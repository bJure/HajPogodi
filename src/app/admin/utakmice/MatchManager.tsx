'use client';

import { useState } from 'react';
import type { AdminMatchDto, CompetitionDto, TeamDto } from '@/application/dto/match';
import { LOCK_MESSAGES } from '@/domain/match/lockPolicy';
import { ActionButton, ActionForm } from '@/components/admin/ActionForm';
import { Button, SubmitButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  confirmMatchAction,
  createMatchAction,
  deleteMatchAction,
  setMatchLockAction,
  setMatchResultAction,
  updateMatchAction,
} from '../actions';

/** `datetime-local` needs a local-time string, not an ISO UTC one. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function MatchManager({
  matches,
  competitions,
  teams,
  seasonId,
  seasonName,
}: {
  matches: AdminMatchDto[];
  competitions: CompetitionDto[];
  teams: TeamDto[];
  seasonId: string;
  seasonName: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);

  const pending = matches.filter((m) => m.syncState === 'NEEDS_CONFIRMATION');
  const confirmed = matches.filter((m) => m.syncState === 'CONFIRMED');

  return (
    <div className="space-y-5">
      {pending.length > 0 ? (
        <Card strong className="border-gold/30">
          <CardHeader
            title="Čeka potvrdu"
            subtitle="Sinkronizirano iz rasporeda. Igrači ovo ne vide dok ne potvrdiš."
          />
          <ul className="space-y-2">
            {pending.map((match) => (
              <li
                key={match.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {match.homeName} – {match.awayName}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {formatDateTime(match.kickoffAt)} · {match.competition.shortName}
                  </span>
                </span>

                <ActionButton action={confirmMatchAction} fields={{ id: match.id }} size="sm">
                  Potvrdi
                </ActionButton>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(editingId === match.id ? null : match.id)}
                >
                  Uredi
                </Button>

                <ActionButton
                  action={deleteMatchAction}
                  fields={{ id: match.id }}
                  size="sm"
                  variant="danger"
                  confirm="Obrisati ovu utakmicu?"
                >
                  Odbaci
                </ActionButton>

                {editingId === match.id ? (
                  <div className="w-full">
                    <MatchForm
                      match={match}
                      seasonId={seasonId}
                      competitions={competitions}
                      teams={teams}
                      onDone={() => setEditingId(null)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card strong>
        <CardHeader
          title="Utakmice"
          subtitle={`${seasonName} · ${confirmed.length} potvrđenih`}
          action={
            <Button size="sm" onClick={() => setCreating((open) => !open)}>
              {creating ? 'Odustani' : 'Ručni unos'}
            </Button>
          }
        />

        {creating ? (
          <div className="mb-5">
            <MatchForm
              match={null}
              seasonId={seasonId}
              competitions={competitions}
              teams={teams}
              onDone={() => setCreating(false)}
            />
          </div>
        ) : null}

        {confirmed.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nema potvrđenih utakmica. Pokreni sinkronizaciju ili unesi ručno.
          </p>
        ) : (
          <ul className="space-y-2">
            {confirmed.map((match) => (
              <li
                key={match.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5',
                  match.needsAttention
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-white/8 bg-white/3',
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {match.homeName} – {match.awayName}
                      {match.result ? (
                        <span className="ml-2 tabular font-bold text-ink">
                          {match.result.homeGoals}:{match.result.awayGoals}
                        </span>
                      ) : null}
                      {match.result?.source === 'MANUAL' ? (
                        <span className="ml-1.5 text-[10px] uppercase text-gold">ručno</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-ink-faint">
                      {formatDateTime(match.kickoffAt)} · {match.competition.shortName} ·{' '}
                      {match.predictionCount} prognoza · {LOCK_MESSAGES[match.lockReason]}
                      {match.manualOverrides.length > 0
                        ? ` · ručno uređeno: ${match.manualOverrides.join(', ')}`
                        : ''}
                    </span>
                  </span>

                  <LockControl match={match} />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setResultId(resultId === match.id ? null : match.id)}
                  >
                    {match.result ? 'Ispravi rezultat' : 'Unesi rezultat'}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(editingId === match.id ? null : match.id)}
                  >
                    Uredi
                  </Button>

                  <ActionButton
                    action={deleteMatchAction}
                    fields={{ id: match.id }}
                    size="sm"
                    variant="danger"
                    confirm={`Obrisati utakmicu i svih ${match.predictionCount} prognoza uz nju?`}
                  >
                    Obriši
                  </ActionButton>
                </div>

                {resultId === match.id ? (
                  <ActionForm
                    action={setMatchResultAction}
                    onSuccess={() => setResultId(null)}
                    className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/4 p-3"
                  >
                    <input type="hidden" name="matchId" value={match.id} />
                    <div className="w-20">
                      <Field label={match.homeName} htmlFor={`h-${match.id}`}>
                        <Input
                          id={`h-${match.id}`}
                          name="homeGoals"
                          type="number"
                          min={0}
                          max={20}
                          required
                          defaultValue={match.result?.homeGoals ?? 0}
                        />
                      </Field>
                    </div>
                    <div className="w-20">
                      <Field label={match.awayName} htmlFor={`a-${match.id}`}>
                        <Input
                          id={`a-${match.id}`}
                          name="awayGoals"
                          type="number"
                          min={0}
                          max={20}
                          required
                          defaultValue={match.result?.awayGoals ?? 0}
                        />
                      </Field>
                    </div>
                    <div className="min-w-48 flex-1">
                      <Field label="Napomena" htmlFor={`n-${match.id}`} hint="Zapisuje se u trag promjena.">
                        <Input id={`n-${match.id}`} name="note" maxLength={280} />
                      </Field>
                    </div>
                    <SubmitButton size="sm" pendingLabel="Obračunavam...">
                      Spremi i obračunaj
                    </SubmitButton>
                    <p className="w-full text-xs text-ink-faint">
                      Spremanje odmah ponovno obračunava bodove i ljestvicu.
                    </p>
                  </ActionForm>
                ) : null}

                {editingId === match.id ? (
                  <MatchForm
                    match={match}
                    seasonId={seasonId}
                    competitions={competitions}
                    teams={teams}
                    onDone={() => setEditingId(null)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LockControl({ match }: { match: AdminMatchDto }) {
  const current = match.lockOverride === null ? 'auto' : String(match.lockOverride);

  return (
    <form className="inline-flex items-center gap-1.5">
      <span className="sr-only">Zaključavanje</span>
      {(
        [
          ['auto', 'Auto'],
          ['true', 'Zaključaj'],
          ['false', 'Otključaj'],
        ] as const
      ).map(([value, label]) => (
        <ActionButton
          key={value}
          action={setMatchLockAction}
          fields={{ id: match.id, lockOverride: value }}
          size="sm"
          variant={current === value ? 'primary' : 'ghost'}
        >
          {label}
        </ActionButton>
      ))}
    </form>
  );
}

function MatchForm({
  match,
  seasonId,
  competitions,
  teams,
  onDone,
}: {
  match: AdminMatchDto | null;
  seasonId: string;
  competitions: CompetitionDto[];
  teams: TeamDto[];
  onDone: () => void;
}) {
  return (
    <ActionForm
      action={match ? updateMatchAction : createMatchAction}
      onSuccess={onDone}
      className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/4 p-4"
    >
      {match ? <input type="hidden" name="id" value={match.id} /> : null}
      <input type="hidden" name="seasonId" value={seasonId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Protivnik" htmlFor={`opp-${match?.id ?? 'new'}`}>
          <Select
            id={`opp-${match?.id ?? 'new'}`}
            name="opponentId"
            defaultValue={match?.opponent.id ?? ''}
            required
          >
            <option value="" disabled>
              Odaberi
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Natjecanje" htmlFor={`comp-${match?.id ?? 'new'}`}>
          <Select
            id={`comp-${match?.id ?? 'new'}`}
            name="competitionId"
            defaultValue={match?.competition.id ?? ''}
            required
          >
            <option value="" disabled>
              Odaberi
            </option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mjesto" htmlFor={`home-${match?.id ?? 'new'}`}>
          <Select
            id={`home-${match?.id ?? 'new'}`}
            name="isHome"
            defaultValue={String(match?.isHome ?? true)}
          >
            <option value="true">Hajduk domaćin</option>
            <option value="false">Hajduk gost</option>
          </Select>
        </Field>

        <Field label="Početak" htmlFor={`ko-${match?.id ?? 'new'}`}>
          <Input
            id={`ko-${match?.id ?? 'new'}`}
            name="kickoffAt"
            type="datetime-local"
            required
            defaultValue={match ? toLocalInput(match.kickoffAt) : ''}
          />
        </Field>

        <Field label="Kolo" htmlFor={`round-${match?.id ?? 'new'}`}>
          <Input id={`round-${match?.id ?? 'new'}`} name="round" defaultValue={match?.round ?? ''} />
        </Field>

        <Field label="Stadion" htmlFor={`venue-${match?.id ?? 'new'}`}>
          <Input id={`venue-${match?.id ?? 'new'}`} name="venue" defaultValue={match?.venue ?? ''} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton size="sm">{match ? 'Spremi' : 'Kreiraj'}</SubmitButton>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Odustani
        </Button>
      </div>

      {match?.apiFootballFixtureId ? (
        <p className="text-xs text-ink-faint">
          Polja koja ovdje promijeniš sinkronizacija više neće prepisivati.
        </p>
      ) : null}
    </ActionForm>
  );
}
