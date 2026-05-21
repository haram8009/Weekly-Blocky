import type { Category, DateString, TimeEntry, TimeString } from './index';
import { getDatesOfWeek, parseTimeToMinutes, validateTimeRange } from './time';

export const DEFAULT_WEEKLY_STATS_VISIBLE_START_TIME: TimeString = '00:00';
export const DEFAULT_WEEKLY_STATS_VISIBLE_END_TIME: TimeString = '24:00';
export const WASTED_TIME_CATEGORY_NAME = '낭비한 시간';

export type WeeklyStatsEntryLike = Pick<
  TimeEntry,
  'date' | 'startTime' | 'endTime' | 'categoryId'
> &
  Partial<Pick<TimeEntry, 'deletedAt'>>;

export type WeeklyStatsCategoryLike = Pick<Category, 'id' | 'name' | 'emoji' | 'color'>;

export type WeeklyStatsTotal = {
  key: string;
  label: string;
  color: string;
  minutes: number;
  ratio: number;
  isWaste: boolean;
};

export type WeeklyStats = {
  recordedMinutes: number;
  visibleRecordedMinutes: number;
  visibleMinutes: number;
  unrecordedMinutes: number;
  completionRate: number;
  wastedMinutes: number;
  totalsByColor: WeeklyStatsTotal[];
  totalsByName: WeeklyStatsTotal[];
  totalsByEmoji: WeeklyStatsTotal[];
};

export type CreateWeeklyStatsInput = {
  entries: readonly WeeklyStatsEntryLike[];
  categories: readonly WeeklyStatsCategoryLike[];
  weekStartDate: DateString;
  visibleStartTime?: TimeString;
  visibleEndTime?: TimeString;
  wasteCategoryName?: string;
};

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

type EntryDuration = {
  totalMinutes: number;
  visibleMinutes: number;
};

type ReviewChartGroupAccumulator = {
  key: string;
  color: string;
  totalMinutes: number;
  dailyMinutes: Map<DateString, number>;
  categoryMinutes: Map<string, number>;
  categoryNamesById: Map<string, string>;
};

const FALLBACK_CATEGORY: Omit<WeeklyStatsCategoryLike, 'id'> = {
  name: '카테고리 없음',
  emoji: '•',
  color: '#64748B',
};

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const OTHER_GROUP_COLOR = '#64748B';
const OTHER_GROUP_LABEL = '기타';

export function createWeeklyStats({
  entries,
  categories,
  weekStartDate,
  visibleStartTime = DEFAULT_WEEKLY_STATS_VISIBLE_START_TIME,
  visibleEndTime = DEFAULT_WEEKLY_STATS_VISIBLE_END_TIME,
  wasteCategoryName = WASTED_TIME_CATEGORY_NAME,
}: CreateWeeklyStatsInput): WeeklyStats {
  const weekDates = new Set(getDatesOfWeek(weekStartDate));
  const visibleRange = parseVisibleRange(visibleStartTime, visibleEndTime);
  const visibleMinutes = (visibleRange.endMinutes - visibleRange.startMinutes) * weekDates.size;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totalsByColor = new Map<string, Omit<WeeklyStatsTotal, 'ratio'>>();
  const totalsByName = new Map<string, Omit<WeeklyStatsTotal, 'ratio'>>();
  const totalsByEmoji = new Map<string, Omit<WeeklyStatsTotal, 'ratio'>>();
  let recordedMinutes = 0;
  let visibleRecordedMinutes = 0;
  let wastedMinutes = 0;

  for (const entry of entries) {
    if (entry.deletedAt || !weekDates.has(entry.date)) {
      continue;
    }

    const duration = getEntryDuration(entry, visibleRange);

    if (!duration) {
      continue;
    }

    const category = categoryById.get(entry.categoryId) ?? FALLBACK_CATEGORY;
    const isWaste = category.name === wasteCategoryName;

    recordedMinutes += duration.totalMinutes;
    visibleRecordedMinutes += duration.visibleMinutes;

    if (isWaste) {
      wastedMinutes += duration.totalMinutes;
    }

    addWeeklyStatsTotal(
      totalsByColor,
      category.color,
      category.color,
      category.color,
      duration.totalMinutes,
      isWaste,
    );
    addWeeklyStatsTotal(
      totalsByName,
      category.name,
      category.name,
      category.color,
      duration.totalMinutes,
      isWaste,
    );
    addWeeklyStatsTotal(
      totalsByEmoji,
      category.emoji,
      category.emoji,
      category.color,
      duration.totalMinutes,
      isWaste,
    );
  }

  return {
    recordedMinutes,
    visibleRecordedMinutes,
    visibleMinutes,
    unrecordedMinutes: Math.max(visibleMinutes - visibleRecordedMinutes, 0),
    completionRate:
      visibleMinutes > 0
        ? Math.min(Math.round((visibleRecordedMinutes / visibleMinutes) * 100), 100)
        : 0,
    wastedMinutes,
    totalsByColor: sortWeeklyStatsTotals(totalsByColor, recordedMinutes),
    totalsByName: sortWeeklyStatsTotals(totalsByName, recordedMinutes),
    totalsByEmoji: sortWeeklyStatsTotals(totalsByEmoji, recordedMinutes),
  };
}

