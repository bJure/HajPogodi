import 'server-only';
import { loginAttemptRepository } from '@/infrastructure/repositories/supportRepositories';

/**
 * Login throttling backed by the database.
 *
 * A friend-group app on a free tier has no Redis, and does not need one: at
 * this volume counting rows in a 15-minute window is cheap and, unlike an
 * in-memory counter, it survives the process restarts that serverless hosting
 * causes constantly.
 *
 * Both dimensions are checked. Per-username stops someone hammering one
 * account; per-IP stops them spreading the same attack across many usernames.
 */
export const RATE_LIMIT = {
  windowMinutes: 15,
  maxFailuresPerUsername: 5,
  maxFailuresPerIp: 15,
} as const;

export interface RateLimitVerdict {
  readonly blocked: boolean;
  readonly reason: 'USERNAME' | 'IP' | null;
}

export async function checkLoginRateLimit(
  username: string,
  ip: string,
): Promise<RateLimitVerdict> {
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const { byUsername, byIp } = await loginAttemptRepository.countRecentFailures(
    username,
    ip,
    since,
  );

  if (byUsername >= RATE_LIMIT.maxFailuresPerUsername) {
    return { blocked: true, reason: 'USERNAME' };
  }
  if (byIp >= RATE_LIMIT.maxFailuresPerIp) {
    return { blocked: true, reason: 'IP' };
  }
  return { blocked: false, reason: null };
}

export async function recordLoginAttempt(
  username: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await loginAttemptRepository.record(username, ip, success);
  // A successful login clears the failure history so an earlier typo streak
  // cannot lock the account out later in the same window.
  if (success) await loginAttemptRepository.clearFor(username);
}

export const RATE_LIMIT_MESSAGE = `Previše neuspjelih pokušaja. Pokušaj ponovno za ${RATE_LIMIT.windowMinutes} minuta.`;

/**
 * The change-password form asks for the current password, which makes it a
 * second place where a password can be guessed - one that the login throttle
 * does not cover, because reaching it needs a session rather than credentials.
 * A stolen laptop left signed in is exactly the case this closes.
 *
 * Attempts are recorded under a namespaced key so they occupy their own
 * per-username bucket: mistyping the current password five times must not lock
 * the account out of logging in.
 */
const PASSWORD_CHANGE_KEY = (userId: string) => `promjena-lozinke:${userId}`;

export async function checkPasswordChangeRateLimit(
  userId: string,
  ip: string,
): Promise<RateLimitVerdict> {
  return checkLoginRateLimit(PASSWORD_CHANGE_KEY(userId), ip);
}

export async function recordPasswordChangeAttempt(
  userId: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await recordLoginAttempt(PASSWORD_CHANGE_KEY(userId), ip, success);
}
