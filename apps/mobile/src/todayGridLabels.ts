import type { DateString } from '@weekly/domain';

export function formatTodayGridHourLabel(time: string): string {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);

  if (!Number.isInteger(hour) || !minuteText) {
    return time;
  }

  return `${String(hour % 24).padStart(2, '0')}:${minuteText}`;
}

export function formatTodayGridDateDividerLabel(date: DateString): string {
  const [, monthText, dayText] = date.split('-');

  return `${Number(monthText)}월 ${Number(dayText)}일`;
}
