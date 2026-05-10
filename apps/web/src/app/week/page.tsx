'use client';

import {
  addDaysToDate,
  buildWeekGrid,
  getWeekStartDate,
  parseTimeToMinutes,
  WEEK_GRID_SLOT_MINUTES,
  type Category,
  type DateString,
  type PhotoReference,
  type TimeEntry,
  type WeekGridBlock,
  type WeekReview,
} from '@weekly/domain';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { AppShell } from '@/components/AppShell';
import { listWebCategories } from '@/lib/supabase/categories';
import { listWebPhotoReferencesByWeek } from '@/lib/supabase/photoReferences';
import { listWebTimeEntriesByWeek } from '@/lib/supabase/timeEntries';
import { getWebWeekReviewByWeekStartDate, upsertWebWeekReview } from '@/lib/supabase/weekReviews';
import styles from './page.module.css';

const days = ['월', '화', '수', '목', '금', '토', '일'];
const WASTED_TIME_CATEGORY_NAME = '낭비한 시간';
const FALLBACK_CATEGORY = {
  name: '카테고리 없음',
  emoji: '•',
  color: '#64748B',
};

type WeekLoadState = 'idle' | 'loading' | 'ready' | 'error';
type ReviewLoadState = 'idle' | 'loading' | 'ready' | 'error';
type ReviewSaveState = 'idle' | 'saving' | 'saved' | 'error';
type WeekSummaryMode = 'color' | 'name' | 'emoji';
type ReviewDraft = Pick<WeekReview, 'summary' | 'wins' | 'problems' | 'nextWeekFocus'>;
type WeekSummaryTotal = {
  key: string;
  label: string;
  color: string;
  minutes: number;
  ratio: number;
  isWaste: boolean;
};
type WeeklySummary = {
  recordedMinutes: number;
  visibleMinutes: number;
  unrecordedMinutes: number;
  completionRate: number;
  wastedMinutes: number;
  totalsByMode: Record<WeekSummaryMode, WeekSummaryTotal[]>;
};

