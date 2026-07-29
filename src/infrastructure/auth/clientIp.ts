import 'server-only';
import { headers } from 'next/headers';

/**
 * Best-effort client IP, used only for rate limiting.
 *
 * Order matters. `x-forwarded-for` is a client-settable header: anything a
 * caller sends arrives in it, and reading the first entry of that chain means
 * reading whatever the caller typed - which turns a per-IP limit into no limit
 * at all. `x-vercel-forwarded-for` is written by the platform on every request
 * and cannot be spoofed from outside, so it is the only value trusted here.
 *
 * The fallbacks exist for local development and for a self-hosted deployment.
 * If this app is ever moved behind a different proxy, this function is the one
 * place that has to learn that proxy's trusted header - and until it does, the
 * per-IP limit degrades to a single 'unknown' bucket rather than silently
 * accepting forged values.
 */
export async function clientIp(): Promise<string> {
  const headerList = await headers();

  const trusted = headerList.get('x-vercel-forwarded-for');
  if (trusted) return trusted.split(',')[0]?.trim() ?? 'unknown';

  if (process.env.VERCEL) return 'unknown';

  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';

  return headerList.get('x-real-ip') ?? 'unknown';
}
