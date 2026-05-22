# Review Quantitative Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the review memo UI with quantitative weekly and daily time-use charts based on category color groups.

**Architecture:** Put all chart aggregation in `packages/domain` so mobile and web render the same derived data. Mobile fetches weekly time entries and categories directly in the review tab, then renders SVG line and donut charts with `react-native-svg`. Web reuses the same domain function and replaces the week page review form with SVG chart sections.

**Tech Stack:** TypeScript, React Native + Expo, Next.js, Supabase data helpers, Vitest, `react-native-svg`.

---

## File Map

- Modify `packages/domain/src/weeklyStats.ts`: add review chart types and `createReviewChartData`.
- Modify `packages/domain/src/weeklyStats.test.ts`: add coverage for color grouping, top 6 plus other, daily ratios, empty days, and archived categories.
- Modify `apps/mobile/package.json`: add `react-native-svg`.
- Modify `apps/mobile/app/(tabs)/review.tsx`: remove week review memo loading/saving and render quantitative charts from weekly entries/categories.
- Modify `apps/web/src/app/week/page.tsx`: remove review memo form and render the same chart sections in the side panel.
- Modify `apps/web/src/app/week/page.module.css`: add styles for line chart, day tabs, donut chart, and total table.
- Modify `docs/mvp/02-MVP-기능명세.md`, `docs/mvp/03-MVP-화면설계.md`, and `PLAN.md`: replace review memo-centered wording with quantitative chart wording.

Do not commit unless the user explicitly asks. Keep `.superpowers/` untracked unless a separate cleanup decision is made.

---

## Task 1: Domain Chart Data

**Files:**
- Modify: `packages/domain/src/weeklyStats.ts`
- Test: `packages/domain/src/weeklyStats.test.ts`

- [ ] **Step 1: Add failing tests for review chart data**

Add tests to `packages/domain/src/weeklyStats.test.ts` that cover these cases:

```ts
import {
  createReviewChartData,
  type ReviewChartCategoryLike,
  type ReviewChartEntryLike,
} from './weeklyStats';

const categories: ReviewChartCategoryLike[] = [
  { id: 'work', name: '업무', emoji: '💼', color: '#2563EB' },
  { id: 'meeting', name: '회의', emoji: '🗓️', color: '#2563EB' },
  { id: 'exercise', name: '운동', emoji: '🏃', color: '#16A34A' },
  { id: 'waste', name: '낭비한 시간', emoji: '🌀', color: '#DC2626' },
];

const entries: ReviewChartEntryLike[] = [
  { date: '2026-05-18', startTime: '09:00', endTime: '11:00', categoryId: 'work' },
  { date: '2026-05-18', startTime: '11:00', endTime: '12:00', categoryId: 'meeting' },
  { date: '2026-05-18', startTime: '19:00', endTime: '20:00', categoryId: 'exercise' },
  { date: '2026-05-19', startTime: '21:00', endTime: '23:00', categoryId: 'waste' },
];

it('groups review chart data by category color', () => {
  const chartData = createReviewChartData({
    entries,
    categories,
    weekStartDate: '2026-05-18',
  });

  expect(chartData.groups[0]).toMatchObject({
    color: '#2563EB',
    label: '업무 외 1개',
    categoryNames: ['업무', '회의'],
    totalMinutes: 180,
  });
  expect(chartData.groups[0]?.dailyPoints[0]).toMatchObject({
    date: '2026-05-18',
    minutes: 180,
    ratio: 75,
  });
});

it('creates daily donut segments for the selected weekday', () => {
  const chartData = createReviewChartData({
    entries,
    categories,
    weekStartDate: '2026-05-18',
  });

  expect(chartData.dailyBreakdowns[0]?.segments).toEqual([
    expect.objectContaining({ color: '#2563EB', minutes: 180, ratio: 75 }),
    expect.objectContaining({ color: '#16A34A', minutes: 60, ratio: 25 }),
  ]);
});

it('returns zero ratios for days without entries', () => {
  const chartData = createReviewChartData({
    entries,
    categories,
    weekStartDate: '2026-05-18',
  });

  expect(chartData.dailyBreakdowns[2]).toMatchObject({
    date: '2026-05-20',
    recordedMinutes: 0,
    segments: [],
  });
  expect(chartData.groups[0]?.dailyPoints[2]).toMatchObject({ minutes: 0, ratio: 0 });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
corepack pnpm vitest run packages/domain/src/weeklyStats.test.ts
```

Expected: failure because `createReviewChartData` and related exported types do not exist yet.

- [ ] **Step 3: Add domain types and implementation**

