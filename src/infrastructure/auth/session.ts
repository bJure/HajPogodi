import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { Errors } from '@/domain/shared/DomainError';
import { throwDomain } from '@/lib/action';
import { userRepository } from '@/infrastructure/repositories/userRepository';
import { auth } from './auth';

/**
 * Authorization helpers.
 *
 * These are the authority - middleware only improves the UX by redirecting
 * early. Every server action and protected page calls one of these, and they
 * re-read the user from the database so that deactivating or demoting someone
 * takes effect on their very next request rather than at token expiry.
 *
 * `cache` deduplicates the lookup within a single request, so a page that calls
 * this from a layout and three components still performs one query.
 */
export interface CurrentUser {
  readonly id: string;
  readonly username: string;
  readonly nickname: string;
  readonly role: 'ADMIN' | 'USER';
  readonly mustChangePassword: boolean;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await userRepository.findById(session.user.id);
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
});

/** For pages: redirects to the login screen when not signed in. */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/prijava');
  return user;
}

/** For pages: redirects non-admins away instead of showing an error. */
export async function requirePageAdmin(): Promise<CurrentUser> {
  const user = await requirePageUser();
  if (user.role !== 'ADMIN') redirect('/pocetna');
  return user;
}

/** For server actions: fails with a typed domain error the form can render. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throwDomain(Errors.unauthorized());
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throwDomain(Errors.forbidden());
  return user;
}
