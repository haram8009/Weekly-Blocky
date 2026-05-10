import { describe, expect, it } from 'vitest';

import {
  addDaysToDate,
  formatMinutesToTime,
  getDatesOfWeek,
  getWeekStartDate,
  isCapturedWithinEntry,
  isTenMinuteAligned,
  parseTimeToMinutes,
  validateTimeRange,
} from './time';

describe('time utilities', () => {
  describe('parseTimeToMinutes', () => {
    it('HH:mm 시간을 분으로 변환한다', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('09:30')).toBe(570);
      expect(parseTimeToMinutes('23:50')).toBe(1430);
      expect(parseTimeToMinutes('24:00')).toBe(1440);
    });

    it('잘못된 시간 형식과 값을 거부한다', () => {
      expect(() => parseTimeToMinutes('9:30')).toThrow();
      expect(() => parseTimeToMinutes('24:10')).toThrow();
      expect(() => parseTimeToMinutes('25:00')).toThrow();
      expect(() => parseTimeToMinutes('12:60')).toThrow();
    });
  });

  describe('formatMinutesToTime', () => {
    it('분 값을 HH:mm 문자열로 변환한다', () => {
      expect(formatMinutesToTime(0)).toBe('00:00');
      expect(formatMinutesToTime(570)).toBe('09:30');
      expect(formatMinutesToTime(1440)).toBe('24:00');
    });

    it('0 이상 1440 이하의 정수만 허용한다', () => {
      expect(() => formatMinutesToTime(-1)).toThrow();
      expect(() => formatMinutesToTime(1441)).toThrow();
      expect(() => formatMinutesToTime(10.5)).toThrow();
    });
  });

  describe('isTenMinuteAligned', () => {
    it('10분 단위 시간인지 확인한다', () => {
      expect(isTenMinuteAligned('09:00')).toBe(true);
      expect(isTenMinuteAligned('09:10')).toBe(true);
      expect(isTenMinuteAligned('09:20')).toBe(true);
      expect(isTenMinuteAligned('09:30')).toBe(true);
      expect(isTenMinuteAligned('09:40')).toBe(true);
      expect(isTenMinuteAligned('09:50')).toBe(true);
      expect(isTenMinuteAligned('24:00')).toBe(true);
      expect(isTenMinuteAligned('09:05')).toBe(false);
      expect(isTenMinuteAligned('bad')).toBe(false);
    });
  });

  describe('validateTimeRange', () => {
    it('10분 단위의 시작/종료 범위를 검증한다', () => {
      expect(validateTimeRange('09:00', '10:30')).toEqual({
        isValid: true,
        startMinutes: 540,
        endMinutes: 630,
      });
    });

    it('24:00은 종료 시간으로만 허용한다', () => {
      expect(validateTimeRange('23:00', '24:00')).toEqual({
        isValid: true,
        startMinutes: 1380,
        endMinutes: 1440,
      });
      expect(validateTimeRange('24:00', '24:00')).toEqual({
        isValid: false,
        errors: ['START_CANNOT_BE_24_00', 'START_MUST_BE_BEFORE_END'],
      });
    });

    it('시작은 종료보다 빨라야 하고 10분 단위여야 한다', () => {
      expect(validateTimeRange('10:00', '09:50')).toEqual({
        isValid: false,
        errors: ['START_MUST_BE_BEFORE_END'],
      });
      expect(validateTimeRange('09:05', '10:05')).toEqual({
        isValid: false,
        errors: ['START_NOT_ALIGNED', 'END_NOT_ALIGNED'],
      });
    });
  });

  describe('week date helpers', () => {
    it('월요일 시작 주의 시작일과 7일 날짜를 계산한다', () => {
      expect(getWeekStartDate('2026-05-07', 'monday')).toBe('2026-05-04');
      expect(getDatesOfWeek('2026-05-04')).toEqual([
        '2026-05-04',
        '2026-05-05',
        '2026-05-06',
        '2026-05-07',
        '2026-05-08',
        '2026-05-09',
        '2026-05-10',
      ]);
    });

    it('일요일 시작 주의 시작일을 계산한다', () => {
      expect(getWeekStartDate('2026-05-07', 'sunday')).toBe('2026-05-03');
      expect(getWeekStartDate('2026-05-10', 'monday')).toBe('2026-05-04');
      expect(getWeekStartDate('2026-05-10', 'sunday')).toBe('2026-05-10');
    });

    it('날짜에 일수를 더해 이전 주와 다음 주 이동 날짜를 계산한다', () => {
      expect(addDaysToDate('2026-05-04', -7)).toBe('2026-04-27');
      expect(addDaysToDate('2026-05-04', 7)).toBe('2026-05-11');
      expect(addDaysToDate('2026-12-29', 7)).toBe('2027-01-05');
    });

    it('더할 일수는 정수만 허용한다', () => {
      expect(() => addDaysToDate('2026-05-04', 1.5)).toThrow();
    });
  });

  describe('isCapturedWithinEntry', () => {
    const entry = {
      date: '2026-05-07',
      startTime: '09:00',
      endTime: '10:00',
    };

    it('사진 촬영 시각이 기록 시작 이상 종료 미만인지 확인한다', () => {
      expect(isCapturedWithinEntry('2026-05-07T09:00:00', entry)).toBe(true);
      expect(isCapturedWithinEntry('2026-05-07T09:30:00', entry)).toBe(true);
      expect(isCapturedWithinEntry('2026-05-07T10:00:00', entry)).toBe(false);
      expect(isCapturedWithinEntry('2026-05-07T08:59:00', entry)).toBe(false);
    });

    it('날짜가 다르거나 기록 범위가 잘못되면 매칭하지 않는다', () => {
      expect(isCapturedWithinEntry('2026-05-08T09:30:00', entry)).toBe(false);
      expect(
        isCapturedWithinEntry('2026-05-07T09:30:00', {
          ...entry,
          startTime: '10:00',
          endTime: '09:00',
        }),
      ).toBe(false);
    });
  });
});
