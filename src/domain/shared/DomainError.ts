/**
 * Every expected failure in the system has a code here. The code is stable and
 * machine-readable; `message` is the Croatian text shown to the user.
 */
export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'PREDICTION_LOCKED'
  | 'MATCH_NOT_OPEN'
  | 'RATE_LIMITED'
  | 'EXTERNAL_SERVICE'
  | 'INACTIVE_USER';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  /** Field-level messages, keyed by form field name. */
  readonly fields?: Readonly<Record<string, string>>;
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  fields?: Record<string, string>,
): DomainError {
  return fields ? { code, message, fields } : { code, message };
}

export const Errors = {
  validation: (message = 'Podaci nisu ispravni.', fields?: Record<string, string>) =>
    domainError('VALIDATION', message, fields),

  notFound: (what = 'Traženi zapis') => domainError('NOT_FOUND', `${what} ne postoji.`),

  unauthorized: () => domainError('UNAUTHORIZED', 'Nisi prijavljen.'),

  forbidden: () => domainError('FORBIDDEN', 'Nemaš ovlasti za ovu radnju.'),

  conflict: (message: string) => domainError('CONFLICT', message),

  predictionLocked: () =>
    domainError('PREDICTION_LOCKED', 'Prognoze su zaključane, utakmica je počela.'),

  matchNotOpen: () =>
    domainError('MATCH_NOT_OPEN', 'Ova utakmica još nije otvorena za prognoze.'),

  rateLimited: (message: string) => domainError('RATE_LIMITED', message),

  externalService: (service: string) =>
    domainError('EXTERNAL_SERVICE', `Servis ${service} trenutno nije dostupan.`),

  inactiveUser: () =>
    domainError('INACTIVE_USER', 'Tvoj račun je deaktiviran. Javi se administratoru.'),
} as const;
