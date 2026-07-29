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
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL je obavezan'),

  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET mora imati barem 32 znaka'),
  AUTH_URL: z.url().optional(),

  CRON_SECRET: z.string().min(16, 'CRON_SECRET mora imati barem 16 znakova'),

  API_FOOTBALL_KEY: z.string().default(''),
  API_FOOTBALL_TEAM_ID: z.coerce.number().int().positive().default(620),

  ANTHROPIC_API_KEY: z.string().default(''),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
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

/** True when live fixture syncing is configured. */
export function isFootballApiEnabled(): boolean {
  return getEnv().API_FOOTBALL_KEY.length > 0;
}
