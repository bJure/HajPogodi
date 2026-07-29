import { describe, expect, it } from 'vitest';
import { issuedBeforePasswordChange } from '@/domain/auth/sessionFreshness';
import { createUserSchema, resetPasswordSchema } from '@/application/dto/user';

/**
 * Sessions are JWTs and therefore not revocable in the database. This
 * comparison is the whole mechanism by which changing a password signs other
 * devices out, so its boundary cases are worth pinning down: too strict and a
 * user is signed out the moment they change their own password, too loose and a
 * stolen token survives the change that was supposed to kill it.
 */
const secondsAt = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

describe('svjezina sesije nakon promjene lozinke', () => {
  it('propusta token kad lozinka nikad nije mijenjana', () => {
    expect(issuedBeforePasswordChange(secondsAt('2026-07-29T10:00:00Z'), null)).toBe(false);
  });

  it('odbija token izdan prije promjene lozinke - to je jedini nacin da se JWT opozove', () => {
    const token = secondsAt('2026-07-01T10:00:00Z');
    const changed = new Date('2026-07-29T10:00:00Z');
    expect(issuedBeforePasswordChange(token, changed)).toBe(true);
  });

  it('propusta token izdan nakon promjene - to je uredaj koji je lozinku i promijenio', () => {
    const token = secondsAt('2026-07-29T10:00:05Z');
    const changed = new Date('2026-07-29T10:00:00Z');
    expect(issuedBeforePasswordChange(token, changed)).toBe(false);
  });

  it('propusta token izdan u istoj sekundi, ali s manje milisekundi', () => {
    // `iat` je u punim sekundama, pa token izdan u 10:00:00.100 nosi 10:00:00.
    // Bez zaokruzivanja promjene lozinke na sekundu, promjena u 10:00:00.900
    // izgleda novije od tokena i odjavljuje covjeka koji ju je upravo obavio.
    const token = secondsAt('2026-07-29T10:00:00.100Z');
    const changed = new Date('2026-07-29T10:00:00.900Z');
    expect(issuedBeforePasswordChange(token, changed)).toBe(false);
  });

  it('odbija token iz prethodne sekunde, jer razlucivost ne smije biti veca od sekunde', () => {
    const token = secondsAt('2026-07-29T09:59:59.000Z');
    const changed = new Date('2026-07-29T10:00:00.000Z');
    expect(issuedBeforePasswordChange(token, changed)).toBe(true);
  });
});

/**
 * The seed has always demanded 12 characters for the first admin. An account
 * whose password an administrator picks is worth exactly as much protection, so
 * every path that sets a password uses the same rule - this test fails if one
 * of them drifts back down.
 */
describe('politika lozinke je jedna za sve putove', () => {
  const base = { username: 'pero', nickname: 'Pero', role: 'USER' as const };

  it('odbija lozinku od 11 znakova pri otvaranju racuna', () => {
    expect(createUserSchema.safeParse({ ...base, password: 'a'.repeat(11) }).success).toBe(false);
  });

  it('prihvaca lozinku od 12 znakova pri otvaranju racuna', () => {
    expect(createUserSchema.safeParse({ ...base, password: 'a'.repeat(12) }).success).toBe(true);
  });

  it('odbija kratku lozinku i kad ju admin postavlja resetom', () => {
    const short = resetPasswordSchema.safeParse({ id: 'u1', newPassword: 'a'.repeat(11) });
    expect(short.success).toBe(false);

    const ok = resetPasswordSchema.safeParse({ id: 'u1', newPassword: 'a'.repeat(12) });
    expect(ok.success).toBe(true);
  });
});
