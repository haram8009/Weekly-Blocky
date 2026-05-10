import { addDaysToDate, getDatesOfWeek, getWeekStartDate, type DateString } from '@weekly/domain';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const WEEK_STEP_DAYS = 7;

export default function WeekScreen() {
  const todayDate = getLocalDateString();
  const todayWeekStartDate = getWeekStartDate(todayDate, 'monday');
  const [visibleWeekStartDate, setVisibleWeekStartDate] = useState<DateString>(todayWeekStartDate);
  const visibleWeekDates = useMemo(
    () => getDatesOfWeek(visibleWeekStartDate),
    [visibleWeekStartDate],
  );
  const isCurrentWeek = visibleWeekStartDate === todayWeekStartDate;

  function moveWeek(days: number) {
    setVisibleWeekStartDate((currentWeekStartDate) => addDaysToDate(currentWeekStartDate, days));
  }

  function moveToToday() {
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
          <Text style={styles.iconButtonText}>{'<'}</Text>
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

      <View style={styles.weekDayList}>
        {visibleWeekDates.map((date, index) => {
          const isToday = date === todayDate;

          return (
            <View key={date} style={[styles.dayCell, isToday && styles.todayCell]}>
              <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                {WEEKDAY_LABELS[index]}
              </Text>
              <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>
                {formatDayNumber(date)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.summaryPlaceholder}>
        <Text style={styles.summaryTitle}>주간 요약</Text>
        <Text style={styles.summaryText}>아직 주간 기록이 없습니다.</Text>
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
    marginBottom: theme.spacing.md,
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
  weekDayList: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  dayCell: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  todayCell: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.surfaceMuted,
  },
  dayLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  todayLabel: {
    color: theme.color.primary,
  },
  dayNumber: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '900',
  },
  todayNumber: {
    color: theme.color.primary,
  },
  summaryPlaceholder: {
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.lg,
  },
  summaryTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  summaryText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
