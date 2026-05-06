'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { checkBrowserSupabaseAuthConnection } from '@/lib/supabase/auth';
import styles from './LoginForm.module.css';

type LoginFormProps = {
  isSupabaseConfigured: boolean;
};

export function LoginForm({ isSupabaseConfigured }: LoginFormProps) {
  const [message, setMessage] = useState('이메일 로그인 연결 대기 중');
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase 환경 변수를 먼저 설정해야 합니다.');
      return;
    }

    setIsChecking(true);
    const result = await checkBrowserSupabaseAuthConnection();
    setIsChecking(false);

    if (!result.isConnected) {
      setMessage(`Supabase Auth 연결 실패: ${result.errorMessage}`);
      return;
    }

    setMessage('Supabase Auth 연결을 확인했습니다.');
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        이메일
        <input autoComplete="email" name="email" placeholder="you@example.com" />
      </label>
      <label>
        비밀번호
        <input
          autoComplete="current-password"
          name="password"
          placeholder="비밀번호"
          type="password"
        />
      </label>
      <button disabled={isChecking} type="submit">
        {isChecking ? '확인 중' : '로그인'}
      </button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}
