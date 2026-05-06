import { describe, expect, it } from 'vitest';

import {
  DEFAULT_APP_SETTINGS,
  EXAMPLE_CATEGORY_DEFINITIONS,
  createDefaultAppSettings,
  getDefaultSettingsId,
} from './defaults';

describe('default product data', () => {
  it('문서에 정의된 기본 AppSettings 값을 제공한다', () => {
    expect(DEFAULT_APP_SETTINGS).toEqual({
      weekStartsOn: 'monday',
      visibleStartTime: '05:00',
      visibleEndTime: '24:00',
      useFullDayView: false,
      photoMatchingEnabled: false,
      thumbnailSyncEnabled: false,
      lastOpenedWeekStartDate: null,
    });
  });

  it('기능명세의 예시 카테고리 10개를 순서대로 제공한다', () => {
    expect(EXAMPLE_CATEGORY_DEFINITIONS.map((category) => category.name)).toEqual([
      '수면',
      '이동/식사',
      '공부/주요 업무',
      '자기개발',
      '영적시간',
      '운동/건강',
      '가족/관계',
      '집안일/심부름',
      '휴식',
      '낭비한 시간',
    ]);
  });

  it('예시 카테고리는 사용자 소유 엔티티 필드를 포함하지 않는다', () => {
    expect(EXAMPLE_CATEGORY_DEFINITIONS[0]).toMatchObject({
      key: 'sleep',
      name: '수면',
      color: '#6D5BD0',
      weeklyGoalMinutes: null,
      sortOrder: 10,
    });
    expect(EXAMPLE_CATEGORY_DEFINITIONS[0]).not.toHaveProperty('id');
    expect(EXAMPLE_CATEGORY_DEFINITIONS[0]).not.toHaveProperty('userId');
    expect(EXAMPLE_CATEGORY_DEFINITIONS[9]).toMatchObject({
      key: 'wasted_time',
      name: '낭비한 시간',
      color: '#1F2937',
    });
  });

  it('사용자별로 안정적인 기본 설정 id를 만든다', () => {
    expect(getDefaultSettingsId('user-1')).toBe('settings:user-1');
    expect(
      createDefaultAppSettings({
        userId: 'user-1',
        now: '2026-05-07T00:00:00.000Z',
      }),
    ).toMatchObject({
      id: 'settings:user-1',
      userId: 'user-1',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
      ...DEFAULT_APP_SETTINGS,
    });
  });

  it('예시 카테고리의 표시 순서를 안정적으로 유지한다', () => {
    expect(EXAMPLE_CATEGORY_DEFINITIONS.map((category) => category.sortOrder)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });
});
