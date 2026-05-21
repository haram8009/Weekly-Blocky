import {
  getWeekReviewByWeekStartDate,
  upsertAndReloadWeekReview,
  type UpsertWeekReviewInput,
} from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

export function getMobileWeekReviewByWeekStartDate(weekStartDate: DateString) {
  return getWeekReviewByWeekStartDate(getSupabaseClient(), weekStartDate);
}

export function upsertMobileWeekReview(input: UpsertWeekReviewInput) {
  return upsertAndReloadWeekReview(getSupabaseClient(), input);
}

export type { UpsertWeekReviewInput } from '@weekly/data';
