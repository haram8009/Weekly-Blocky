import {
  getWeekReviewByWeekStartDate,
  upsertWeekReview,
  type UpsertWeekReviewInput,
} from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

export function getMobileWeekReviewByWeekStartDate(weekStartDate: DateString) {
  return getWeekReviewByWeekStartDate(getSupabaseClient(), weekStartDate);
}

export function upsertMobileWeekReview(input: UpsertWeekReviewInput) {
  return upsertWeekReview(getSupabaseClient(), input);
}

export type { UpsertWeekReviewInput } from '@weekly/data';