export function createReviewChartData({
  entries,
  categories,
  weekStartDate,
  maxGroups = 6,
}: CreateReviewChartDataInput): ReviewChartData {
  const weekDates = getDatesOfWeek(weekStartDate);
  const weekDateSet = new Set(weekDates);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const dailyRecordedMinutes = new Map<DateString, number>(
    weekDates.map((date) => [date, 0] as const),
  );
  const groupAccumulators = new Map<string, ReviewChartGroupAccumulator>();

  for (const entry of entries) {
    if (entry.deletedAt || !weekDateSet.has(entry.date)) {
      continue;
    }

    const duration = getEntryDuration(entry, {
      startMinutes: 0,
      endMinutes: 24 * 60,
    });

    if (!duration) {
      continue;
    }

    const category = categoryById.get(entry.categoryId) ?? {
      id: entry.categoryId,
      ...FALLBACK_CATEGORY,
    };
    const group =
      groupAccumulators.get(category.color) ?? createReviewChartGroupAccumulator(category.color);

    group.totalMinutes += duration.totalMinutes;
    group.dailyMinutes.set(
      entry.date,
      (group.dailyMinutes.get(entry.date) ?? 0) + duration.totalMinutes,
    );
    group.categoryMinutes.set(
      category.id,
      (group.categoryMinutes.get(category.id) ?? 0) + duration.totalMinutes,
    );
    group.categoryNamesById.set(category.id, category.name);
    groupAccumulators.set(category.color, group);
    dailyRecordedMinutes.set(
      entry.date,
      (dailyRecordedMinutes.get(entry.date) ?? 0) + duration.totalMinutes,
    );
  }

  const weeklyRecordedMinutes = sumValues(dailyRecordedMinutes);
  const sortedGroups = [...groupAccumulators.values()]
    .map((group) => buildReviewChartGroup(group, weekDates, dailyRecordedMinutes, weeklyRecordedMinutes))
    .sort(
      (first, second) =>
        second.totalMinutes - first.totalMinutes || first.label.localeCompare(second.label),
    );
  const visibleGroups =
    sortedGroups.length > maxGroups
      ? [
          ...sortedGroups.slice(0, maxGroups),
          buildOtherReviewChartGroup(
            sortedGroups.slice(maxGroups),
            weekDates,
            dailyRecordedMinutes,
            weeklyRecordedMinutes,
          ),
        ]
      : sortedGroups;

  return {
    weekDates,
    groups: visibleGroups,
    dailyBreakdowns: weekDates.map((date, index) => ({
      date,
      weekdayLabel: getWeekdayLabel(index),
      recordedMinutes: dailyRecordedMinutes.get(date) ?? 0,
      segments: visibleGroups
        .map((group) => {
          const minutes = group.dailyPoints[index]?.minutes ?? 0;

          return {
            key: group.key,
            color: group.color,
            label: group.label,
            minutes,
            ratio:
              (dailyRecordedMinutes.get(date) ?? 0) > 0
                ? Math.round((minutes / (dailyRecordedMinutes.get(date) ?? 0)) * 100)
                : 0,
          };
        })
        .filter((segment) => segment.minutes > 0),
    })),
  };
}

function parseVisibleRange(
  startTime: TimeString,
  endTime: TimeString,
): {
  startMinutes: number;
  endMinutes: number;
} {
  const validation = validateTimeRange(startTime, endTime);

  if (!validation.isValid) {
    throw new Error(
      `주간 통계 표시 범위가 올바르지 않습니다: ${startTime}-${endTime} (${validation.errors.join(', ')})`,
    );
  }

  return {
    startMinutes: validation.startMinutes,
    endMinutes: validation.endMinutes,
  };
}

function getEntryDuration(
  entry: WeeklyStatsEntryLike,
  visibleRange: {
    startMinutes: number;
    endMinutes: number;
  },
): EntryDuration | null {
  try {
    const startMinutes = parseTimeToMinutes(entry.startTime);
    const endMinutes = parseTimeToMinutes(entry.endTime);
    const totalMinutes = endMinutes - startMinutes;

    if (totalMinutes <= 0) {
      return null;
    }

    return {
      totalMinutes,
      visibleMinutes: Math.max(
        Math.min(endMinutes, visibleRange.endMinutes) -
          Math.max(startMinutes, visibleRange.startMinutes),
        0,
      ),
    };
  } catch {
    return null;
  }
}

function addWeeklyStatsTotal(
  totals: Map<string, Omit<WeeklyStatsTotal, 'ratio'>>,
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
    color: current?.color ?? color,
    minutes: (current?.minutes ?? 0) + minutes,
    isWaste: Boolean(current?.isWaste || isWaste),
  });
}

