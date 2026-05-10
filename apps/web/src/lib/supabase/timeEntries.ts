import {
  createSupabaseQueryError,
  listTimeEntriesByDate,
  listTimeEntriesByWeek,
  mapTimeEntryRow,
  requireCurrentUserId,
  type SupabaseTimeEntryRow,
} from '@weekly/data';
import type { DateString, TimeEntry } from '@weekly/domain';

import { getSupabaseClient } from './client';

const READ_ERROR_MESSAGE = '서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function listWebTimeEntriesByDate(date: DateString) {
  return listTimeEntriesByDate(getSupabaseClient(), date);
}

export function listWebTimeEntriesByWeek(weekStartDate: DateString) {
  return listTimeEntriesByWeek(getSupabaseClient(), weekStartDate);
}

export async function listWebTimeEntries(): Promise<TimeEntry[]> {
  const client = getSupabaseClient();
  const userId = await requireCurrentUserId(client);
  const { data, error } = await client
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
  }

  return ((data ?? []) as SupabaseTimeEntryRow[]).map(mapTimeEntryRow);
}
