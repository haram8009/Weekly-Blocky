import { describe, expect, it } from 'vitest';

import type { TimeEntryCsvInput } from './csvExport';
import { createTimeEntriesCsv, TIME_ENTRY_CSV_HEADERS, UTF8_BOM } from './csvExport';

const baseEntry: TimeEntryCsvInput = {
  date: '2026-05-08',
  startTime: '09:00',
  endTime: '10:00',
  categoryName: '업무',
  categoryColor: '#2563eb',
  categoryEmoji: '💻',
  note: '기획 정리',
  source: 'manual',
  photoCount: 0,
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T01:00:00.000Z',
};

function createEntry(overrides: Partial<TimeEntryCsvInput>): TimeEntryCsvInput {
  return {
    ...baseEntry,
    ...overrides,
  };
}

describe('createTimeEntriesCsv', () => {
  it('UTF-8 BOM과 정의된 필드 순서를 포함한다', () => {
    const csv = createTimeEntriesCsv([baseEntry]);

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv.slice(UTF8_BOM.length).split('\n')[0]).toBe(TIME_ENTRY_CSV_HEADERS.join(','));
  });

  it('날짜와 시작 시간 기준으로 정렬하고 durationMinutes를 계산한다', () => {
    const csv = createTimeEntriesCsv([
      createEntry({
        date: '2026-05-09',
        startTime: '08:00',
        endTime: '08:30',
      }),
      createEntry({
        date: '2026-05-08',
        startTime: '10:00',
        endTime: '10:40',
      }),
      createEntry({
        date: '2026-05-08',
        startTime: '09:00',
        endTime: '10:00',
      }),
    ]);

    expect(csv.slice(UTF8_BOM.length).split('\n').slice(1)).toEqual([
      '2026-05-08,09:00,10:00,60,업무,#2563eb,💻,기획 정리,manual,0,2026-05-08T00:00:00.000Z,2026-05-08T01:00:00.000Z',
      '2026-05-08,10:00,10:40,40,업무,#2563eb,💻,기획 정리,manual,0,2026-05-08T00:00:00.000Z,2026-05-08T01:00:00.000Z',
      '2026-05-09,08:00,08:30,30,업무,#2563eb,💻,기획 정리,manual,0,2026-05-08T00:00:00.000Z,2026-05-08T01:00:00.000Z',
    ]);
  });

  it('쉼표, 따옴표, 줄바꿈이 있는 필드를 CSV 표준에 맞게 escape한다', () => {
    const csv = createTimeEntriesCsv([
      createEntry({
        categoryName: '집중, 개발',
        note: '메모, "인용"\n다음 줄',
      }),
    ]);

    expect(csv).toContain('"집중, 개발"');
    expect(csv).toContain('"메모, ""인용""\n다음 줄"');
  });

  it('사진 정보는 photoCount만 포함하고 원본 경로, 로컬 URI, 썸네일 URL은 제외한다', () => {
    const entryWithPhotoFields = {
      ...baseEntry,
      photoCount: 2,
      originalPath: '/private/var/mobile/Media/DCIM/100APPLE/IMG_0001.JPG',
      localUri: 'ph://local-asset-id',
      thumbnailLocalUri: 'file:///local-thumbnail.jpg',
      thumbnailRemoteUrl: 'https://storage.example.com/thumb.jpg',
    } satisfies TimeEntryCsvInput & {
      originalPath: string;
      localUri: string;
      thumbnailLocalUri: string;
      thumbnailRemoteUrl: string;
    };

    const csv = createTimeEntriesCsv([entryWithPhotoFields]);

    expect(csv).toContain(',2,');
    expect(csv).not.toContain('/private/var/mobile');
    expect(csv).not.toContain('ph://local-asset-id');
    expect(csv).not.toContain('file:///local-thumbnail.jpg');
    expect(csv).not.toContain('https://storage.example.com/thumb.jpg');
  });
});
