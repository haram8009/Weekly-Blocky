import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './AppShell.module.css';

const navItems = [
  { href: '/week', label: '이번 주' },
  { href: '/week', label: '회고' },
  { href: '/week', label: '카테고리' },
  { href: '/week', label: '내보내기' },
  { href: '/week', label: '설정' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
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
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
