import {
  addDaysToDate,
  getDatesOfWeek,
  getWeekStartDate,
  formatDiaryTimeLabel,
  parseDiaryTimeToMinutes,
  type Category,
  type DateString,
  type TimeEntry,
} from '@weekly/domain';

export type DailyEntryListItem = {
  id: string;
  timeRangeLabel: string;
  categoryName: string;
  categoryEmoji: string;
  categoryColor: string;
  durationMinutes: number;
  note: string;
};

export type DailySummary = {
  entryCount: number;
  recordedMinutes: number;
  unrecordedMinutes: number;
  completionRate: number;
  topCategoryLabel: string | null;
  totalsByColor: DailySummaryTotal[];
  totalsByName: DailySummaryTotal[];
  totalsByEmoji: DailySummaryTotal[];
};

export type DailySummaryTotal = {
  key: string;
  label: string;
  color: string;
  minutes: number;
  ratio: number;
};

export type CalendarDateItem = {
  date: DateString;
  dayNumber: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
};

export type CalendarMonth = {
  monthLabel: string;
  weeks: CalendarDateItem[][];
};

export type WeekDateItem = {
  date: DateString;
  weekdayLabel: string;
  dayNumber: string;
  isSelected: boolean;
  isToday: boolean;
};

type CategoryLike = Pick<Category, 'id' | 'name' | 'emoji' | 'color'>;
type CategoryPaletteCategoryLike = Pick<
  Category,
  'id' | 'name' | 'emoji' | 'color' | 'sortOrder' | 'isArchived' | 'deletedAt'
>;
type TimeEntryLike = Pick<
  TimeEntry,
  'id' | 'startTime' | 'endTime' | 'categoryId' | 'note' | 'deletedAt'
>;
type CategoryPaletteEntryLike = Pick<
  TimeEntry,
  'categoryId' | 'startTime' | 'endTime' | 'deletedAt'
> &
  Partial<Pick<TimeEntry, 'updatedAt'>>;

const FALLBACK_CATEGORY = {
  name: '카테고리 없음',
  emoji: '•',
  color: '#64748B',
};
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const CALENDAR_WEEK_COUNT = 6;
const DAYS_PER_WEEK = 7;

export function isValidDateString(value: string | null | undefined): value is DateString {
  if (!value) {
    return false;
  }

  try {
    getWeekStartDate(value, 'monday');
    return true;
  } catch {
    return false;
  }
}

export function resolveSelectedDate(
  value: string | readonly string[] | null | undefined,
  fallbackDate: DateString,
): DateString {
  const candidate = Array.isArray(value) ? value[0] : value;

  return isValidDateString(candidate) ? candidate : fallbackDate;
}

export function createCalendarMonth({
  visibleMonthDate,
  selectedDate,
  todayDate,
}: {
  visibleMonthDate: DateString;
  selectedDate: DateString;
  todayDate: DateString;
}): CalendarMonth {
  const monthStartDate = getMonthStartDate(visibleMonthDate);
  const calendarStartDate = getWeekStartDate(monthStartDate, 'monday');
  const visibleMonthKey = monthStartDate.slice(0, 7);
  const weeks: CalendarDateItem[][] = [];

  for (let weekIndex = 0; weekIndex < CALENDAR_WEEK_COUNT; weekIndex += 1) {
    const weekItems: CalendarDateItem[] = [];

    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
      const date = addDaysToDate(calendarStartDate, weekIndex * DAYS_PER_WEEK + dayIndex);

      weekItems.push({
        date,
        dayNumber: formatDayNumber(date),
        isCurrentMonth: date.startsWith(visibleMonthKey),
        isSelected: date === selectedDate,
        isToday: date === todayDate,
      });
    }

    weeks.push(weekItems);
  }

  return {
    monthLabel: formatYearMonth(monthStartDate),
    weeks,
  };
}

export function createWeekDateItems({
  selectedDate,
  todayDate,
}: {
  selectedDate: DateString;
  todayDate: DateString;
}): WeekDateItem[] {
  return getDatesOfWeek(getWeekStartDate(selectedDate, 'monday')).map((date, index) => ({
    date,
    weekdayLabel: WEEKDAY_LABELS[index] ?? '',
    dayNumber: formatDayNumber(date),
    isSelected: date === selectedDate,
    isToday: date === todayDate,
  }));
}

export function createWeekCalendarRows({
  selectedDate,
  todayDate,
}: {
  selectedDate: DateString;
  todayDate: DateString;
}): CalendarDateItem[][] {
  return [
    createWeekDateItems({ selectedDate, todayDate }).map((item) => ({
      date: item.date,
      dayNumber: item.dayNumber,
      isCurrentMonth: true,
      isSelected: item.isSelected,
      isToday: item.isToday,
    })),
  ];
}

export function createDailyEntryListItems(
  entries: readonly TimeEntryLike[],
  categories: readonly CategoryLike[],
): DailyEntryListItem[] {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return entries
    .filter((entry) => !entry.deletedAt)
    .map((entry) => {
      const category = categoryMap.get(entry.categoryId) ?? FALLBACK_CATEGORY;

      return {
        id: entry.id,
        timeRangeLabel: `${formatDiaryTimeLabel(entry.startTime)}-${formatDiaryTimeLabel(entry.endTime)}`,
        categoryName: category.name,
        categoryEmoji: category.emoji,
        categoryColor: category.color,
        durationMinutes: getEntryDurationMinutes(entry),
        note: entry.note,
      };
    })
    .sort((first, second) => first.timeRangeLabel.localeCompare(second.timeRangeLabel));
}

