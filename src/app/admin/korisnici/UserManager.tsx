'use client';

import { useState } from 'react';
import type { UserDto } from '@/application/dto/user';
import { ActionButton, ActionForm } from '@/components/admin/ActionForm';
import { Button, SubmitButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  toggleUserActiveAction,
  updateUserAction,
} from '../actions';

export function UserManager({ users, currentUserId }: { users: UserDto[]; currentUserId: string }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <Card strong>
        <CardHeader
          title="Korisnici"
          subtitle="Račune otvara isključivo administrator — nema samostalne registracije."
          action={
            <Button size="sm" onClick={() => setCreating((open) => !open)}>
              {creating ? 'Odustani' : 'Novi korisnik'}
            </Button>
          }
        />

        {creating ? (
          <ActionForm
            action={createUserAction}
            onSuccess={() => setCreating(false)}
            className="mb-5 space-y-3 rounded-xl border border-white/10 bg-white/4 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Korisničko ime" htmlFor="new-username">
                <Input id="new-username" name="username" required autoComplete="off" />
              </Field>
              <Field label="Nadimak" htmlFor="new-nickname" hint="Prikazuje se na ljestvici.">
                <Input id="new-nickname" name="nickname" required autoComplete="off" />
              </Field>
              <Field label="Lozinka" htmlFor="new-password" hint="Barem 12 znakova.">
                <Input id="new-password" name="password" type="text" required autoComplete="off" />
              </Field>
              <Field label="Uloga" htmlFor="new-role">
                <Select id="new-role" name="role" defaultValue="USER">
                  <option value="USER">Korisnik</option>
                  <option value="ADMIN">Administrator</option>
                </Select>
              </Field>
            </div>
            <SubmitButton size="sm">Kreiraj</SubmitButton>
            <p className="text-xs text-ink-faint">
              Korisnik će morati promijeniti lozinku tek nakon što mu je ti resetiraš — ovu
              početnu mu proslijedi sam.
            </p>
          </ActionForm>
        ) : null}

        <div className="-mx-2 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-2 py-2 font-medium">Nadimak</th>
                <th className="px-2 py-2 font-medium">Korisničko ime</th>
                <th className="px-2 py-2 font-medium">Uloga</th>
                <th className="px-2 py-2 font-medium">Zadnja prijava</th>
                <th className="px-2 py-2 text-right font-medium">Radnje</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/6 align-middle">
                  <td className="px-2 py-2.5">
                    <span className={cn('text-sm font-medium', user.isActive ? 'text-ink' : 'text-ink-faint line-through')}>
                      {user.nickname}
                    </span>
                    {user.mustChangePassword ? (
                      <span className="ml-1.5 text-[10px] uppercase text-gold">reset</span>
                    ) : null}
                  </td>

                  <td className="px-2 py-2.5 text-sm text-ink-muted">{user.username}</td>

                  <td className="px-2 py-2.5">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                        user.role === 'ADMIN'
                          ? 'bg-hajduk-red/15 text-hajduk-red-soft'
                          : 'bg-white/8 text-ink-muted',
                      )}
                    >
                      {user.role === 'ADMIN' ? 'Admin' : 'Korisnik'}
                    </span>
                  </td>

                  <td className="px-2 py-2.5 text-xs text-ink-faint">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'nikad'}
                  </td>

                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                      >
                        Uredi
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResettingId(resettingId === user.id ? null : user.id)}
                      >
                        Lozinka
                      </Button>

                      <ActionButton
                        action={toggleUserActiveAction}
                        fields={{ id: user.id, isActive: String(!user.isActive) }}
                        size="sm"
                        variant="ghost"
                      >
                        {user.isActive ? 'Deaktiviraj' : 'Aktiviraj'}
                      </ActionButton>

                      {user.id === currentUserId ? null : (
                        <ActionButton
                          action={deleteUserAction}
                          fields={{ id: user.id }}
                          size="sm"
                          variant="danger"
                          confirm={`Obrisati ${user.nickname}? Time nestaju i sve njegove prognoze i bodovi. Ovo se ne može poništiti.`}
                        >
                          Obriši
                        </ActionButton>
                      )}
                    </div>

                    {editingId === user.id ? (
                      <ActionForm
                        action={updateUserAction}
                        onSuccess={() => setEditingId(null)}
                        className="mt-2 flex flex-wrap items-end justify-end gap-2 rounded-xl border border-white/10 bg-white/4 p-3"
                      >
                        <input type="hidden" name="id" value={user.id} />
                        <div className="w-40">
                          <Field label="Nadimak" htmlFor={`nick-${user.id}`}>
                            <Input
                              id={`nick-${user.id}`}
                              name="nickname"
                              defaultValue={user.nickname}
                              required
                            />
                          </Field>
                        </div>
                        <div className="w-36">
                          <Field label="Uloga" htmlFor={`role-${user.id}`}>
                            <Select id={`role-${user.id}`} name="role" defaultValue={user.role}>
                              <option value="USER">Korisnik</option>
                              <option value="ADMIN">Administrator</option>
                            </Select>
                          </Field>
                        </div>
                        <SubmitButton size="sm">Spremi</SubmitButton>
                      </ActionForm>
                    ) : null}

                    {resettingId === user.id ? (
                      <ActionForm
                        action={resetPasswordAction}
                        onSuccess={() => setResettingId(null)}
                        className="mt-2 flex flex-wrap items-end justify-end gap-2 rounded-xl border border-white/10 bg-white/4 p-3"
                      >
                        <input type="hidden" name="id" value={user.id} />
                        <div className="w-56">
                          <Field
                            label="Nova lozinka"
                            htmlFor={`pw-${user.id}`}
                            hint="Korisnik je mora promijeniti pri sljedećoj prijavi."
                          >
                            <Input
                              id={`pw-${user.id}`}
                              name="newPassword"
                              type="text"
                              required
                              autoComplete="off"
                            />
                          </Field>
                        </div>
                        <SubmitButton size="sm">Resetiraj</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