function sortWeeklyStatsTotals(
  totals: Map<string, Omit<WeeklyStatsTotal, 'ratio'>>,
  recordedMinutes: number,
): WeeklyStatsTotal[] {
  return [...totals.values()]
    .map((total) => ({
      ...total,
      ratio: recordedMinutes > 0 ? Math.round((total.minutes / recordedMinutes) * 100) : 0,
    }))
    .sort(
      (first, second) => second.minutes - first.minutes || first.label.localeCompare(second.label),
    );
}

function createReviewChartGroupAccumulator(color: string): ReviewChartGroupAccumulator {
  return {
    key: color,
    color,
    totalMinutes: 0,
    dailyMinutes: new Map(),
    categoryMinutes: new Map(),
    categoryNamesById: new Map(),
  };
}

function buildReviewChartGroup(
  group: ReviewChartGroupAccumulator,
  weekDates: DateString[],
  dailyRecordedMinutes: Map<DateString, number>,
  weeklyRecordedMinutes: number,
): ReviewChartGroup {
  const categoryNames = getReviewChartCategoryNames(group);
  const label =
    categoryNames.length > 1 ? `${categoryNames[0]} 외 ${categoryNames.length - 1}개` : categoryNames[0];
  const dailyPoints = buildReviewChartDailyPoints(group, weekDates, dailyRecordedMinutes);
  const peakPoint = dailyPoints.reduce<ReviewChartDailyPoint | null>(
    (currentPeak, point) =>
      !currentPeak || point.minutes > currentPeak.minutes ? point : currentPeak,
    null,
  );

  return {
    key: group.key,
    color: group.color,
    label: label ?? FALLBACK_CATEGORY.name,
    categoryNames,
    totalMinutes: group.totalMinutes,
    ratio:
      weeklyRecordedMinutes > 0
        ? Math.round((group.totalMinutes / weeklyRecordedMinutes) * 100)
        : 0,
    peakDate: peakPoint && peakPoint.minutes > 0 ? peakPoint.date : null,
    peakWeekdayLabel: peakPoint && peakPoint.minutes > 0 ? peakPoint.weekdayLabel : null,
    dailyPoints,
  };
}

function buildOtherReviewChartGroup(
  groups: ReviewChartGroup[],
  weekDates: DateString[],
  dailyRecordedMinutes: Map<DateString, number>,
  weeklyRecordedMinutes: number,
): ReviewChartGroup {
  const dailyPoints = weekDates.map((date, index) => {
    const minutes = groups.reduce(
      (totalMinutes, group) => totalMinutes + (group.dailyPoints[index]?.minutes ?? 0),
      0,
    );
    const dayRecordedMinutes = dailyRecordedMinutes.get(date) ?? 0;

    return {
      date,
      weekdayLabel: getWeekdayLabel(index),
      minutes,
      ratio: dayRecordedMinutes > 0 ? Math.round((minutes / dayRecordedMinutes) * 100) : 0,
    };
  });
  const totalMinutes = groups.reduce((sum, group) => sum + group.totalMinutes, 0);
  const peakPoint = dailyPoints.reduce<ReviewChartDailyPoint | null>(
    (currentPeak, point) =>
      !currentPeak || point.minutes > currentPeak.minutes ? point : currentPeak,
    null,
  );

  return {
    key: 'other',
    color: OTHER_GROUP_COLOR,
    label: OTHER_GROUP_LABEL,
    categoryNames: groups.flatMap((group) => group.categoryNames),
    totalMinutes,
    ratio:
      weeklyRecordedMinutes > 0 ? Math.round((totalMinutes / weeklyRecordedMinutes) * 100) : 0,
    peakDate: peakPoint && peakPoint.minutes > 0 ? peakPoint.date : null,
    peakWeekdayLabel: peakPoint && peakPoint.minutes > 0 ? peakPoint.weekdayLabel : null,
    dailyPoints,
  };
}

function buildReviewChartDailyPoints(
  group: ReviewChartGroupAccumulator,
  weekDates: DateString[],
  dailyRecordedMinutes: Map<DateString, number>,
): ReviewChartDailyPoint[] {
  return weekDates.map((date, index) => {
    const minutes = group.dailyMinutes.get(date) ?? 0;
    const dayRecordedMinutes = dailyRecordedMinutes.get(date) ?? 0;

    return {
      date,
      weekdayLabel: getWeekdayLabel(index),
      minutes,
      ratio: dayRecordedMinutes > 0 ? Math.round((minutes / dayRecordedMinutes) * 100) : 0,
    };
  });
}

function getReviewChartCategoryNames(group: ReviewChartGroupAccumulator): string[] {
  return [...group.categoryMinutes.entries()]
    .sort(
      ([firstId, firstMinutes], [secondId, secondMinutes]) =>
        secondMinutes - firstMinutes ||
        (group.categoryNamesById.get(firstId) ?? '').localeCompare(
          group.categoryNamesById.get(secondId) ?? '',
        ),
    )
    .map(([categoryId]) => group.categoryNamesById.get(categoryId) ?? FALLBACK_CATEGORY.name);
}

function sumValues(values: Map<unknown, number>): number {
  return [...values.values()].reduce((sum, value) => sum + value, 0);
}

function getWeekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index] ?? '';
}
