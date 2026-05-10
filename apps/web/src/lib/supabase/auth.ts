import { getSupabaseClient } from './client';

export type SupabaseAuthConnectionResult = {
  isConnected: boolean;
  errorMessage: string | null;
};

export async function signInWithEmail(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function checkBrowserSupabaseAuthConnection(): Promise<SupabaseAuthConnectionResult> {
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