export function createDailySummary(
  entries: readonly TimeEntryLike[],
  categories: readonly CategoryLike[],
  visibleMinutes: number,
): DailySummary {
  const items = createDailyEntryListItems(entries, categories);
  const totalsByColor = new Map<string, Omit<DailySummaryTotal, 'ratio'>>();
  const totalsByName = new Map<string, Omit<DailySummaryTotal, 'ratio'>>();
  const totalsByEmoji = new Map<string, Omit<DailySummaryTotal, 'ratio'>>();
  const recordedMinutes = items.reduce((totalMinutes, item) => {
    addDailySummaryTotal(totalsByColor, {
      key: item.categoryColor,
      label: item.categoryColor,
      color: item.categoryColor,
      minutes: item.durationMinutes,
    });
    addDailySummaryTotal(totalsByName, {
      key: item.categoryName,
      label: item.categoryName,
      color: item.categoryColor,
      minutes: item.durationMinutes,
    });
    addDailySummaryTotal(totalsByEmoji, {
      key: item.categoryEmoji,
      label: `${item.categoryEmoji} ${item.categoryName}`,
      color: item.categoryColor,
      minutes: item.durationMinutes,
    });

    return totalMinutes + item.durationMinutes;
  }, 0);
  const totalsByNameList = sortDailySummaryTotals(totalsByName, recordedMinutes);
  const topCategory = totalsByNameList[0];

  return {
    entryCount: items.length,
    recordedMinutes,
    unrecordedMinutes: Math.max(visibleMinutes - recordedMinutes, 0),
    completionRate: visibleMinutes > 0 ? Math.round((recordedMinutes / visibleMinutes) * 100) : 0,
    topCategoryLabel: topCategory ? topCategory.label : null,
    totalsByColor: sortDailySummaryTotals(totalsByColor, recordedMinutes),
    totalsByName: totalsByNameList,
    totalsByEmoji: sortDailySummaryTotals(totalsByEmoji, recordedMinutes),
  };
}

function addDailySummaryTotal(
  totals: Map<string, Omit<DailySummaryTotal, 'ratio'>>,
  nextTotal: Omit<DailySummaryTotal, 'ratio'>,
) {
  const currentTotal = totals.get(nextTotal.key);

  totals.set(nextTotal.key, {
    ...nextTotal,
    minutes: (currentTotal?.minutes ?? 0) + nextTotal.minutes,
  });
}

function sortDailySummaryTotals(
  totals: Map<string, Omit<DailySummaryTotal, 'ratio'>>,
  recordedMinutes: number,
): DailySummaryTotal[] {
  return [...totals.values()]
    .map((total) => ({
      ...total,
      ratio: recordedMinutes > 0 ? Math.round((total.minutes / recordedMinutes) * 100) : 0,
    }))
    .sort(
      (first, second) => second.minutes - first.minutes || first.label.localeCompare(second.label),
    );
}

export function createCategoryPaletteItems(
  categories: readonly CategoryPaletteCategoryLike[],
  entries: readonly CategoryPaletteEntryLike[],
): CategoryPaletteCategoryLike[] {
  const latestUsageByCategoryId = new Map<string, string>();

  for (const entry of entries) {
    if (entry.deletedAt) {
      continue;
    }

    const usageScore = entry.updatedAt ?? `${entry.endTime}-${entry.startTime}`;
    const previousUsageScore = latestUsageByCategoryId.get(entry.categoryId);

    if (!previousUsageScore || usageScore > previousUsageScore) {
      latestUsageByCategoryId.set(entry.categoryId, usageScore);
    }
  }

  return categories
    .filter((category) => !category.deletedAt && !category.isArchived)
    .sort((first, second) => {
      const firstUsageScore = latestUsageByCategoryId.get(first.id);
      const secondUsageScore = latestUsageByCategoryId.get(second.id);

      if (firstUsageScore && secondUsageScore && firstUsageScore !== secondUsageScore) {
        return secondUsageScore.localeCompare(firstUsageScore);
      }

      if (firstUsageScore && !secondUsageScore) {
        return -1;
      }

      if (!firstUsageScore && secondUsageScore) {
        return 1;
      }

      return first.sortOrder - second.sortOrder || first.name.localeCompare(second.name);
    });
}

export function formatDuration(minutes: number): string {
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

function getMonthStartDate(date: DateString): DateString {
  return `${date.slice(0, 7)}-01`;
}

function formatYearMonth(date: DateString): string {
  const [yearText, monthText] = date.split('-');

  return `${yearText}년 ${Number(monthText)}월`;
}

function formatDayNumber(date: DateString): string {
  const [, , dayText] = date.split('-');

  return String(Number(dayText));
}

function getEntryDurationMinutes(entry: Pick<TimeEntry, 'startTime' | 'endTime'>): number {
  try {
    return Math.max(
      parseDiaryTimeToMinutes(entry.endTime) - parseDiaryTimeToMinutes(entry.startTime),
      0,
    );
  } catch {
    return 0;
  }
}
