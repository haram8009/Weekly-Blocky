import { listTimeEntriesByDate, listTimeEntriesByWeek } from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

export function listWebTimeEntriesByDate(date: DateString) {
  return listTimeEntriesByDate(getSupabaseClient(), date);
}

export function listWebTimeEntriesByWeek(weekStartDate: DateString) {
  return listTimeEntriesByWeek(getSupabaseClient(), weekStartDate);
}