In `packages/domain/src/weeklyStats.ts`, add:

```ts
export type ReviewChartEntryLike = WeeklyStatsEntryLike;
export type ReviewChartCategoryLike = WeeklyStatsCategoryLike;

export type ReviewChartDailyPoint = {
  date: DateString;
  weekdayLabel: string;
  minutes: number;
  ratio: number;
};

export type ReviewChartGroup = {
  key: string;
  color: string;
  label: string;
  categoryNames: string[];
  totalMinutes: number;
  ratio: number;
  peakDate: DateString | null;
  peakWeekdayLabel: string | null;
  dailyPoints: ReviewChartDailyPoint[];
};

export type ReviewChartDailyBreakdown = {
  date: DateString;
  weekdayLabel: string;
  recordedMinutes: number;
  segments: Array<{
    key: string;
    color: string;
    label: string;
    minutes: number;
    ratio: number;
  }>;
};

export type ReviewChartData = {
  weekDates: DateString[];
  groups: ReviewChartGroup[];
  dailyBreakdowns: ReviewChartDailyBreakdown[];
};

export type CreateReviewChartDataInput = {
  entries: readonly ReviewChartEntryLike[];
  categories: readonly ReviewChartCategoryLike[];
  weekStartDate: DateString;
  maxGroups?: number;
};
```

Implement `createReviewChartData` in the same file. Requirements:

- Use `getDatesOfWeek(weekStartDate)`.
- Ignore entries outside the selected week and entries with `deletedAt`.
- Group by category `color`.
- Use fallback category values already defined in `weeklyStats.ts` when category lookup fails.
- Pick the representative category name by the highest total minutes inside the color group.
- Label single-category groups as the category name.
- Label multi-category groups as `${representativeName} 외 ${categoryNames.length - 1}개`.
- Sort groups by `totalMinutes` descending, then label ascending.
- Keep the first `maxGroups` groups, default `6`.
- Combine all remaining groups into a final `기타` group with color `#64748B`.
- Daily ratios use `Math.round((groupDayMinutes / dayRecordedMinutes) * 100)`.
- Weekly ratios use `Math.round((groupTotalMinutes / weeklyRecordedMinutes) * 100)`.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
corepack pnpm vitest run packages/domain/src/weeklyStats.test.ts
```

Expected: all `weeklyStats` tests pass.

---

## Task 2: Mobile Dependency and Review Data Loading

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/mobile/app/(tabs)/review.tsx`

- [ ] **Step 1: Add `react-native-svg`**

Run:

```bash
corepack pnpm --filter @weekly/mobile add react-native-svg
```

Expected: `apps/mobile/package.json` and `pnpm-lock.yaml` change.

- [ ] **Step 2: Replace review memo state with stats state**

In `apps/mobile/app/(tabs)/review.tsx`, remove imports and state related to:

- `WeekReview`
- `getMobileWeekReviewByWeekStartDate`
- `upsertMobileWeekReview`
- `getSupabaseStorageErrorMessage`
- `TextInput`
- `ReviewTextField`
- `reviewDraft`
- `weekReview`
- review save/load state

Add imports:

```ts
import {
  addDaysToDate,
  createReviewChartData,
  createWeeklyStats,
  formatDuration,
  getDatesOfWeek,
  getWeekStartDate,
  type Category,
  type DateString,
  type TimeEntry,
} from '@weekly/domain';
import Svg, { Circle, Path, Polyline, Text as SvgText } from 'react-native-svg';
import { listMobileCategories } from '@/lib/supabase/categories';
import { listMobileTimeEntriesByWeek } from '@/lib/supabase/timeEntries';
```

If `formatDuration` does not exist in `@weekly/domain`, keep or add a local `formatDuration(minutes: number)` helper in `review.tsx`.

- [ ] **Step 3: Load weekly entries and categories**

Add local state:

```ts
type ReviewChartLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';

const [entries, setEntries] = useState<TimeEntry[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
const [loadState, setLoadState] = useState<ReviewChartLoadState>('idle');
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [selectedDate, setSelectedDate] = useState<DateString>(todayDate);
```

Replace the review load effect with `loadReviewChartData(visibleWeekStartDate)`, using:

```ts
const [nextEntries, nextCategories] = await Promise.all([
  listMobileTimeEntriesByWeek(weekStartDate),
  listMobileCategories({ includeArchived: true }),
]);
```

Keep the existing Supabase environment check and request id guard.

- [ ] **Step 4: Derive stats and chart data**

Use `useMemo`:

