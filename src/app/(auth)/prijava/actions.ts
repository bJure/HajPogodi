'use server';

import { AuthError } from 'next-auth';
import { loginSchema } from '@/application/dto/user';
import { Errors } from '@/domain/shared/DomainError';
import { signIn } from '@/infrastructure/auth/auth';
import { RATE_LIMIT_MESSAGE } from '@/infrastructure/auth/rateLimit';
import { actionErr, actionOk, parseInput, withAction, type ActionResult } from '@/lib/action';

/**
 * Sign-in action.
 *
 * All credential failures return the same message on purpose: telling the user
 * whether the username exists would hand an attacker a free account enumerator.
 * Lockout and deactivation are distinguishable because the user genuinely needs
 * to know what to do next, and neither leaks whether a password was correct.
 */
export async function loginAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  return withAction('login', async () => {
    const input = parseInput(loginSchema, {
      username: formData.get('username'),
      password: formData.get('password'),
    });

    const rawNext = formData.get('nastavi');
    // Only relative paths - an absolute URL here would be an open redirect.
    const redirectTo =
      typeof rawNext === 'string' && rawNext.startsWith('/') && !rawNext.startsWith('//')
        ? rawNext
        : '/pocetna';

    try {
      await signIn('credentials', {
        username: input.username,
        password: input.password,
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const cause = error.cause?.err?.message ?? '';

        if (cause.includes('RATE_LIMITED')) {
          return actionErr(Errors.rateLimited(RATE_LIMIT_MESSAGE));
        }
        if (cause.includes('INACTIVE')) {
          return actionErr(Errors.inactiveUser());
        }
        return actionErr(Errors.validation('Neispravno korisničko ime ili lozinka.'));
      }
      throw error;
    }

    return actionOk({ redirectTo });
  });
}
