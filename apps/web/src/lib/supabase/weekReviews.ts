import {
  getWeekReviewByWeekStartDate,
  upsertWeekReview,
  type UpsertWeekReviewInput,
} from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

export function getWebWeekReviewByWeekStartDate(weekStartDate: DateString) {
  return getWeekReviewByWeekStartDate(getSupabaseClient(), weekStartDate);
}

export function upsertWebWeekReview(input: UpsertWeekReviewInput) {
  return upsertWeekReview(getSupabaseClient(), input);
}

export type { UpsertWeekReviewInput } from '@weekly/data';
