import 'server-only';
import pino from 'pino';
import { getEnv } from '@/lib/env';

/**
 * Structured JSON logging. Vercel captures stdout, so no transport is
 * configured in production; locally pino's default pretty-free output is still
 * readable enough and avoids pulling in pino-pretty as a dependency.
 *
 * `redact` is the safety net that guarantees a password or token can never
 * reach the log stream even if someone logs a whole request object.
 */
const REDACTED_PATHS = [
  'password',
  'newPassword',
  'passwordHash',
  'confirmPassword',
  '*.password',
  '*.passwordHash',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

function createLogger(): pino.Logger {
  let level = 'info';
  try {
    level = getEnv().LOG_LEVEL;
  } catch {
    // Configuration not loaded yet (e.g. during build) - fall back to info.
  }

  return pino({
    level,
    base: { app: 'hajpogodi' },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger: pino.Logger = createLogger();

/**
 * Child logger tagged with a correlation id, so every log line produced while
 * handling one request or job run can be grepped together.
 */
export function withCorrelation(correlationId: string, context?: Record<string, unknown>) {
  return logger.child({ correlationId, ...context });
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}
