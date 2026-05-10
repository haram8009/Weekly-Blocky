import { addDaysToDate, getDatesOfWeek, getWeekStartDate, type DateString } from '@weekly/domain';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { getMobileSupabaseEnvStatus } from '@/lib/supabase/env';
import { listMobileTimeEntriesByWeek } from '@/lib/supabase/timeEntries';
import { theme } from '@/theme';
import { createRecordedDateSet } from '@/weekViewModel';
import { loadLastOpenedWeekStartDate, saveLastOpenedWeekStartDate } from '@/weekViewPreferences';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const WEEK_STEP_DAYS = 7;

type WeekEntriesLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';

export default function WeekScreen() {
  const router = useRouter();
  const todayDate = getLocalDateString();
  const todayWeekStartDate = getWeekStartDate(todayDate, 'monday');
  const hasUserChangedWeekRef = useRef(false);
  const [visibleWeekStartDate, setVisibleWeekStartDate] = useState<DateString>(todayWeekStartDate);
  const [hasLoadedLastOpenedWeek, setHasLoadedLastOpenedWeek] = useState(false);
  const [recordedDates, setRecordedDates] = useState<ReadonlySet<DateString>>(() => new Set());
  const [weekEntriesLoadState, setWeekEntriesLoadState] = useState<WeekEntriesLoadState>('idle');
  const visibleWeekDates = useMemo(
    () => getDatesOfWeek(visibleWeekStartDate),
    [visibleWeekStartDate],
  );
  const isCurrentWeek = visibleWeekStartDate === todayWeekStartDate;
  const shouldShowRecordStatus = weekEntriesLoadState === 'ready';

  useEffect(() => {
    let isActive = true;

    void loadLastOpenedWeekStartDate()
      .then((lastOpenedWeekStartDate) => {
        if (!isActive || !lastOpenedWeekStartDate || hasUserChangedWeekRef.current) {
          return;
        }

        setVisibleWeekStartDate(lastOpenedWeekStartDate);
      })
      .finally(() => {
        if (isActive) {
          setHasLoadedLastOpenedWeek(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedLastOpenedWeek) {
      return;
    }

    void saveLastOpenedWeekStartDate(visibleWeekStartDate).catch(() => undefined);
  }, [hasLoadedLastOpenedWeek, visibleWeekStartDate]);

  useEffect(() => {
    const envStatus = getMobileSupabaseEnvStatus();

    if (!envStatus.isConfigured) {
      setRecordedDates(new Set());
      setWeekEntriesLoadState('unconfigured');
      return;
    }

    let isActive = true;

    setWeekEntriesLoadState('loading');

    void listMobileTimeEntriesByWeek(visibleWeekStartDate)
      .then((entries) => {
        if (!isActive) {
          return;
        }

        setRecordedDates(createRecordedDateSet(entries));
        setWeekEntriesLoadState('ready');
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setRecordedDates(new Set());
        setWeekEntriesLoadState('error');
      });

    return () => {
      isActive = false;
    };
  }, [visibleWeekStartDate]);

  function moveWeek(days: number) {
    hasUserChangedWeekRef.current = true;
    setVisibleWeekStartDate((currentWeekStartDate) => addDaysToDate(currentWeekStartDate, days));
  }

  function moveToToday() {
    hasUserChangedWeekRef.current = true;
    setVisibleWeekStartDate(getWeekStartDate(getLocalDateString(), 'monday'));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>이번 주</Text>
        <Text style={styles.title}>주간 기록</Text>
      </View>

      <View style={styles.weekNavigator}>
        <Pressable
          accessibilityLabel="이전 주로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => moveWeek(-WEEK_STEP_DAYS)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Text style={styles.iconButtonText}>{'‹'}</Text>
        </Pressable>

        <View style={styles.weekRangeGroup}>
          <Text style={styles.weekRange}>{formatWeekRange(visibleWeekDates)}</Text>
          <Text style={styles.weekRangeCaption}>월요일 시작</Text>
        </View>

        <Pressable
          accessibilityLabel="다음 주로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => moveWeek(WEEK_STEP_DAYS)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Text style={styles.iconButtonText}>{'›'}</Text>
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

      <View style={styles.weekDayList}>
        {visibleWeekDates.map((date, index) => {
          const isToday = date === todayDate;
          const hasRecordedEntries = recordedDates.has(date);

          return (
            <Pressable
              key={date}
              accessibilityLabel={`${formatMonthDay(date)} ${WEEKDAY_LABELS[index]}${
                shouldShowRecordStatus ? (hasRecordedEntries ? ' 기록 있음' : ' 기록 없음') : ''
              }`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/today', params: { date } })}
              style={({ pressed }) => [
                styles.dayCell,
                shouldShowRecordStatus && hasRecordedEntries && styles.recordedCell,
                isToday && styles.todayCell,
                shouldShowRecordStatus && hasRecordedEntries && isToday && styles.recordedTodayCell,
                pressed && styles.dayCellPressed,
              ]}
            >
              <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                {WEEKDAY_LABELS[index]}
              </Text>
              <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>
                {formatDayNumber(date)}
              </Text>
              {shouldShowRecordStatus && (
                <View
                  style={[
                    styles.recordStatusIndicator,
                    hasRecordedEntries
                      ? styles.recordedStatusIndicator
                      : styles.emptyStatusIndicator,
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryPlaceholder}>
        <Text style={styles.summaryTitle}>주간 요약</Text>
        <Text style={styles.summaryText}>
          {formatWeekEntriesSummary(weekEntriesLoadState, recordedDates.size)}
        </Text>
      </View>
    </Screen>
  );
}

function getLocalDateString(date = new Date()): DateString {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
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

function formatDayNumber(date: DateString): string {
  const [, , dayText] = date.split('-');

  return Number(dayText).toString();
}

function formatWeekEntriesSummary(state: WeekEntriesLoadState, recordedDateCount: number): string {
  switch (state) {
    case 'loading':
      return '서버 기록을 확인하고 있습니다.';
    case 'ready':
      return recordedDateCount > 0
        ? `이번 주 ${recordedDateCount}일에 기록이 있습니다.`
        : '이번 주에는 아직 기록된 날짜가 없습니다.';
    case 'unconfigured':
      return '서버 연결 전이라 기록 여부를 표시하지 않습니다.';
    case 'error':
      return '기록 여부를 불러오지 못했습니다.';
    case 'idle':
    default:
      return '기록 여부를 준비하고 있습니다.';
  }
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: theme.spacing.md,
  },
  eyebrow: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  title: {
    color: theme.color.text,
    fontSize: theme.typography.title,
    fontWeight: '700',
  },
  weekNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  iconButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  iconButtonText: {
    color: theme.color.primary,
    fontSize: 30,
    fontWeight: '400',
  },
  weekRangeGroup: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  weekRange: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  weekRangeCaption: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  todayButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  todayButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  todayButtonDisabled: {
    backgroundColor: 'transparent',
  },
  todayButtonText: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  todayButtonTextDisabled: {
    color: theme.color.textMuted,
  },
  weekDayList: {
    flexDirection: 'row',
    gap: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    marginBottom: theme.spacing.lg,
  },
  dayCell: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderRightWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  dayCellPressed: {
    opacity: 0.78,
  },
  todayCell: {
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  recordedCell: {
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  recordedTodayCell: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.surfaceMuted,
  },
  dayLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  todayLabel: {
    color: theme.color.primary,
  },
  dayNumber: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  todayNumber: {
    color: theme.color.primary,
  },
  recordStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordedStatusIndicator: {
    backgroundColor: theme.color.primary,
  },
  emptyStatusIndicator: {
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  summaryPlaceholder: {
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
  },
  summaryTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  summaryText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
