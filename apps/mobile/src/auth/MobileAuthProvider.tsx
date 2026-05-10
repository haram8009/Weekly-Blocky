import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { ensureMobileUserBootstrapData } from '@/lib/supabase/bootstrap';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getMobileSupabaseEnvStatus } from '@/lib/supabase/env';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unconfigured';

type MobileAuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

export function MobileAuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let isActive = true;

    ensureMobileUserBootstrapData().catch((error) => {
      if (!isActive) {
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : '사용자 기본 데이터를 준비하지 못했습니다.',
      );
    });

    return () => {
      isActive = false;
    };
  }, [status, session?.user.id]);

  useEffect(() => {
    const envStatus = getMobileSupabaseEnvStatus();

    if (!envStatus.isConfigured) {
      setStatus('unconfigured');
      setSession(null);
      setErrorMessage('Supabase 환경 변수를 먼저 설정해야 합니다.');
      return;
    }

    let isActive = true;
    const client = getSupabaseClient();

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setStatus('anonymous');
          setSession(null);
          return;
        }

        setSession(data.session);
        setStatus(data.session ? 'authenticated' : 'anonymous');
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '인증 세션 확인에 실패했습니다.');
        setStatus('anonymous');
        setSession(null);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'anonymous');
      setErrorMessage(null);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<MobileAuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      errorMessage,
      async signIn(email, password) {
        const { error } = await getSupabaseClient().auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error(error.message);
        }
      },
      async signUp(email, password) {
        const { error } = await getSupabaseClient().auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error(error.message);
        }
      },
      async signOut() {
        const { error } = await getSupabaseClient().auth.signOut();

        if (error) {
          throw new Error(error.message);
        }
      },
    }),
    [errorMessage, session, status],
  );

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth() {
  const value = useContext(MobileAuthContext);

  if (!value) {
    throw new Error('useMobileAuth must be used within MobileAuthProvider.');
  }

  return value;
}
