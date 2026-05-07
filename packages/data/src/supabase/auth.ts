import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseStorageError } from './errors';

export async function requireCurrentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new SupabaseStorageError(
      'AUTH_LOOKUP_FAILED',
      '로그인 상태를 확인하지 못했습니다. 다시 로그인한 뒤 시도해주세요.',
      error.message,
      error,
    );
  }

  if (!data.user?.id) {
    throw new SupabaseStorageError(
      'AUTH_REQUIRED',
      '로그인이 필요합니다. 로그인한 뒤 다시 시도해주세요.',
      'Authenticated user is required.',
    );
  }

  return data.user.id;
}
