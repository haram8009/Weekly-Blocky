'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { signOut } from '@/lib/supabase/auth';
import { ensureWebUserBootstrapData } from '@/lib/supabase/bootstrap';
import { getSupabaseClient } from '@/lib/supabase/client';
import styles from './AppShell.module.css';

const navItems = [
  { href: '/week', label: '이번 주' },
  { href: '/week', label: '회고' },
  { href: '/week', label: '카테고리' },
  { href: '/week', label: '내보내기' },
  { href: '/week', label: '설정' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isActive = true;
    const client = getSupabaseClient();

    client.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isActive) {
          return;
        }

        if (!data.session) {
          router.replace('/login');
          return;
        }

        await ensureWebUserBootstrapData();
        setEmail(data.session.user.email ?? null);
        setIsCheckingSession(false);
      })
      .catch(() => {
        if (isActive) {
          router.replace('/login');
        }
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
        return;
      }

      ensureWebUserBootstrapData()
        .then(() => {
          setEmail(session.user.email ?? null);
          setIsCheckingSession(false);
        })
        .catch(() => {
          setEmail(session.user.email ?? null);
          setIsCheckingSession(false);
        });
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isCheckingSession) {
    return (
      <div className={styles.shell}>
        <main className={styles.loading}>세션을 확인하고 있습니다.</main>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/week">
          Weekly
        </Link>
        <nav className={styles.nav} aria-label="웹 전역 내비게이션">
          {navItems.map((item) => (
            <Link className={styles.navItem} href={item.href} key={item.label}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.account}>
          <span>{email ?? '로그인됨'}</span>
          <button disabled={isSigningOut} onClick={() => void handleSignOut()} type="button">
            {isSigningOut ? '로그아웃 중' : '로그아웃'}
          </button>
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
