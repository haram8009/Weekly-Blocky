import { getSupabaseStorageErrorMessage } from '@weekly/data';
import {
  addDaysToDate,
  getDatesOfWeek,
  getWeekStartDate,
  type DateString,
  type WeekReview,
} from '@weekly/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { getMobileSupabaseEnvStatus } from '@/lib/supabase/env';
import {
  getMobileWeekReviewByWeekStartDate,
  upsertMobileWeekReview,
} from '@/lib/supabase/weekReviews';
import { theme } from '@/theme';

const WEEK_STEP_DAYS = 7;

type WeekReviewDraft = Pick<WeekReview, 'summary' | 'wins' | 'problems' | 'nextWeekFocus'>;
type WeekReviewLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';
type WeekReviewSaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ReviewScreen() {
  const todayDate = getLocalDateString();
  const todayWeekStartDate = getWeekStartDate(todayDate, 'monday');
  const [visibleWeekStartDate, setVisibleWeekStartDate] = useState<DateString>(todayWeekStartDate);
  const [weekReview, setWeekReview] = useState<WeekReview | null>(null);
  const [reviewDraft, setReviewDraft] = useState<WeekReviewDraft>(() => createEmptyReviewDraft());
  const [loadState, setLoadState] = useState<WeekReviewLoadState>('idle');
  const [saveState, setSaveState] = useState<WeekReviewSaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const visibleWeekStartDateRef = useRef(visibleWeekStartDate);
  const visibleWeekDates = useMemo(
    () => getDatesOfWeek(visibleWeekStartDate),
    [visibleWeekStartDate],
  );
  const isCurrentWeek = visibleWeekStartDate === todayWeekStartDate;
  const latestSavedAtLabel = weekReview ? formatDateTime(weekReview.updatedAt) : '아직 저장 전';
  const canEditReview = loadState === 'ready' && saveState !== 'saving';

  const loadWeekReview = useCallback((weekStartDate: DateString) => {
    const envStatus = getMobileSupabaseEnvStatus();
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    setWeekReview(null);
    setReviewDraft(createEmptyReviewDraft());
    setSaveState('idle');
    setSaveErrorMessage(null);

    if (!envStatus.isConfigured) {
      setLoadState('unconfigured');
      setErrorMessage(`Supabase 환경 변수가 비어 있습니다: ${envStatus.missingKeys.join(', ')}`);
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    getMobileWeekReviewByWeekStartDate(weekStartDate)
      .then((nextWeekReview) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setWeekReview(nextWeekReview);
        setReviewDraft(createReviewDraft(nextWeekReview));
        setLoadState('ready');
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setWeekReview(null);
        setReviewDraft(createEmptyReviewDraft());
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : '주간 회고를 불러오지 못했습니다.',
        );
      });
  }, []);

  const saveWeekReview = useCallback(async () => {
    if (saveState === 'saving' || loadState !== 'ready') {
      return;
    }

    const targetWeekStartDate = visibleWeekStartDate;

    setSaveState('saving');
    setSaveErrorMessage(null);

    try {
      const nextWeekReview = await upsertMobileWeekReview({
        weekStartDate: targetWeekStartDate,
        summary: reviewDraft.summary,
        wins: reviewDraft.wins,
        problems: reviewDraft.problems,
        nextWeekFocus: reviewDraft.nextWeekFocus,
      });

      if (visibleWeekStartDateRef.current !== targetWeekStartDate) {
        return;
      }

      setWeekReview(nextWeekReview);
      setReviewDraft(createReviewDraft(nextWeekReview));
      setSaveState('saved');
    } catch (error) {
      if (visibleWeekStartDateRef.current !== targetWeekStartDate) {
        return;
      }

      setSaveState('error');
      setSaveErrorMessage(getSupabaseStorageErrorMessage(error));
    }
  }, [loadState, reviewDraft, saveState, visibleWeekStartDate]);

  useEffect(() => {
    visibleWeekStartDateRef.current = visibleWeekStartDate;
  }, [visibleWeekStartDate]);

  useEffect(() => {
    loadWeekReview(visibleWeekStartDate);
  }, [loadWeekReview, visibleWeekStartDate]);

  function moveWeek(days: number) {
    setVisibleWeekStartDate((currentWeekStartDate) => addDaysToDate(currentWeekStartDate, days));
  }

  function moveToToday() {
    setVisibleWeekStartDate(getWeekStartDate(getLocalDateString(), 'monday'));
  }

  function updateReviewDraft(field: keyof WeekReviewDraft, value: string) {
    setReviewDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));

    if (saveState !== 'saving') {
      setSaveState('idle');
      setSaveErrorMessage(null);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>회고</Text>
        <Text style={styles.title}>주간 회고</Text>
      </View>

      <View style={styles.weekNavigator}>
        <Pressable
          accessibilityLabel="이전 주 회고로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => moveWeek(-WEEK_STEP_DAYS)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Text style={styles.iconButtonText}>{'<'}</Text>
        </Pressable>

        <View style={styles.weekRangeGroup}>
          <Text style={styles.weekRange}>{formatWeekRange(visibleWeekDates)}</Text>
          <Text style={styles.weekRangeCaption}>월요일 시작</Text>
        </View>

        <Pressable
          accessibilityLabel="다음 주 회고로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => moveWeek(WEEK_STEP_DAYS)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Text style={styles.iconButtonText}>{'>'}</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isCurrentWeek}
        onPress={moveToToday}
        style={({ pressed }) => [
          styles.todayButton,
          isCurrentWeek && styles.todayButtonDisabled,
          pressed && !isCurrentWeek && styles.todayButtonPressed,
        ]}
      >
        <Text style={[styles.todayButtonText, isCurrentWeek && styles.todayButtonTextDisabled]}>
          오늘
        </Text>
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>회고 메모</Text>
            <Text style={styles.sectionText}>마지막 저장: {latestSavedAtLabel}</Text>
          </View>
        </View>
        {renderWeekReviewContent({
          canEditReview,
          errorMessage,
          loadState,
          onChangeDraft: updateReviewDraft,
          onRetry: () => loadWeekReview(visibleWeekStartDate),
          onSave: saveWeekReview,
          reviewDraft,
          saveErrorMessage,
          saveState,
        })}
      </View>
    </Screen>
  );
}