```ts
const weeklyStats = useMemo(
  () =>
    createWeeklyStats({
      entries,
      categories,
      weekStartDate: visibleWeekStartDate,
    }),
  [categories, entries, visibleWeekStartDate],
);

const chartData = useMemo(
  () =>
    createReviewChartData({
      entries,
      categories,
      weekStartDate: visibleWeekStartDate,
    }),
  [categories, entries, visibleWeekStartDate],
);

const selectedDailyBreakdown =
  chartData.dailyBreakdowns.find((day) => day.date === selectedDate) ?? chartData.dailyBreakdowns[0];
```

When `visibleWeekStartDate` changes, set `selectedDate` to the first date in that week unless today is inside the selected week.

---

## Task 3: Mobile Chart UI

**Files:**
- Modify: `apps/mobile/app/(tabs)/review.tsx`

- [ ] **Step 1: Render quantitative review sections**

Keep the existing header and week navigator. Replace the memo section with:

- `MetricCards`
- `WeeklyRatioLineChart`
- `WeekdayTabs`
- `DailyDonutChart`
- `WeeklyTotalsTable`

Use empty states:

- Loading: `회고 차트를 불러오고 있습니다.`
- No entries: `이 주에는 아직 기록된 시간이 없습니다.`
- Error: existing retry style with `다시 불러오기`.

- [ ] **Step 2: Implement mobile metric cards**

Render four compact cards:

```tsx
<MetricCard label="총 기록" value={formatDuration(weeklyStats.recordedMinutes)} />
<MetricCard label="미기록" value={formatDuration(weeklyStats.unrecordedMinutes)} />
<MetricCard label="완성률" value={`${weeklyStats.completionRate}%`} />
<MetricCard label="낭비한 시간" value={formatDuration(weeklyStats.wastedMinutes)} tone="danger" />
```

- [ ] **Step 3: Implement mobile line chart**

Use `react-native-svg`:

- Chart width: `320`.
- Chart height: `180`.
- Y max: `100`.
- X positions: seven evenly spaced points.
- Y position: `height - (ratio / 100) * height`.
- Draw one `Polyline` per chart group.
- Draw weekday labels below the chart with React Native `Text`, not SVG text, to keep layout simple.
- Show legend under the chart with color swatches and group labels.

- [ ] **Step 4: Implement weekday tabs and donut chart**

Weekday tabs:

```tsx
{chartData.dailyBreakdowns.map((day) => (
  <Pressable key={day.date} onPress={() => setSelectedDate(day.date)}>
    <Text>{day.weekdayLabel}</Text>
  </Pressable>
))}
```

Donut chart:

- Radius: `54`.
- Stroke width: `18`.
- Circumference: `2 * Math.PI * radius`.
- Render one `Circle` per segment with `strokeDasharray` and `strokeDashoffset`.
- Rotate each segment by `-90 + accumulatedRatio * 3.6`.
- If no segments, render a muted ring and `기록 없음`.

- [ ] **Step 5: Implement mobile total table**

Show each group as a row:

- color swatch
- `group.label`
- included category names joined by `, `
- `formatDuration(group.totalMinutes)`
- `${group.ratio}%`
- `group.peakWeekdayLabel ?? '-'`

- [ ] **Step 6: Run mobile typecheck**

Run:

```bash
corepack pnpm --filter @weekly/mobile typecheck
```

Expected: TypeScript passes.

---

## Task 4: Web Review Chart UI

**Files:**
- Modify: `apps/web/src/app/week/page.tsx`
- Modify: `apps/web/src/app/week/page.module.css`

- [ ] **Step 1: Remove web review memo flow**

In `apps/web/src/app/week/page.tsx`, remove:

- `WeekReview` imports.
- `getWebWeekReviewByWeekStartDate` and `upsertWebWeekReview`.
- review draft/load/save state.
- `loadWeekReview`, `saveWeekReview`, `handleReviewSubmit`, `updateReviewDraft`.
- the `<section className={styles.reviewPanel}>` form.

Keep CSV export behavior unchanged.

- [ ] **Step 2: Add selected day state and chart data**

Add:

```ts
const [selectedReviewDate, setSelectedReviewDate] = useState<DateString>(visibleWeekStartDate);

const reviewChartData = useMemo(
  () =>
    createReviewChartData({
      entries: visibleEntries,
      categories,
      weekStartDate: visibleWeekStartDate,
    }),
  [categories, visibleEntries, visibleWeekStartDate],
);
```

When `visibleWeekStartDate` changes, reset `selectedReviewDate` to the first visible week date.

- [ ] **Step 3: Render web review chart sections**

Add a new side panel section after `통계 합계` and before CSV:

