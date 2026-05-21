import type { WeekReview } from '@weekly/domain';
import { describe, expect, it } from 'vitest';

import { SupabaseStorageError } from './errors';
import { upsertAndReloadWeekReviewWithRepository } from './services';
import type { UpsertWeekReviewInput } from './types';

const input: UpsertWeekReviewInput = {
  weekStartDate: '2026-05-18',
  summary: '이번 주 요약',
  wins: '잘한 점',
  problems: '아쉬운 점',
  nextWeekFocus: '다음 주 집중',
  now: '2026-05-21T09:00:00.000Z',
};

const reloadedReview: WeekReview = {
  id: 'weekReview:user-1:2026-05-18',
  userId: 'user-1',
  weekStartDate: '2026-05-18',
  summary: input.summary ?? '',
  wins: input.wins ?? '',
  problems: input.problems ?? '',
  nextWeekFocus: input.nextWeekFocus ?? '',
  createdAt: '2026-05-21T08:00:00.000Z',
  updatedAt: '2026-05-21T09:00:01.000Z',
  deletedAt: null,
};

describe('upsertAndReloadWeekReviewWithRepository', () => {
  it('returns the server row fetched after saving', async () => {
    const calls: string[] = [];

    const result = await upsertAndReloadWeekReviewWithRepository(
      {
        async upsertWeekReview() {
          calls.push('upsert');
          return { ...reloadedReview, updatedAt: input.now ?? reloadedReview.updatedAt };
        },
        async getWeekReviewByWeekStartDate(weekStartDate) {
          calls.push(`get:${weekStartDate}`);
          return reloadedReview;
        },
      },
      input,
    );

    expect(calls).toEqual(['upsert', 'get:2026-05-18']);
    expect(result).toBe(reloadedReview);
  });

  it('raises a retryable storage error when the saved review cannot be reloaded', async () => {
    await expect(
      upsertAndReloadWeekReviewWithRepository(
        {
          async upsertWeekReview() {
            return reloadedReview;
          },
          async getWeekReviewByWeekStartDate() {
            return null;
          },
        },
        input,
      ),
    ).rejects.toBeInstanceOf(SupabaseStorageError);
  });
});