function renderWeekReviewContent({
  canEditReview,
  errorMessage,
  loadState,
  onChangeDraft,
  onRetry,
  onSave,
  reviewDraft,
  saveErrorMessage,
  saveState,
}: {
  canEditReview: boolean;
  errorMessage: string | null;
  loadState: WeekReviewLoadState;
  onChangeDraft: (field: keyof WeekReviewDraft, value: string) => void;
  onRetry: () => void;
  onSave: () => void;
  reviewDraft: WeekReviewDraft;
  saveErrorMessage: string | null;
  saveState: WeekReviewSaveState;
}) {
  if (loadState === 'idle' || loadState === 'loading') {
    return <Text style={styles.sectionText}>회고를 불러오고 있습니다.</Text>;
  }

  if (loadState === 'unconfigured') {
    return (
      <View style={styles.statusBlock}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Text style={styles.sectionText}>서버 연결 설정 후 회고를 저장할 수 있습니다.</Text>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.statusBlock}>
        <Text style={styles.errorText}>회고 조회 실패: {errorMessage}</Text>
        <PrimaryButton label="다시 불러오기" onPress={onRetry} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={styles.reviewForm}>
      <ReviewTextField
        editable={canEditReview}
        label="이번 주 요약"
        onChangeText={(value) => onChangeDraft('summary', value)}
        placeholder="이번 주 시간 사용을 한 문단으로 정리하세요."
        value={reviewDraft.summary}
      />
      <ReviewTextField
        editable={canEditReview}
        label="잘한 점"
        onChangeText={(value) => onChangeDraft('wins', value)}
        placeholder="유지하고 싶은 선택이나 흐름을 남기세요."
        value={reviewDraft.wins}
      />
      <ReviewTextField
        editable={canEditReview}
        label="아쉬운 점"
        onChangeText={(value) => onChangeDraft('problems', value)}
        placeholder="다음 주에 조정할 낭비나 막힌 지점을 적으세요."
        value={reviewDraft.problems}
      />
      <ReviewTextField
        editable={canEditReview}
        label="다음 주 집중"
        onChangeText={(value) => onChangeDraft('nextWeekFocus', value)}
        placeholder="다음 주에 늘릴 것과 줄일 것을 정하세요."
        value={reviewDraft.nextWeekFocus}
      />

      <View style={styles.actionRow}>
        <PrimaryButton
          disabled={saveState === 'saving'}
          label={saveState === 'saving' ? '저장 중' : '저장'}
          onPress={onSave}
          style={saveState === 'saving' ? styles.disabledButton : undefined}
        />
        {saveState === 'error' ? (
          <PrimaryButton label="재시도" onPress={onSave} variant="secondary" />
        ) : null}
      </View>

      {saveState === 'saving' ? (
        <Text style={styles.saveStatusText}>회고를 저장하고 있습니다.</Text>
      ) : null}
      {saveState === 'saved' ? <Text style={styles.saveStatusText}>저장되었습니다.</Text> : null}
      {saveState === 'error' ? (
        <View style={styles.statusBlock}>
          <Text style={styles.errorText}>저장 실패: {saveErrorMessage}</Text>
          <Text style={styles.sectionText}>네트워크 상태를 확인한 뒤 다시 시도하세요.</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewTextField({
  editable,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  editable: boolean;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={editable}
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textMuted}
        style={[styles.textInput, !editable && styles.textInputDisabled]}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

function createEmptyReviewDraft(): WeekReviewDraft {
  return {
    summary: '',
    wins: '',
    problems: '',
    nextWeekFocus: '',
  };
}

function createReviewDraft(review: WeekReview | null): WeekReviewDraft {
  if (!review) {
    return createEmptyReviewDraft();
  }

  return {
    summary: review.summary,
    wins: review.wins,
    problems: review.problems,
    nextWeekFocus: review.nextWeekFocus,
  };
}

function getLocalDateString(date = new Date()): DateString {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') as DateString;
}

function formatWeekRange(dates: DateString[]): string {
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  if (!firstDate || !lastDate) {
    return '';
  }

  return `${formatMonthDay(firstDate)} - ${formatMonthDay(lastDate)}`;
}

function formatMonthDay(date: DateString): string {
  const [, monthText, dayText] = date.split('-');

  return `${Number(monthText)}월 ${Number(dayText)}일`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  title: {
    color: theme.color.text,
    fontSize: theme.typography.heading,
    fontWeight: '900',
  },
  weekNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  iconButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  iconButtonText: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '900',
  },
  weekRangeGroup: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  weekRange: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  weekRangeCaption: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  todayButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  todayButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  todayButtonDisabled: {
    backgroundColor: theme.color.surfaceMuted,
  },
  todayButtonText: {
    color: theme.color.surface,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  todayButtonTextDisabled: {
    color: theme.color.textMuted,
  },
  section: {
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  sectionText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  statusBlock: {
    gap: theme.spacing.md,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  reviewForm: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  formField: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  textInput: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.background,
    color: theme.color.text,
    fontSize: theme.typography.body,
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  textInputDisabled: {
    backgroundColor: theme.color.surfaceMuted,
    color: theme.color.textMuted,
  },
  actionRow: {
    gap: theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveStatusText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
