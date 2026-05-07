import {
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntriesByDate,
  listTimeEntriesByWeek,
  updateTimeEntry,
  type CreateTimeEntryInput,
  type DeleteTimeEntryInput,
  type UpdateTimeEntryInput,
} from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

export function createMobileTimeEntry(input: CreateTimeEntryInput) {
  return createTimeEntry(getSupabaseClient(), input);
}

export function updateMobileTimeEntry(input: UpdateTimeEntryInput) {
  return updateTimeEntry(getSupabaseClient(), input);
}

export function deleteMobileTimeEntry(input: DeleteTimeEntryInput) {
  return deleteTimeEntry(getSupabaseClient(), input);
}

export function listMobileTimeEntriesByDate(date: DateString) {
  return listTimeEntriesByDate(getSupabaseClient(), date);
}

export function listMobileTimeEntriesByWeek(weekStartDate: DateString) {
  return listTimeEntriesByWeek(getSupabaseClient(), weekStartDate);
}

export type { CreateTimeEntryInput, DeleteTimeEntryInput, UpdateTimeEntryInput } from '@weekly/data';
