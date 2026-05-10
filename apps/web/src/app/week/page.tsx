'use client';

import { getSupabaseStorageErrorMessage, SupabaseStorageError } from '@weekly/data';
import {
  addDaysToDate,
  buildWeekGrid,
  createWeeklyStats,
  getWeekStartDate,
  type Category,
  type DateString,
  type PhotoReference,
  type TimeEntry,
  type WeekGridBlock,
  type WeekReview,
  type WeeklyStatsTotal,
} from '@weekly/domain';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { AppShell } from '@/components/AppShell';
import { createWebTimeEntriesCsv } from '@/lib/timeEntriesCsv';
import { listWebCategories } from '@/lib/supabase/categories';
import {
  listWebPhotoReferenceCountsByEntryIds,
  listWebPhotoReferencesByWeek,
} from '@/lib/supabase/photoReferences';
import { listWebTimeEntries, listWebTimeEntriesByWeek } from '@/lib/supabase/timeEntries';
import { getWebWeekReviewByWeekStartDate, upsertWebWeekReview } from '@/lib/supabase/weekReviews';
import styles from './page.module.css';

const days = ['월', '화', '수', '목', '금', '토', '일'];

type WeekLoadState = 'idle' | 'loading' | 'ready' | 'error';
type ReviewLoadState = 'idle' | 'loading' | 'ready' | 'error';
type ReviewSaveState = 'idle' | 'saving' | 'saved' | 'error';
type CsvExportState = 'idle' | 'week' | 'all';
type WeekSummaryMode = 'color' | 'name' | 'emoji';
type ReviewDraft = Pick<WeekReview, 'summary' | 'wins' | 'problems' | 'nextWeekFocus'>;

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
  const [csvExportState, setCsvExportState] = useState<CsvExportState>('idle');
  const [csvExportMessage, setCsvExportMessage] = useState<string | null>(null);
  const [csvExportErrorMessage, setCsvExportErrorMessage] = useState<string | null>(null);
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
    () =>
      createWeeklyStats({
        entries: visibleEntries,
        categories,
        weekStartDate: visibleWeekStartDate,
        visibleStartTime: weekGrid.visibleStartTime,
        visibleEndTime: weekGrid.visibleEndTime,
      }),
    [
      categories,
      visibleEntries,
      visibleWeekStartDate,
      weekGrid.visibleEndTime,
      weekGrid.visibleStartTime,
    ],
  );
  const selectedTotals = getWeeklySummaryTotals(weeklySummary, summaryMode);
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
      setReviewSaveErrorMessage(getSupabaseStorageErrorMessage(error));
    }
  }, [reviewDraft, visibleWeekStartDate]);

  const exportWeekCsv = useCallback(async () => {
    setCsvExportState('week');
    setCsvExportMessage(null);
    setCsvExportErrorMessage(null);

    try {
      const photoCountsByEntryId = await listWebPhotoReferenceCountsByEntryIds(
        visibleEntries.map((entry) => entry.id),
      );
      const csv = createWebTimeEntriesCsv({
        entries: visibleEntries,
        categories,
        photoCountsByEntryId,
      });

      downloadCsv(csv, `weekly-time-entries-week-${visibleWeekStartDate}.csv`);
      setCsvExportMessage('현재 주 CSV 다운로드를 시작했습니다.');
    } catch (error) {
      setCsvExportErrorMessage(getCsvExportErrorMessage(error));
    } finally {
      setCsvExportState('idle');
    }
  }, [categories, visibleEntries, visibleWeekStartDate]);

  const exportAllCsv = useCallback(async () => {
    setCsvExportState('all');
    setCsvExportMessage(null);
    setCsvExportErrorMessage(null);

    try {
      const [nextEntries, nextCategories] = await Promise.all([
        listWebTimeEntries(),
        listWebCategories(),
      ]);
      const photoCountsByEntryId = await listWebPhotoReferenceCountsByEntryIds(
        nextEntries.map((entry) => entry.id),
      );
      const csv = createWebTimeEntriesCsv({
        entries: nextEntries,
        categories: nextCategories,
        photoCountsByEntryId,
      });

      downloadCsv(csv, `weekly-time-entries-all-${getLocalDateString()}.csv`);
      setCsvExportMessage('전체 기록 CSV 다운로드를 시작했습니다.');
    } catch (error) {
      setCsvExportErrorMessage(getCsvExportErrorMessage(error));
    } finally {
      setCsvExportState('idle');
    }
  }, []);

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

            <section className={styles.exportPanel} aria-labelledby="csv-export-title">
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="csv-export-title">CSV 내보내기</h2>
                </div>
              </div>

              <div className={styles.exportActions}>
                <button
                  className={styles.primaryButton}
                  disabled={loadState !== 'ready' || csvExportState !== 'idle'}
                  type="button"
                  onClick={() => void exportWeekCsv()}
                >
                  {csvExportState === 'week' ? '준비 중' : '현재 주 CSV'}
                </button>
                <button
                  className={styles.secondaryButton}
                  disabled={csvExportState !== 'idle'}
                  type="button"
                  onClick={() => void exportAllCsv()}
                >
                  {csvExportState === 'all' ? '준비 중' : '전체 기록 CSV'}
                </button>
              </div>

              {csvExportMessage ? (
                <p className={styles.saveStatus} aria-live="polite">
                  {csvExportMessage}
                </p>
              ) : null}
              {csvExportErrorMessage ? (
                <div className={styles.saveError} aria-live="assertive">
                  <p>내보내기 실패: {csvExportErrorMessage}</p>
                </div>
              ) : null}
            </section>

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

function getWeeklySummaryTotals(
  weeklySummary: ReturnType<typeof createWeeklyStats>,
  mode: WeekSummaryMode,
): readonly WeeklyStatsTotal[] {
  switch (mode) {
    case 'color':
      return weeklySummary.totalsByColor;
    case 'emoji':
      return weeklySummary.totalsByEmoji;
    case 'name':
    default:
      return weeklySummary.totalsByName;
  }
}

function SummaryTotals({ totals }: { totals: readonly WeeklyStatsTotal[] }) {
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

function downloadCsv(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');

  try {
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getCsvExportErrorMessage(error: unknown): string {
  if (error instanceof SupabaseStorageError) {
    return getSupabaseStorageErrorMessage(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'CSV 파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요.';
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
