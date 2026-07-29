/**
 * Explicit result type for expected failures.
 *
 * Domain and application code returns `Result` instead of throwing, so that the
 * compiler forces every caller to handle the failure branch. Exceptions stay
 * reserved for genuinely unexpected conditions (a dead database, a bug).
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Unwraps a result, throwing if it failed. Use only where failure is a bug. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Pokusaj citanja neuspjesnog rezultata: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
