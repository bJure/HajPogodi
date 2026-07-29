import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { DomainErrorCode } from '@/domain/shared/DomainError';
import { AppError } from '@/lib/action';
import { logger, newCorrelationId } from '@/infrastructure/logging/logger';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  PREDICTION_LOCKED: 409,
  MATCH_NOT_OPEN: 409,
  RATE_LIMITED: 429,
  EXTERNAL_SERVICE: 502,
  INACTIVE_USER: 403,
};

/**
 * Wraps a route handler with the same error contract as server actions, mapping
 * domain error codes onto HTTP status codes.
 */
export async function withRoute(
  name: string,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const log = logger.child({ correlationId, route: name });

  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      log.info({ code: error.domain.code }, 'zahtjev odbijen');
      return NextResponse.json(
        { error: error.domain.message, code: error.domain.code },
        { status: STATUS_BY_CODE[error.domain.code] },
      );
    }

    if (error instanceof z.ZodError) {
      log.info({ issues: error.issues.length }, 'neispravan zahtjev');
      return NextResponse.json({ error: 'Neispravan zahtjev.', code: 'VALIDATION' }, { status: 400 });
    }

    log.error({ err: error }, 'neocekivana greska u ruti');
    return NextResponse.json(
      { error: 'Neočekivana greška.', correlationId: correlationId.slice(0, 8) },
      { status: 500 },
    );
  }
}
