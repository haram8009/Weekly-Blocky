'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { signInWithEmail, signUpWithEmail } from '@/lib/supabase/auth';
import styles from './LoginForm.module.css';

type LoginFormProps = {
  isSupabaseConfigured: boolean;
};

type AuthMode = 'signIn' | 'signUp';

export function LoginForm({ isSupabaseConfigured }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [message, setMessage] = useState('이메일과 비밀번호를 입력하세요.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === 'signUp';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase 환경 변수를 먼저 설정해야 합니다.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    if (!email.trim() || password.length < 6) {
      setMessage('이메일과 6자 이상의 비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setMessage(isSignUp ? '회원가입 요청 중입니다.' : '로그인 중입니다.');

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        setMessage('회원가입을 요청했습니다. 이메일 확인이 필요한 경우 메일함을 확인해주세요.');
      } else {
        await signInWithEmail(email, password);
        router.replace('/week');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '인증 요청에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.modeSwitch}>
        <button
          className={mode === 'signIn' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => setMode('signIn')}
          type="button"
        >
          로그인
        </button>
        <button
          className={mode === 'signUp' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => setMode('signUp')}
          type="button"
        >
          회원가입
        </button>
      </div>
      <label>
        이메일
        <input autoComplete="email" name="email" placeholder="you@example.com" required />
      </label>
      <label>
        비밀번호
        <input
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          minLength={6}
          name="password"
          placeholder="비밀번호"
          required
          type="password"
        />
      </label>
      <button disabled={isSubmitting || !isSupabaseConfigured} type="submit">
        {isSubmitting ? '처리 중' : isSignUp ? '회원가입' : '로그인'}
      </button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}
