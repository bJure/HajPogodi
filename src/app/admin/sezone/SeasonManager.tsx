'use client';

import { useState } from 'react';
import type { SeasonDto } from '@/application/dto/season';
import { ActionButton, ActionForm } from '@/components/admin/ActionForm';
import { Button, SubmitButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { activateSeasonAction, createSeasonAction, updateSeasonAction } from '../actions';

export interface RuleOption {
  id: string;
  label: string;
}

export function SeasonManager({
  seasons,
  rules,
}: {
  seasons: SeasonDto[];
  rules: RuleOption[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card strong>
      <CardHeader
        title="Sezone"
        subtitle="Svaka sezona ima svoj skup pravila bodovanja i svoju ljestvicu."
        action={
          <Button size="sm" onClick={() => setCreating((open) => !open)}>
            {creating ? 'Odustani' : 'Nova sezona'}
          </Button>
        }
      />

      {creating ? (
        <div className="mb-5">
          <SeasonForm season={null} rules={rules} onDone={() => setCreating(false)} />
        </div>
      ) : null}

      <ul className="space-y-2">
        {seasons.map((season) => (
          <li
            key={season.id}
            className={cn(
              'rounded-xl border px-3 py-2.5',
              season.isActive ? 'border-hajduk-red/30 bg-hajduk-red/8' : 'border-white/8 bg-white/3',
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {season.name}
                  {season.isActive ? (
                    <span className="ml-2 text-[10px] uppercase text-hajduk-red-soft">aktivna</span>
                  ) : null}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {formatDate(season.startsAt)} – {formatDate(season.endsAt)} · API godina{' '}
                  {season.apiYear} · {season.matchCount} utakmica · pravila:{' '}
                  {season.scoringRuleIds.join(', ')}
                </span>
              </span>

              {!season.isActive ? (
                <ActionButton
                  action={activateSeasonAction}
                  fields={{ id: season.id }}
                  size="sm"
                  confirm={`Aktivirati ${season.name}? Trenutno aktivna sezona postaje neaktivna.`}
                >
                  Aktiviraj
                </ActionButton>
              ) : null}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingId(editingId === season.id ? null : season.id)}
              >
                Uredi
              </Button>
            </div>

            {editingId === season.id ? (
              <SeasonForm season={season} rules={rules} onDone={() => setEditingId(null)} />
            ) : null}
          </li>
        ))}
      </ul>

      {seasons.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Nema nijedne sezone. Otvori prvu da bi aplikacija proradila.
        </p>
      ) : null}
    </Card>
  );
}

function SeasonForm({
  season,
  rules,
  onDone,
}: {
  season: SeasonDto | null;
  rules: RuleOption[];
  onDone: () => void;
}) {
  const idPrefix = season?.id ?? 'new';

  return (
    <ActionForm
      action={season ? updateSeasonAction : createSeasonAction}
      onSuccess={onDone}
      className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/4 p-4"
    >
      {season ? <input type="hidden" name="id" value={season.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Naziv" htmlFor={`name-${idPrefix}`}>
          <Input
            id={`name-${idPrefix}`}
            name="name"
            required
            placeholder="HNL 2026/27"
            defaultValue={season?.name ?? ''}
          />
        </Field>

        <Field
          label="API godina"
          htmlFor={`year-${idPrefix}`}
          hint="Godina početka sezone (2026 za 2026/27)."
        >
          <Input
            id={`year-${idPrefix}`}
            name="apiYear"
            type="number"
            min={2000}
            max={2100}
            required
            defaultValue={season?.apiYear ?? new Date().getFullYear()}
          />
        </Field>

        <Field label="Početak" htmlFor={`from-${idPrefix}`}>
          <Input
            id={`from-${idPrefix}`}
            name="startsAt"
            type="date"
            required
            defaultValue={season?.startsAt.slice(0, 10) ?? ''}
          />
        </Field>

        <Field label="Kraj" htmlFor={`to-${idPrefix}`}>
          <Input
            id={`to-${idPrefix}`}
            name="endsAt"
            type="date"
            required
            defaultValue={season?.endsAt.slice(0, 10) ?? ''}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted">
          Pravila bodovanja
        </legend>
        <div className="flex flex-wrap gap-3">
          {rules.map((rule) => (
            <label key={rule.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="scoringRuleIds"
                value={rule.id}
                defaultChecked={(season?.scoringRuleIds ?? ['exact-score']).includes(rule.id)}
                className="h-4 w-4 accent-[var(--color-hajduk-red)]"
              />
              {rule.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          Promjena pravila odmah preračunava ljestvicu te sezone.
        </p>
      </fieldset>

      <div className="flex items-center gap-2">
        <SubmitButton size="sm">{season ? 'Spremi' : 'Kreiraj'}</SubmitButton>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Odustani
        </Button>
      </div>
    </ActionForm>
  );
}
