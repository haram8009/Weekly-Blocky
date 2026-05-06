import Link from 'next/link';

import { LoginForm } from '@/components/LoginForm';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import styles from './page.module.css';

export default function LoginPage() {
  const envStatus = getSupabaseEnvStatus();

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.copy}>
          <p className={styles.product}>Weekly</p>
          <h1 id="login-title">데스크톱에서 이번 주를 확인합니다</h1>
          <p>
            모바일에서 남긴 10분 단위 기록을 넓은 화면에서 열람하고 회고로 이어갑니다. 사진 원본은
            자동 업로드하지 않습니다.
          </p>
        </div>

        <LoginForm isSupabaseConfigured={envStatus.isConfigured} />

        {!envStatus.isConfigured ? (
          <p className={styles.notice}>
            Supabase 환경 변수가 아직 비어 있습니다. 앱별 .env 파일에 URL과 publishable key를
            설정해야 합니다.
          </p>
        ) : null}

        <Link className={styles.previewLink} href="/week">
          주간 열람 화면 미리보기
        </Link>
      </section>
    </main>
  );
}
