import type { DateString } from '@weekly/domain';
import * as SecureStore from 'expo-secure-store';

import { isMondayWeekStartDate } from './weekViewModel';

const LAST_OPENED_WEEK_START_DATE_KEY = 'weekly:lastOpenedWeekStartDate';

export async function loadLastOpenedWeekStartDate(): Promise<DateString | null> {
  try {
    const savedWeekStartDate = await SecureStore.getItemAsync(LAST_OPENED_WEEK_START_DATE_KEY);

    return isMondayWeekStartDate(savedWeekStartDate) ? savedWeekStartDate : null;
  } catch {
    return null;
  }
}

export function saveLastOpenedWeekStartDate(weekStartDate: DateString): Promise<void> {
  return SecureStore.setItemAsync(LAST_OPENED_WEEK_START_DATE_KEY, weekStartDate);
}
