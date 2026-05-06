'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import styles from './LoginForm.module.css';

type LoginFormProps = {
  isSupabaseConfigured: boolean;
};

export function LoginForm({ isSupabaseConfigured }: LoginFormProps) {
  const [message, setMessage] = useState('이메일 로그인 연결 대기 중');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase 환경 변수를 먼저 설정해야 합니다.');
      return;
    }

    createBrowserSupabaseClient();
    setMessage('Supabase 클라이언트를 초기화했습니다.');
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
      <button type="submit">로그인</button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}
