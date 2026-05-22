import { describe, expect, it } from 'vitest';

import { createDisplayTimeEntry } from './displayTimeEntry';

describe('createDisplayTimeEntry', () => {
  it('moves early-morning entries to the previous display date when visible range crosses midnight', () => {
    expect(
      createDisplayTimeEntry({
        entry: {
          date: '2026-05-19',
          startTime: '00:00',
          endTime: '02:00',
        },
        visibleStartTime: '07:00',
        visibleEndTime: '29:00',
      }),
    ).toEqual({
      displayDate: '2026-05-18',
      displayStartTime: '24:00',
      displayEndTime: '26:00',
    });
  });

  it('keeps early-morning entries on their actual date in full-day display range', () => {
    expect(
      createDisplayTimeEntry({
        entry: {
          date: '2026-05-19',
          startTime: '00:00',
          endTime: '02:00',
        },
        visibleStartTime: '00:00',
        visibleEndTime: '24:00',
      }),
    ).toEqual({
      displayDate: '2026-05-19',
      displayStartTime: '00:00',
      displayEndTime: '02:00',
    });
  });

  it('keeps entries after the visible start time on their actual date', () => {
    expect(
      createDisplayTimeEntry({
        entry: {
          date: '2026-05-19',
          startTime: '07:00',
          endTime: '09:00',
        },
        visibleStartTime: '07:00',
        visibleEndTime: '29:00',
      }),
    ).toEqual({
      displayDate: '2026-05-19',
      displayStartTime: '07:00',
      displayEndTime: '09:00',
    });
  });
});
