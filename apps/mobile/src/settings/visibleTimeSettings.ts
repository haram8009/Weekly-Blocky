import { validateDiaryTimeRange, type TimeString } from '@weekly/domain';
import type { UpdateSettingsInput } from '@/lib/supabase/settings';

type VisibleTimeSettingsValidationResult =
  | {
      isValid: true;
      input: Pick<UpdateSettingsInput, 'visibleStartTime' | 'visibleEndTime'>;
    }
  | {
      isValid: false;
      errorMessage: string;
    };

const INVALID_VISIBLE_TIME_RANGE_MESSAGE =
  '시간은 10분 단위이며 종료 시간이 시작 시간보다 늦어야 합니다.';

export function validateVisibleTimeSettingsDraft(
  visibleStartTime: TimeString,
  visibleEndTime: TimeString,
): VisibleTimeSettingsValidationResult {
  const validation = validateDiaryTimeRange(visibleStartTime, visibleEndTime);

  if (!validation.isValid) {
    return {
      isValid: false,
      errorMessage: INVALID_VISIBLE_TIME_RANGE_MESSAGE,
    };
  }

  return {
    isValid: true,
    input: {
      visibleStartTime,
      visibleEndTime,
    },
  };
}
