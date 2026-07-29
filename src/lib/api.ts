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
 * Every route behind this wrapper answers per-user data or triggers work. None
 * of it may be held by the CDN or by a corporate proxy on the way, so the
 * no-store header is set here rather than trusted to route-segment defaults.
 */
function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

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
    return noStore(await fn());
  } catch (error) {
    if (error instanceof AppError) {
      log.info({ code: error.domain.code }, 'zahtjev odbijen');
      return noStore(
        NextResponse.json(
          { error: error.domain.message, code: error.domain.code },
          { status: STATUS_BY_CODE[error.domain.code] },
        ),
      );
    }

    if (error instanceof z.ZodError) {
      log.info({ issues: error.issues.length }, 'neispravan zahtjev');
      return noStore(
        NextResponse.json({ error: 'Neispravan zahtjev.', code: 'VALIDATION' }, { status: 400 }),
      );
    }

    log.error({ err: error }, 'neocekivana greska u ruti');
    return noStore(
      NextResponse.json(
        { error: 'Neočekivana greška.', correlationId: correlationId.slice(0, 8) },
        { status: 500 },
      ),
    );
  }
}
