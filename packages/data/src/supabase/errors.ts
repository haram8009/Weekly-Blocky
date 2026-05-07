export type SupabaseStorageErrorKind =
  | 'AUTH_REQUIRED'
  | 'AUTH_LOOKUP_FAILED'
  | 'QUERY_FAILED'
  | 'MUTATION_FAILED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED';

export class SupabaseStorageError extends Error {
  readonly kind: SupabaseStorageErrorKind;
  readonly userMessage: string;
  readonly originalError: unknown;

  constructor(
    kind: SupabaseStorageErrorKind,
    userMessage: string,
    technicalMessage: string,
    originalError: unknown = null,
  ) {
    super(technicalMessage);
    this.name = 'SupabaseStorageError';
    this.kind = kind;
    this.userMessage = userMessage;
    this.originalError = originalError;
  }
}

export function getSupabaseStorageErrorMessage(error: unknown): string {
  if (error instanceof SupabaseStorageError) {
    return error.userMessage;
  }

  return '서버 요청 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export function createSupabaseQueryError(message: string, error: { message: string }): SupabaseStorageError {
  return new SupabaseStorageError('QUERY_FAILED', message, error.message, error);
}

export function createSupabaseMutationError(message: string, error: { message: string }): SupabaseStorageError {
  return new SupabaseStorageError('MUTATION_FAILED', message, error.message, error);
}
