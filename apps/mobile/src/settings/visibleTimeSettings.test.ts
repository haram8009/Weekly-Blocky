import { describe, expect, it } from 'vitest';

import { validateVisibleTimeSettingsDraft } from './visibleTimeSettings';

describe('validateVisibleTimeSettingsDraft', () => {
  it('accepts a 10 minute aligned visible time range', () => {
    expect(validateVisibleTimeSettingsDraft('06:00', '23:00')).toEqual({
      isValid: true,
      input: {
        visibleStartTime: '06:00',
        visibleEndTime: '23:00',
      },
    });
  });

  it('accepts the full 00:00-24:00 range', () => {
    expect(validateVisibleTimeSettingsDraft('00:00', '24:00')).toEqual({
      isValid: true,
      input: {
        visibleStartTime: '00:00',
        visibleEndTime: '24:00',
      },
    });
  });

  it('accepts visible ranges through the next day 05:00', () => {
    expect(validateVisibleTimeSettingsDraft('05:00', '29:00')).toEqual({
      isValid: true,
      input: {
        visibleStartTime: '05:00',
        visibleEndTime: '29:00',
      },
    });
    expect(validateVisibleTimeSettingsDraft('05:00', '29:10')).toMatchObject({
      isValid: false,
    });
  });

  it('rejects non-aligned or reversed visible time ranges', () => {
    expect(validateVisibleTimeSettingsDraft('09:05', '23:00')).toMatchObject({
      isValid: false,
    });
    expect(validateVisibleTimeSettingsDraft('10:00', '09:00')).toMatchObject({
      isValid: false,
    });
  });
});
