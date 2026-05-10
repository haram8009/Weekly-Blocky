import {
  getWeekStartDate,
  parseTimeToMinutes,
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
};

type CategoryLike = Pick<Category, 'id' | 'name' | 'emoji' | 'color'>;
type TimeEntryLike = Pick<
  TimeEntry,
  'id' | 'startTime' | 'endTime' | 'categoryId' | 'note' | 'deletedAt'
>;

const FALLBACK_CATEGORY = {
  name: '카테고리 없음',
  emoji: '•',
  color: '#64748B',
};

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
        timeRangeLabel: `${entry.startTime}-${entry.endTime}`,
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
  const categoryMinutes = new Map<string, number>();
  const recordedMinutes = items.reduce((totalMinutes, item) => {
    categoryMinutes.set(
      item.categoryName,
      (categoryMinutes.get(item.categoryName) ?? 0) + item.durationMinutes,
    );

    return totalMinutes + item.durationMinutes;
  }, 0);
  const topCategory = [...categoryMinutes.entries()].sort(
    (first, second) => second[1] - first[1],
  )[0];

  return {
    entryCount: items.length,
    recordedMinutes,
    unrecordedMinutes: Math.max(visibleMinutes - recordedMinutes, 0),
    completionRate: visibleMinutes > 0 ? Math.round((recordedMinutes / visibleMinutes) * 100) : 0,
    topCategoryLabel: topCategory ? topCategory[0] : null,
  };
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

function getEntryDurationMinutes(entry: Pick<TimeEntry, 'startTime' | 'endTime'>): number {
  try {
    return Math.max(parseTimeToMinutes(entry.endTime) - parseTimeToMinutes(entry.startTime), 0);
  } catch {
    return 0;
  }
}
