import { describe, expect, it } from 'vitest';

import type { TimeEntry } from './index';
import { resolveEntryOverlaps } from './entryOverlap';

const baseEntry: TimeEntry = {
  id: 'timeEntry:1',
  userId: 'user:1',
  date: '2026-05-08',
  startTime: '09:00',
  endTime: '10:00',
  categoryId: 'category:study',
  note: '',
  source: 'manual',
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
  deletedAt: null,
};

function createEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    ...baseEntry,
    ...overrides,
  };
}

describe('resolveEntryOverlaps', () => {
  it('새 기록이 기존 기록 뒷부분과 겹치면 기존 기록의 종료 시간을 자른다', () => {
    const resolution = resolveEntryOverlaps([baseEntry], {
      date: '2026-05-08',
      startTime: '09:30',
      endTime: '10:30',
    });

    expect(resolution.updates).toEqual([
      {
        entry: baseEntry,
        patch: {
          startTime: '09:00',
          endTime: '09:30',
        },
      },
    ]);
    expect(resolution.deletes).toEqual([]);
    expect(resolution.splits).toEqual([]);
  });

  it('새 기록이 기존 기록 앞부분과 겹치면 기존 기록의 시작 시간을 자른다', () => {
    const resolution = resolveEntryOverlaps([baseEntry], {
      date: '2026-05-08',
      startTime: '08:30',
      endTime: '09:30',
    });

    expect(resolution.updates).toEqual([
      {
        entry: baseEntry,
        patch: {
          startTime: '09:30',
          endTime: '10:00',
        },
      },
    ]);
    expect(resolution.deletes).toEqual([]);
    expect(resolution.splits).toEqual([]);
  });

  it('기존 기록이 새 기록에 완전히 포함되면 삭제 대상으로 분류한다', () => {
    const resolution = resolveEntryOverlaps([baseEntry], {
      date: '2026-05-08',
      startTime: '08:30',
      endTime: '10:30',
    });

    expect(resolution.deletes).toEqual([baseEntry]);
    expect(resolution.updates).toEqual([]);
    expect(resolution.splits).toEqual([]);
  });

  it('새 기록이 기존 기록 중간을 관통하면 기존 기록을 앞뒤로 분할한다', () => {
    const existingEntry = createEntry({
      startTime: '09:00',
      endTime: '11:00',
    });

    const resolution = resolveEntryOverlaps([existingEntry], {
      date: '2026-05-08',
      startTime: '09:30',
      endTime: '10:30',
    });

    expect(resolution.splits).toEqual([
      {
        entry: existingEntry,
        before: {
          startTime: '09:00',
          endTime: '09:30',
        },
        after: {
          startTime: '10:30',
          endTime: '11:00',
        },
      },
    ]);
    expect(resolution.updates).toEqual([]);
    expect(resolution.deletes).toEqual([]);
  });

  it('같은 날짜 기록만 겹침 대상으로 삼고 삭제된 기록은 제외한다', () => {
    const otherDateEntry = createEntry({
      id: 'timeEntry:other-date',
      date: '2026-05-09',
    });
    const deletedEntry = createEntry({
      id: 'timeEntry:deleted',
      deletedAt: '2026-05-08T01:00:00.000Z',
    });

    const resolution = resolveEntryOverlaps([otherDateEntry, deletedEntry], {
      date: '2026-05-08',
      startTime: '09:30',
      endTime: '10:30',
    });

    expect(resolution.untouched).toEqual([otherDateEntry, deletedEntry]);
    expect(resolution.updates).toEqual([]);
    expect(resolution.deletes).toEqual([]);
    expect(resolution.splits).toEqual([]);
  });

  it('동일한 범위로 겹치면 0분 기록을 남기지 않고 삭제 대상으로 분류한다', () => {
    const resolution = resolveEntryOverlaps([baseEntry], {
      date: '2026-05-08',
      startTime: '09:00',
      endTime: '10:00',
    });

    expect(resolution.deletes).toEqual([baseEntry]);
    expect(resolution.updates).toEqual([]);
    expect(resolution.splits).toEqual([]);
  });

  it('새 기록이나 기존 활성 기록이 10분 단위가 아니면 오류를 던진다', () => {
    expect(() =>
      resolveEntryOverlaps([baseEntry], {
        date: '2026-05-08',
        startTime: '09:05',
        endTime: '10:00',
      }),
    ).toThrow('기록 시간 범위가 올바르지 않습니다');

    expect(() =>
      resolveEntryOverlaps(
        [
          createEntry({
            startTime: '09:05',
          }),
        ],
        {
          date: '2026-05-08',
          startTime: '09:30',
          endTime: '10:30',
        },
      ),
    ).toThrow('기록 시간 범위가 올바르지 않습니다');
  });

  it('다음날 새벽까지 이어지는 일지 시간 기록의 겹침을 처리한다', () => {
    const existingEntry = createEntry({
      startTime: '23:30',
      endTime: '24:30',
    });

    const resolution = resolveEntryOverlaps([existingEntry], {
      date: '2026-05-08',
      startTime: '24:00',
      endTime: '25:00',
    });

    expect(resolution.updates).toEqual([
      {
        entry: existingEntry,
        patch: {
          startTime: '23:30',
          endTime: '24:00',
        },
      },
    ]);
  });
});
