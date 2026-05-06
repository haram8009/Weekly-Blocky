import { AppShell } from '@/components/AppShell';
import styles from './page.module.css';
import { Fragment } from 'react';

const days = ['월', '화', '수', '목', '금', '토', '일'];
const hours = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

export default function WeekPage() {
  return (
    <AppShell>
      <main className={styles.page}>
        <section className={styles.header} aria-labelledby="week-title">
          <div>
            <p className={styles.eyebrow}>이번 주</p>
            <h1 id="week-title">주간 기록 열람</h1>
          </div>
          <div className={styles.summary}>
            <span>총 기록</span>
            <strong>0시간</strong>
          </div>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.weekGrid} aria-label="주간 기록 그리드">
            <div className={styles.cornerCell} />
            {days.map((day) => (
              <div className={styles.dayCell} key={day}>
                {day}
              </div>
            ))}

            {hours.map((hour) => (
              <Fragment key={hour}>
                <div className={styles.timeCell} key={`${hour}-label`}>
                  {hour}
                </div>
                {days.map((day) => (
                  <div
                    className={styles.blockCell}
                    key={`${hour}-${day}`}
                    aria-label={`${day}요일 ${hour} 기록 없음`}
                  />
                ))}
              </Fragment>
            ))}
          </div>

          <aside className={styles.sidePanel}>
            <h2>카테고리 합계</h2>
            <p>모바일에서 동기화된 기록이 연결되면 합계가 표시됩니다.</p>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
