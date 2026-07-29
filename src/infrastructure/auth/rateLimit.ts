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