export default function WeekPage() {
  const todayDate = getLocalDateString();
  const [visibleWeekStartDate, setVisibleWeekStartDate] = useState<DateString>(
    getWeekStartDate(todayDate, 'monday'),
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [photoReferences, setPhotoReferences] = useState<PhotoReference[]>([]);
  const [loadState, setLoadState] = useState<WeekLoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<WeekSummaryMode>('name');
  const [weekReview, setWeekReview] = useState<WeekReview | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(() => createEmptyReviewDraft());
  const [reviewLoadState, setReviewLoadState] = useState<ReviewLoadState>('idle');
  const [reviewSaveState, setReviewSaveState] = useState<ReviewSaveState>('idle');
  const [reviewErrorMessage, setReviewErrorMessage] = useState<string | null>(null);
  const [reviewSaveErrorMessage, setReviewSaveErrorMessage] = useState<string | null>(null);
  const reviewRequestIdRef = useRef(0);
  const visibleWeekStartDateRef = useRef(visibleWeekStartDate);
  const weekGrid = useMemo(
    () => buildWeekGrid({ weekStartDate: visibleWeekStartDate }),
    [visibleWeekStartDate],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const visibleEntries = useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);
  const photoReferencesByEntryId = useMemo(
    () => groupRemotePhotoReferencesByEntryId(photoReferences),
    [photoReferences],
  );
  const weeklySummary = useMemo(
    () => createWeeklySummary(visibleEntries, categories, weekGrid),
    [categories, visibleEntries, weekGrid],
  );
  const selectedTotals = weeklySummary.totalsByMode[summaryMode];
  const latestSavedAtLabel = weekReview ? formatDateTime(weekReview.updatedAt) : '아직 저장 전';

  const loadWeekReview = useCallback((weekStartDate: DateString) => {
    const requestId = reviewRequestIdRef.current + 1;

    reviewRequestIdRef.current = requestId;
    setReviewLoadState('loading');
    setReviewSaveState('idle');
    setReviewErrorMessage(null);
    setReviewSaveErrorMessage(null);
    setWeekReview(null);
    setReviewDraft(createEmptyReviewDraft());

    getWebWeekReviewByWeekStartDate(weekStartDate)
      .then((nextReview) => {
        if (reviewRequestIdRef.current !== requestId) {
          return;
        }

        setWeekReview(nextReview);
        setReviewDraft(createReviewDraft(nextReview));
        setReviewLoadState('ready');
      })
      .catch((error) => {
        if (reviewRequestIdRef.current !== requestId) {
          return;
        }

        setReviewLoadState('error');
        setReviewErrorMessage(
          error instanceof Error ? error.message : '주간 회고를 불러오지 못했습니다.',
        );
      });
  }, []);

  const saveWeekReview = useCallback(async () => {
    const targetWeekStartDate = visibleWeekStartDate;

    setReviewSaveState('saving');
    setReviewSaveErrorMessage(null);

    try {
      const nextReview = await upsertWebWeekReview({
        weekStartDate: targetWeekStartDate,
        summary: reviewDraft.summary,
        wins: reviewDraft.wins,
        problems: reviewDraft.problems,
        nextWeekFocus: reviewDraft.nextWeekFocus,
      });

      if (visibleWeekStartDateRef.current !== targetWeekStartDate) {
        return;
      }

      setWeekReview(nextReview);
      setReviewDraft(createReviewDraft(nextReview));
      setReviewSaveState('saved');
    } catch (error) {
      if (visibleWeekStartDateRef.current !== targetWeekStartDate) {
        return;
      }

      setReviewSaveState('error');
      setReviewSaveErrorMessage(
        error instanceof Error ? error.message : '주간 회고를 저장하지 못했습니다.',
      );
    }
  }, [reviewDraft, visibleWeekStartDate]);

  const handleReviewSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void saveWeekReview();
    },
    [saveWeekReview],
  );

  useEffect(() => {
    visibleWeekStartDateRef.current = visibleWeekStartDate;
  }, [visibleWeekStartDate]);

  useEffect(() => {
    let isActive = true;

    setLoadState('loading');
    setErrorMessage(null);

    Promise.all([
      listWebTimeEntriesByWeek(visibleWeekStartDate),
      listWebCategories(),
      listWebPhotoReferencesByWeek(visibleWeekStartDate),
    ])
      .then(([nextEntries, nextCategories, nextPhotoReferences]) => {
        if (!isActive) {
          return;
        }

        setEntries(nextEntries);
        setCategories(nextCategories);
        setPhotoReferences(nextPhotoReferences);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setEntries([]);
        setCategories([]);
        setPhotoReferences([]);
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : '주간 기록을 불러오지 못했습니다.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [visibleWeekStartDate]);

  useEffect(() => {
    loadWeekReview(visibleWeekStartDate);
  }, [loadWeekReview, visibleWeekStartDate]);

  function moveWeek(deltaWeeks: number) {
    setVisibleWeekStartDate((currentDate) => addDaysToDate(currentDate, deltaWeeks * 7));
  }

  function moveToCurrentWeek() {
    setVisibleWeekStartDate(getWeekStartDate(getLocalDateString(), 'monday'));
  }

  function updateReviewDraft(field: keyof ReviewDraft, value: string) {
    setReviewDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
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
            <strong>{formatDuration(weeklySummary.recordedMinutes)}</strong>
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
                photoReferencesByEntryId={photoReferencesByEntryId}
                slotIndex={slotIndex}
                weekDays={weekGrid.days}
              />
            ))}
          </div>

          <aside className={styles.sidePanel}>
            <h2>주간 요약</h2>
            <ul className={styles.metricsList}>
              <li>
                <span>미기록</span>
                <strong>{formatDuration(weeklySummary.unrecordedMinutes)}</strong>
              </li>
              <li>
                <span>완성률</span>
                <strong>{weeklySummary.completionRate}%</strong>
              </li>
              <li className={weeklySummary.wastedMinutes > 0 ? styles.wasteMetric : undefined}>
                <span>낭비한 시간</span>
                <strong>{formatDuration(weeklySummary.wastedMinutes)}</strong>
              </li>
            </ul>

            <div className={styles.panelHeader}>
              <h2>통계 합계</h2>
              <div className={styles.segmentedControl} aria-label="통계 집계 기준">
                <button
                  aria-pressed={summaryMode === 'name'}
                  type="button"
                  onClick={() => setSummaryMode('name')}
                >
                  이름
                </button>
                <button
                  aria-pressed={summaryMode === 'color'}
                  type="button"
                  onClick={() => setSummaryMode('color')}
                >
                  색상
                </button>
                <button
                  aria-pressed={summaryMode === 'emoji'}
                  type="button"
                  onClick={() => setSummaryMode('emoji')}
                >
                  이모지
                </button>
              </div>
            </div>

            {visibleEntries.length === 0 ? (
              <p>이 주에는 아직 서버에 저장된 기록이 없습니다.</p>
            ) : (
              <SummaryTotals totals={selectedTotals} />
            )}

            <section className={styles.reviewPanel} aria-labelledby="review-title">
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="review-title">회고 메모</h2>
                  <p>마지막 저장: {latestSavedAtLabel}</p>
                </div>
              </div>

              {reviewLoadState === 'idle' || reviewLoadState === 'loading' ? (
                <p className={styles.statusText}>회고를 불러오고 있습니다.</p>
              ) : null}
              {reviewLoadState === 'error' ? (
                <div className={styles.saveError}>
                  <p>회고 조회 실패: {reviewErrorMessage}</p>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => loadWeekReview(visibleWeekStartDate)}
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : null}
              {reviewLoadState === 'ready' ? (
                <form className={styles.reviewForm} onSubmit={handleReviewSubmit}>
                  <label className={styles.formField}>
                    <span>이번 주 요약</span>
                    <textarea
                      rows={3}
                      value={reviewDraft.summary}
                      onChange={(event) => updateReviewDraft('summary', event.target.value)}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>잘한 점</span>
                    <textarea
                      rows={3}
                      value={reviewDraft.wins}
                      onChange={(event) => updateReviewDraft('wins', event.target.value)}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>아쉬운 점</span>
                    <textarea
                      rows={3}
                      value={reviewDraft.problems}
                      onChange={(event) => updateReviewDraft('problems', event.target.value)}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>다음 주 집중</span>
                    <textarea
                      rows={3}
                      value={reviewDraft.nextWeekFocus}
                      onChange={(event) => updateReviewDraft('nextWeekFocus', event.target.value)}
                    />
                  </label>

                  <div className={styles.formActions}>
                    <button
                      className={styles.primaryButton}
                      disabled={reviewSaveState === 'saving'}
                      type="submit"
                    >
                      {reviewSaveState === 'saving' ? '저장 중' : '저장'}
                    </button>
                    {reviewSaveState === 'error' ? (
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => void saveWeekReview()}
                      >
                        재시도
                      </button>
                    ) : null}
                  </div>

                  {reviewSaveState === 'saving' ? (
                    <p className={styles.saveStatus}>회고를 저장하고 있습니다.</p>
                  ) : null}
                  {reviewSaveState === 'saved' ? (
                    <p className={styles.saveStatus}>
                      저장되었습니다. 마지막 저장: {latestSavedAtLabel}
                    </p>
                  ) : null}
                  {reviewSaveState === 'error' ? (
                    <div className={styles.saveError}>
                      <p>저장 실패: {reviewSaveErrorMessage}</p>
                      <p>네트워크 상태를 확인한 뒤 다시 시도하세요.</p>
                    </div>
                  ) : null}
                </form>
              ) : null}
            </section>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function Row({
  categoryById,
  entries,
  photoReferencesByEntryId,
  slotIndex,
  weekDays,
}: {
  categoryById: Map<string, Category>;
  entries: readonly TimeEntry[];
  photoReferencesByEntryId: ReadonlyMap<string, readonly PhotoReference[]>;
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
        const entryPhotoReferences =
          entry && block?.startTime === entry.startTime
            ? (photoReferencesByEntryId.get(entry.id) ?? [])
            : [];

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
          >
            {entryPhotoReferences.length > 0 ? (
              <BlockPhotoIndicator references={entryPhotoReferences} />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function BlockPhotoIndicator({ references }: { references: readonly PhotoReference[] }) {
  const firstReference = references.find((reference) => reference.thumbnailRemoteUrl);

  if (!firstReference?.thumbnailRemoteUrl) {
    return null;
  }

  return (
    <span className={styles.blockPhotoBadge} title={`사진 ${references.length}개`}>
      <img alt="" aria-hidden="true" src={firstReference.thumbnailRemoteUrl} />
      {references.length > 1 ? <span>{formatCompactPhotoCount(references.length)}</span> : null}
    </span>
  );
}

function groupRemotePhotoReferencesByEntryId(
  references: readonly PhotoReference[],
): Map<string, PhotoReference[]> {
  const referencesByEntryId = new Map<string, PhotoReference[]>();

  for (const reference of references) {
    if (
      !reference.entryId ||
      reference.isHidden ||
      reference.deletedAt ||
      !reference.thumbnailRemoteUrl
    ) {
      continue;
    }

    const currentReferences = referencesByEntryId.get(reference.entryId) ?? [];
    currentReferences.push(reference);
    referencesByEntryId.set(reference.entryId, currentReferences);
  }

  return referencesByEntryId;
}

function SummaryTotals({ totals }: { totals: readonly WeekSummaryTotal[] }) {
  return (
    <ul className={styles.totalList}>
      {totals.map((total) => (
        <li className={total.isWaste ? styles.wasteTotal : undefined} key={total.key}>
          <span style={{ background: total.color }} />
          <strong>{total.label}</strong>
          <em>
            {formatDuration(total.minutes)}
            <small>{total.ratio}%</small>
          </em>
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

function createWeeklySummary(
  entries: readonly TimeEntry[],
  categories: readonly Category[],
  weekGrid: ReturnType<typeof buildWeekGrid>,
): WeeklySummary {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totalsByColor = new Map<string, Omit<WeekSummaryTotal, 'ratio'>>();
  const totalsByName = new Map<string, Omit<WeekSummaryTotal, 'ratio'>>();
  const totalsByEmoji = new Map<string, Omit<WeekSummaryTotal, 'ratio'>>();
  let recordedMinutes = 0;
  let wastedMinutes = 0;

  for (const entry of entries) {
    const minutes = getEntryVisibleDurationMinutes(entry, weekGrid);

    if (minutes === 0) {
      continue;
    }

    const category = categoryById.get(entry.categoryId) ?? FALLBACK_CATEGORY;
    const isWaste = category.name === WASTED_TIME_CATEGORY_NAME;

    recordedMinutes += minutes;

    if (isWaste) {
      wastedMinutes += minutes;
    }

    addSummaryTotal(totalsByName, category.name, category.name, category.color, minutes, isWaste);
    addSummaryTotal(
      totalsByColor,
      category.color,
      category.color,
      category.color,
      minutes,
      isWaste,
    );
    addSummaryTotal(
      totalsByEmoji,
      category.emoji,
      category.emoji,
      category.color,
      minutes,
      isWaste,
    );
  }

  const visibleMinutes = weekGrid.totalBlockCount * WEEK_GRID_SLOT_MINUTES;

  return {
    recordedMinutes,
    visibleMinutes,
    unrecordedMinutes: Math.max(visibleMinutes - recordedMinutes, 0),
    completionRate:
      visibleMinutes > 0 ? Math.min(Math.round((recordedMinutes / visibleMinutes) * 100), 100) : 0,
    wastedMinutes,
    totalsByMode: {
      color: sortSummaryTotals(totalsByColor, recordedMinutes),
      name: sortSummaryTotals(totalsByName, recordedMinutes),
      emoji: sortSummaryTotals(totalsByEmoji, recordedMinutes),
    },
  };
}

function addSummaryTotal(
  totals: Map<string, Omit<WeekSummaryTotal, 'ratio'>>,
  key: string,
  label: string,
  color: string,
  minutes: number,
  isWaste: boolean,
) {
  const current = totals.get(key);

  totals.set(key, {
    key,
    label,
    color,
    minutes: (current?.minutes ?? 0) + minutes,
    isWaste: Boolean(current?.isWaste || isWaste),
  });
}

function sortSummaryTotals(
  totals: Map<string, Omit<WeekSummaryTotal, 'ratio'>>,
  recordedMinutes: number,
): WeekSummaryTotal[] {
  return [...totals.values()]
    .map((total) => ({
      ...total,
      ratio: recordedMinutes > 0 ? Math.round((total.minutes / recordedMinutes) * 100) : 0,
    }))
    .sort(
      (first, second) => second.minutes - first.minutes || first.label.localeCompare(second.label),
    );
}

function getEntryVisibleDurationMinutes(
  entry: TimeEntry,
  weekGrid: ReturnType<typeof buildWeekGrid>,
): number {
  if (!weekGrid.dates.includes(entry.date)) {
    return 0;
  }

  try {
    const startMinutes = parseTimeToMinutes(entry.startTime);
    const endMinutes = parseTimeToMinutes(entry.endTime);
    const visibleStartMinutes = parseTimeToMinutes(weekGrid.visibleStartTime);
    const visibleEndMinutes = parseTimeToMinutes(weekGrid.visibleEndTime);

    return Math.max(
      Math.min(endMinutes, visibleEndMinutes) - Math.max(startMinutes, visibleStartMinutes),
      0,
    );
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

function formatCompactPhotoCount(photoCount: number): string {
  return photoCount > 9 ? '9+' : String(photoCount);
}

function createEmptyReviewDraft(): ReviewDraft {
  return {
    summary: '',
    wins: '',
    problems: '',
    nextWeekFocus: '',
  };
}

function createReviewDraft(review: WeekReview | null): ReviewDraft {
  if (!review) {
    return createEmptyReviewDraft();
  }

  return {
    summary: review.summary,
    wins: review.wins,
    problems: review.problems,
    nextWeekFocus: review.nextWeekFocus,
  };
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getLocalDateString(date = new Date()): DateString {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
