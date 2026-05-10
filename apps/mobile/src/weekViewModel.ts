import { getWeekStartDate, type DateString, type TimeEntry } from '@weekly/domain';

type WeekEntryDateLike = Pick<TimeEntry, 'date' | 'deletedAt'>;

export function createRecordedDateSet(
  entries: readonly WeekEntryDateLike[],
): ReadonlySet<DateString> {
  const dates = new Set<DateString>();

  for (const entry of entries) {
    if (!entry.deletedAt) {
      dates.add(entry.date);
    }
  }

  return dates;
}

export function isMondayWeekStartDate(value: string | null | undefined): value is DateString {
  if (!value) {
    return false;
  }

  try {
    return getWeekStartDate(value, 'monday') === value;
  } catch {
    return false;
  }
}

export function resolveInitialWeekStartDate({
  lastOpenedWeekStartDate,
  todayDate,
}: {
  lastOpenedWeekStartDate: string | null | undefined;
  todayDate: DateString;
}): DateString {
  if (isMondayWeekStartDate(lastOpenedWeekStartDate)) {
    return lastOpenedWeekStartDate;
  }

  return getWeekStartDate(todayDate, 'monday');
}
