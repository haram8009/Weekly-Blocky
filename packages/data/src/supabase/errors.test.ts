import { describe, expect, it } from 'vitest';

import { createSupabaseMutationError, getSupabaseStorageErrorMessage } from './errors';

describe('Supabase storage errors', () => {
  it('returns the user-facing message for server save failures', () => {
    const error = createSupabaseMutationError(
      '서버에 저장하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
      { message: 'Failed to fetch' },
    );

    expect(error.message).toBe('Failed to fetch');
    expect(getSupabaseStorageErrorMessage(error)).toBe(
      '서버에 저장하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
    );
  });

  it('uses a retryable fallback message for unknown failures', () => {
    expect(getSupabaseStorageErrorMessage(new Error('Failed to fetch'))).toBe(
      '서버 요청 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    );
  });
});
