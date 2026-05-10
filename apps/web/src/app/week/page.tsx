'use client';

import {
  addDaysToDate,
  buildWeekGrid,
  getWeekStartDate,
  parseTimeToMinutes,
  type Category,
  type DateString,
  type TimeEntry,
  type WeekGridBlock,
} from '@weekly/domain';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { listWebCategories } from '@/lib/supabase/categories';
import { listWebTimeEntriesByWeek } from '@/lib/supabase/timeEntries';
import styles from './page.module.css';

const days = ['월', '화', '수', '목', '금', '토', '일'];

type WeekLoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function WeekPage() {
  const todayDate = getLocalDateString();
  const [visibleWeekStartDate, setVisibleWeekStartDate] = useState<DateString>(
    getWeekStartDate(todayDate, 'monday'),
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<WeekLoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const weekGrid = useMemo(
    () => buildWeekGrid({ weekStartDate: visibleWeekStartDate }),
    [visibleWeekStartDate],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const visibleEntries = useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);
  const totalRecordedMinutes = useMemo(
    () =>
      visibleEntries.reduce(
        (total, entry) => total + getEntryDurationMinutes(entry.startTime, entry.endTime),
        0,
      ),
    [visibleEntries],
  );

  useEffect(() => {
    let isActive = true;

    setLoadState('loading');
    setErrorMessage(null);

    Promise.all([listWebTimeEntriesByWeek(visibleWeekStartDate), listWebCategories()])
      .then(([nextEntries, nextCategories]) => {
        if (!isActive) {
          return;
        }

        setEntries(nextEntries);
        setCategories(nextCategories);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setEntries([]);
        setCategories([]);
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : '주간 기록을 불러오지 못했습니다.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [visibleWeekStartDate]);

  function moveWeek(deltaWeeks: number) {
    setVisibleWeekStartDate((currentDate) => addDaysToDate(currentDate, deltaWeeks * 7));
  }

  function moveToCurrentWeek() {
    setVisibleWeekStartDate(getWeekStartDate(getLocalDateString(), 'monday'));
  }

  return (
    <AppShell>
      <main className={styles.page}>
        <section className={styles.header} aria-labelledby="week-title">
          <div>
            <p className={styles.eyebrow}>이번 주</p>
            <h1 id="week-title">주간 기록 열람</h1>
            <p className={styles.weekRange}>
              {weekGrid.dates[0]} - {weekGrid.dates[6]}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={() => moveWeek(-1)}>
              이전 주
            </button>
            <button type="button" onClick={moveToCurrentWeek}>
              오늘
            </button>
            <button type="button" onClick={() => moveWeek(1)}>
              다음 주
            </button>
          </div>
          <div className={styles.summary}>
            <span>총 기록</span>
            <strong>{formatDuration(totalRecordedMinutes)}</strong>
          </div>
        </section>

        {loadState === 'error' ? <p className={styles.statusError}>{errorMessage}</p> : null}
        {loadState === 'loading' || loadState === 'idle' ? (
          <p className={styles.statusText}>주간 기록을 불러오고 있습니다.</p>
        ) : null}

        <section className={styles.contentGrid}>
          <div className={styles.weekGrid} aria-label="주간 기록 그리드">
            <div className={styles.cornerCell} />
            {days.map((day, index) => (
              <div
                className={`${styles.dayCell} ${
                  weekGrid.dates[index] === todayDate ? styles.todayCell : ''
                }`}
                key={day}
              >
                <span>{day}</span>
                <small>{weekGrid.dates[index]?.slice(5).replace('-', '/')}</small>
              </div>
            ))}

            {weekGrid.days[0]?.blocks.map((_, slotIndex) => (
              <Row
                categoryById={categoryById}
                entries={visibleEntries}
                key={slotIndex}
                slotIndex={slotIndex}
                weekDays={weekGrid.days}
              />
            ))}
          </div>

          <aside className={styles.sidePanel}>
            <h2>카테고리 합계</h2>
            {visibleEntries.length === 0 ? (
              <p>이 주에는 아직 서버에 저장된 기록이 없습니다.</p>
            ) : (
              <CategoryTotals entries={visibleEntries} categoryById={categoryById} />
            )}
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function Row({
  categoryById,
  entries,
  slotIndex,
  weekDays,
}: {
  categoryById: Map<string, Category>;
  entries: readonly TimeEntry[];
  slotIndex: number;
  weekDays: ReturnType<typeof buildWeekGrid>['days'];
}) {
  const labelBlock = weekDays[0]?.blocks[slotIndex];
  const showTimeLabel = labelBlock ? labelBlock.startTime.endsWith(':00') : false;

  return (
    <>
      <div className={styles.timeCell}>{showTimeLabel ? labelBlock?.startTime : ''}</div>
      {weekDays.map((day) => {
        const block = day.blocks[slotIndex];
        const entry = block ? getEntryCoveringBlock(block, entries) : null;
        const category = entry ? categoryById.get(entry.categoryId) : null;

        return (
          <div
            aria-label={
              entry ? `${day.date} ${block?.startTime} ${category?.name ?? '기록'}` : undefined
            }
            className={styles.blockCell}
            key={block?.id ?? `${day.date}-${slotIndex}`}
            style={
              category
                ? {
                    background: category.color,
                    borderColor: category.color,
                  }
                : undefined
            }
            title={entry ? `${entry.startTime}-${entry.endTime} ${category?.name ?? ''}` : ''}
          />
        );
      })}
    </>
  );
}

function CategoryTotals({
  categoryById,
  entries,
}: {
  categoryById: Map<string, Category>;
  entries: readonly TimeEntry[];
}) {
  const totals = new Map<string, { color: string; label: string; minutes: number }>();

  for (const entry of entries) {
    const category = categoryById.get(entry.categoryId);
    const label = category ? `${category.emoji} ${category.name}` : '카테고리 없음';
    const current = totals.get(label);
    const minutes = getEntryDurationMinutes(entry.startTime, entry.endTime);

    totals.set(label, {
      color: category?.color ?? '#64748B',
      label,
      minutes: (current?.minutes ?? 0) + minutes,
    });
  }

  return (
    <ul className={styles.totalList}>
      {[...totals.values()]
        .sort((first, second) => second.minutes - first.minutes)
        .map((total) => (
          <li key={total.label}>
            <span style={{ background: total.color }} />
            <strong>{total.label}</strong>
            <em>{formatDuration(total.minutes)}</em>
          </li>
        ))}
    </ul>
  );
}

function getEntryCoveringBlock(
  block: WeekGridBlock,
  entries: readonly TimeEntry[],
): TimeEntry | null {
  return (
    entries.find(
      (entry) =>
        entry.date === block.date &&
        entry.startTime <= block.startTime &&
        entry.endTime >= block.endTime,
    ) ?? null
  );
}

function getEntryDurationMinutes(startTime: string, endTime: string): number {
  try {
    return Math.max(parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime), 0);
  } catch {
    return 0;
  }
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}분`;
  }

  if (remainingMinutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${remainingMinutes}분`;
}

function getLocalDateString(date = new Date()): DateString {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
