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

type EntryDuration = {
  totalMinutes: number;
  visibleMinutes: number;
};

const FALLBACK_CATEGORY: Omit<WeeklyStatsCategoryLike, 'id'> = {
  name: '카테고리 없음',
  emoji: '•',
  color: '#64748B',
};

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
