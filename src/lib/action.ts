import 'server-only';
import { z } from 'zod';
import type { DomainError } from '@/domain/shared/DomainError';
import { Errors } from '@/domain/shared/DomainError';
import { logger, newCorrelationId } from '@/infrastructure/logging/logger';

/**
 * What every server action returns. Never throws across the server/client
 * boundary - React would surface an opaque "server error" and we would lose the
 * Croatian message and the field-level detail the forms need.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: DomainError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionErr<T = never>(error: DomainError): ActionResult<T> {
  return { ok: false, error };
}

/** Thrown by application services to abort with a specific domain error. */
export class AppError extends Error {
  constructor(readonly domain: DomainError) {
    super(domain.message);
    this.name = 'AppError';
  }
}

export function throwDomain(error: DomainError): never {
  throw new AppError(error);
}

function zodToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/**
 * Wraps a server action body with uniform error handling and logging.
 *
 * Expected failures (AppError, ZodError) become typed results. Anything else is
 * a bug: it is logged in full with a correlation id, and the user gets a generic
 * message plus that id so a report can be traced back to the exact log line.
 */
export async function withAction<T>(
  name: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const correlationId = newCorrelationId();
  const log = logger.child({ correlationId, action: name });

  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      log.info({ code: error.domain.code }, 'akcija odbijena');
      return actionErr(error.domain);
    }

    if (error instanceof z.ZodError) {
      log.info({ issues: error.issues.length }, 'neispravan unos');
      return actionErr(Errors.validation('Provjeri unesene podatke.', zodToFields(error)));
    }

    // Next uses thrown sentinels for redirect() and notFound() - never swallow those.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest: unknown }).digest === 'string' &&
      (error as { digest: string }).digest.startsWith('NEXT_')
    ) {
      throw error;
    }

    log.error({ err: error }, 'neocekivana greska u akciji');
    return actionErr({
      code: 'VALIDATION',
      message: `Došlo je do neočekivane greške. Šifra: ${correlationId.slice(0, 8)}`,
    });
  }
}

/** Parses input with a Zod schema, converting failure into a domain error. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throwDomain(Errors.validation('Provjeri unesene podatke.', zodToFields(parsed.error)));
  }
  return parsed.data;
}
