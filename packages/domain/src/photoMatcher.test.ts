import { describe, expect, it } from 'vitest';

import {
  resolvePhotoMatches,
  type PhotoMatcherEntry,
  type PhotoMatcherPhoto,
} from './photoMatcher';

const baseEntry: PhotoMatcherEntry = {
  id: 'entry-1',
  date: '2026-05-11',
  startTime: '09:00',
  endTime: '10:00',
  deletedAt: null,
};

function createPhoto(overrides: Partial<PhotoMatcherPhoto>): PhotoMatcherPhoto {
  return {
    id: 'photo-1',
    date: '2026-05-11',
    capturedAt: '2026-05-11T09:00:00',
    entryId: null,
    matchType: 'auto',
    isHidden: false,
    deletedAt: null,
    ...overrides,
  };
}

describe('resolvePhotoMatches', () => {
  it('matches photos captured at the entry start and before the entry end', () => {
    const result = resolvePhotoMatches(
      [baseEntry],
      [
        createPhoto({ id: 'start', capturedAt: '2026-05-11T09:00:00' }),
        createPhoto({ id: 'middle', capturedAt: '2026-05-11T09:30:00' }),
        createPhoto({ id: 'end', capturedAt: '2026-05-11T10:00:00' }),
      ],
    );

    expect(result.matches).toEqual([{ entryId: 'entry-1', photoIds: ['start', 'middle'] }]);
    expect(result.updates).toEqual([
      { photoId: 'start', entryId: 'entry-1', matchType: 'auto' },
      { photoId: 'middle', entryId: 'entry-1', matchType: 'auto' },
      { photoId: 'end', entryId: null, matchType: 'auto' },
    ]);
  });

  it('matches only photos from the same date', () => {
    const result = resolvePhotoMatches(
      [baseEntry],
      [
        createPhoto({
          id: 'other-date',
          date: '2026-05-12',
          capturedAt: '2026-05-12T09:30:00',
        }),
      ],
    );

    expect(result.matches).toEqual([]);
    expect(result.updates).toEqual([{ photoId: 'other-date', entryId: null, matchType: 'auto' }]);
  });

  it('re-matches automatic photos against changed entry ranges', () => {
    const result = resolvePhotoMatches(
      [
        {
          ...baseEntry,
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
      [createPhoto({ entryId: 'entry-1', capturedAt: '2026-05-11T09:30:00' })],
    );

    expect(result.matches).toEqual([]);
    expect(result.updates).toEqual([{ photoId: 'photo-1', entryId: null, matchType: 'auto' }]);
  });

  it('unlinks photos whose connected entry was deleted', () => {
    const result = resolvePhotoMatches(
      [{ ...baseEntry, deletedAt: '2026-05-11T10:00:00.000Z' }],
      [createPhoto({ entryId: 'entry-1', matchType: 'manual' })],
    );

    expect(result.matches).toEqual([]);
    expect(result.updates).toEqual([{ photoId: 'photo-1', entryId: null, matchType: 'manual' }]);
  });

  it('excludes hidden and deleted photos from match results', () => {
    const result = resolvePhotoMatches(
      [baseEntry],
      [
        createPhoto({ id: 'hidden', isHidden: true }),
        createPhoto({ id: 'deleted', deletedAt: '2026-05-11T10:00:00.000Z' }),
      ],
    );

    expect(result.matches).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  it('preserves manual links to active entries', () => {
    const result = resolvePhotoMatches(
      [baseEntry],
      [
        createPhoto({
          id: 'manual-photo',
          entryId: 'entry-1',
          matchType: 'manual',
          capturedAt: '2026-05-11T12:00:00',
        }),
      ],
    );

    expect(result.matches).toEqual([{ entryId: 'entry-1', photoIds: ['manual-photo'] }]);
    expect(result.updates).toEqual([
      { photoId: 'manual-photo', entryId: 'entry-1', matchType: 'manual' },
    ]);
  });
});
