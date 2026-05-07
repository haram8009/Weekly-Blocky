import { getSupabaseClient } from './client';

export type SupabaseAuthConnectionResult = {
  isConnected: boolean;
  errorMessage: string | null;
};

export async function checkMobileSupabaseAuthConnection(): Promise<SupabaseAuthConnectionResult> {
  try {
    const { error } = await getSupabaseClient().auth.getSession();

    return {
      isConnected: !error,
      errorMessage: error?.message ?? null,
    };
  } catch (error) {
    return {
      isConnected: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Supabase Auth 연결 확인 중 알 수 없는 오류가 발생했습니다.',
    };
  }
}
