import 'server-only';
import { z } from 'zod';

/**
 * Single validated view of the environment. Imported only by infrastructure and
 * server-side code; importing it from a client component is a build error thanks
 * to `server-only`.
 *
 * Validation is lazy so that `next build` can collect pages without a database
 * being reachable, but any code path that actually touches configuration fails
 * loudly and immediately with the exact missing keys.
 */
/**
 * Values that appear in the public `.env.example`. Anything published in a
 * public repository is not a secret, so a secret that still equals its
 * placeholder is treated as missing rather than merely weak - otherwise
 * copying the template and deploying yields a well-known CRON_SECRET that
 * lets anyone drain the football API's daily quota.
 */
const PLACEHOLDERS = new Set([
  'promijeni-me',
  'promijeni-me-odmah',
  'promijeni-me-generiranom-tajnom',
  'changeme',
  'secret',
]);

function notPlaceholder(value: string): boolean {
  return !PLACEHOLDERS.has(value.trim().toLowerCase());
}

const placeholderMessage = (name: string) =>
  `${name} je i dalje vrijednost iz .env.example — postavi vlastitu tajnu`;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL je obavezan'),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET mora imati barem 32 znaka')
    .refine(notPlaceholder, placeholderMessage('AUTH_SECRET')),
  // An empty value in a copied .env means "not set", not "the empty URL" -
  // without this it fails as `Invalid URL`, which says nothing about the fix.
  AUTH_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.url().optional(),
  ),

  CRON_SECRET: z
    .string()
    .min(16, 'CRON_SECRET mora imati barem 16 znakova')
    .refine(notPlaceholder, placeholderMessage('CRON_SECRET')),

  API_FOOTBALL_KEY: z.string().default(''),
  API_FOOTBALL_TEAM_ID: z.coerce.number().int().positive().default(620),

  ANTHROPIC_API_KEY: z.string().default(''),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})
  /**
   * Auth.js runs with `trustHost: true`, which it must on a platform that
   * terminates TLS in front of the app. That makes the Host header the source of
   * truth for callback URLs unless an explicit one is configured - so in
   * production an explicit one is not optional.
   */
  .refine((env) => env.NODE_ENV !== 'production' || Boolean(env.AUTH_URL), {
    path: ['AUTH_URL'],
    message:
      'AUTH_URL je obavezan u produkciji — bez njega Host zaglavlje odreduje callback URL-ove',
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Neispravna konfiguracija okoline:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** True when the optional Claude roast enrichment is configured. */
export function isRoastAiEnabled(): boolean {
  return getEnv().ANTHROPIC_API_KEY.length > 0;
}