```tsx
<section className={styles.reviewChartPanel} aria-labelledby="review-chart-title">
  <div className={styles.panelHeader}>
    <h2 id="review-chart-title">회고 차트</h2>
  </div>
  <WeeklyRatioLineChart chartData={reviewChartData} />
  <WeekdayTabs
    days={reviewChartData.dailyBreakdowns}
    selectedDate={selectedReviewDate}
    onSelectDate={setSelectedReviewDate}
  />
  <DailyDonutChart
    breakdown={
      reviewChartData.dailyBreakdowns.find((day) => day.date === selectedReviewDate) ??
      reviewChartData.dailyBreakdowns[0]
    }
  />
  <ReviewTotalsTable groups={reviewChartData.groups} />
</section>
```

Define these helper components at the bottom of `page.tsx`.

- [ ] **Step 4: Implement web SVG charts**

For `WeeklyRatioLineChart`:

- Use `<svg viewBox="0 0 320 180">`.
- Draw horizontal guide lines at 0%, 50%, 100%.
- Draw one `<polyline>` per group.
- Use the same point formula as mobile.
- Render legend with CSS color swatches.

For `DailyDonutChart`:

- Use `<svg viewBox="0 0 140 140">`.
- Use `<circle>` strokes with `strokeDasharray`.
- Render a muted empty state if there are no segments.

- [ ] **Step 5: Add CSS**

In `apps/web/src/app/week/page.module.css`, add classes:

- `.reviewChartPanel`
- `.chartTitle`
- `.lineChart`
- `.chartLegend`
- `.legendItem`
- `.legendSwatch`
- `.weekdayTabs`
- `.weekdayTab`
- `.dailyBreakdown`
- `.donutChart`
- `.segmentList`
- `.segmentRow`
- `.totalsTable`

Keep card radius at `8px` or less. Avoid nested cards.

- [ ] **Step 6: Run web typecheck**

Run:

```bash
corepack pnpm --filter @weekly/web typecheck
```

Expected: TypeScript passes.

---

## Task 5: MVP Docs and PLAN Update

**Files:**
- Modify: `docs/mvp/02-MVP-기능명세.md`
- Modify: `docs/mvp/03-MVP-화면설계.md`
- Modify: `PLAN.md`

- [ ] **Step 1: Update function spec wording**

In `docs/mvp/02-MVP-기능명세.md`, update F-14 from "주간 회고 메모" to "주간 회고 차트".

New acceptance criteria:

- 주 단위로 색상 그룹별 주간 비율 선 그래프가 표시된다.
- 요일을 선택하면 해당 요일의 색상 그룹 점유율 도넛 차트가 표시된다.
- 색상 그룹별 주간 총 시간, 비율, 가장 높은 요일이 표시된다.
- 미기록 시간은 별도 수치로 표시되고 차트에는 포함하지 않는다.
- 모바일 앱과 데스크톱 웹에서 같은 기록 데이터를 기준으로 계산된다.

- [ ] **Step 2: Update screen design wording**

In `docs/mvp/03-MVP-화면설계.md`, update "화면 7: 주간 회고" composition to:

- 주 선택
- 핵심 수치
- 주간 색상 그룹 비율 선 그래프
- 요일 선택
- 일별 색상 그룹 점유율 도넛 차트
- 주간 총합 표

Remove the current "회고 질문" and "회고 메모" composition from MVP scope.

- [ ] **Step 3: Update PLAN checklist wording**

In `PLAN.md`, replace M6 "주간 회고" checklist items that refer to summary input or memo storage with chart-focused items:

- 모바일 주간 회고 차트 화면 구현
- 주간 색상 그룹 비율 선 그래프 표시
- 요일 선택 시 일별 점유율 도넛 차트 표시
- 주간 색상 그룹 총합 표 표시
- 웹 회고와 모바일 회고 차트 계산 일치 확인

Do not mark new unchecked QA items as complete unless verified.

---

## Task 6: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run all tests**

Run:

```bash
corepack pnpm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run all typechecks**

Run:

```bash
corepack pnpm typecheck
```

Expected: all package and app typechecks pass.

- [ ] **Step 3: Inspect working tree**

Run:

```bash
git status --short
```

Expected: only files from this feature and pre-existing unrelated changes are present. Do not stage or commit unless the user asks.

---

## Self-Review Checklist

- The plan covers domain aggregation, mobile rendering, web rendering, docs, and verification.
- No database migration is required.
- `WeekReview` data remains in the schema but is no longer the primary review tab UI.
- The implementation avoids automatic text insights and goal analysis.
- The plan keeps mobile and web calculations shared through `packages/domain`.

