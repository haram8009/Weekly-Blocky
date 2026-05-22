import { type DateString } from '@weekly/domain';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';
import { type CalendarDateItem, type CalendarMonth } from '@/todayViewModel';

const DATE_PICKER_CALENDAR_MAX_HEIGHT = 360;
const DATE_PICKER_WEEK_MAX_HEIGHT = 180;

export type DatePickerMode = 'calendar' | 'week' | null;

type TodayDateNavigatorProps = {
  selectedDate: DateString;
  isTodaySelected: boolean;
  mode: DatePickerMode;
  revealValue: Animated.Value;
  calendarMonth: CalendarMonth;
  weekCalendarRows: CalendarDateItem[][];
  onMoveSelectedDate: (days: number) => void;
  onMoveToToday: () => void;
  onOpenDatePicker: (mode: Exclude<DatePickerMode, null>) => void;
  onCloseDatePicker: () => void;
  onMovePickerMonth: (months: number) => void;
  onSelectDate: (date: DateString) => void;
};

export function TodayDateNavigator({
  selectedDate,
  isTodaySelected,
  mode,
  revealValue,
  calendarMonth,
  weekCalendarRows,
  onMoveSelectedDate,
  onMoveToToday,
  onOpenDatePicker,
  onCloseDatePicker,
  onMovePickerMonth,
  onSelectDate,
}: TodayDateNavigatorProps) {
  return (
    <View style={styles.dateNavigatorSection}>
      <View style={styles.dateNavigator}>
        <Pressable
          accessibilityLabel="이전 날로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onMoveSelectedDate(-1)}
          style={({ pressed }) => [styles.dateIconButton, pressed && styles.dateButtonPressed]}
        >
          <Text style={styles.dateIconButtonText}>{'‹'}</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="날짜 선택 캘린더 열기"
          accessibilityRole="button"
          onPress={() => onOpenDatePicker('calendar')}
          style={({ pressed }) => [styles.dateSelectorButton, pressed && styles.dateButtonPressed]}
        >
          <Text style={styles.dateSelectorText}>{formatFullDate(selectedDate)}</Text>
          <Text style={styles.dateSelectorCaption}>캘린더</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="주간 날짜 선택 열기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onOpenDatePicker('week')}
          style={({ pressed }) => [styles.dateToolButton, pressed && styles.dateButtonPressed]}
        >
          <Text style={styles.dateToolButtonText}>▦</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="오늘 날짜로 돌아가기"
          accessibilityRole="button"
          accessibilityState={{ disabled: isTodaySelected }}
          disabled={isTodaySelected}
          hitSlop={8}
          onPress={onMoveToToday}
          style={({ pressed }) => [
            styles.dateToolButton,
            isTodaySelected && styles.dateToolButtonDisabled,
            pressed && !isTodaySelected && styles.dateButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.dateToolButtonText,
              isTodaySelected && styles.dateToolButtonTextDisabled,
            ]}
          >
            ↺
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="다음 날로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onMoveSelectedDate(1)}
          style={({ pressed }) => [styles.dateIconButton, pressed && styles.dateButtonPressed]}
        >
          <Text style={styles.dateIconButtonText}>{'›'}</Text>
        </Pressable>
      </View>

      <InlineDatePicker
        mode={mode}
        revealValue={revealValue}
        calendarMonth={calendarMonth}
        weekCalendarRows={weekCalendarRows}
        onClose={onCloseDatePicker}
        onMoveMonth={onMovePickerMonth}
        onSelectDate={onSelectDate}
      />
    </View>
  );
}

function InlineDatePicker({
  mode,
  revealValue,
  calendarMonth,
  weekCalendarRows,
  onClose,
  onMoveMonth,
  onSelectDate,
}: {
  mode: DatePickerMode;
  revealValue: Animated.Value;
  calendarMonth: CalendarMonth;
  weekCalendarRows: CalendarDateItem[][];
  onClose: () => void;
  onMoveMonth: (months: number) => void;
  onSelectDate: (date: DateString) => void;
}) {
  if (!mode) {
    return null;
  }

  const maxHeight =
    mode === 'calendar' ? DATE_PICKER_CALENDAR_MAX_HEIGHT : DATE_PICKER_WEEK_MAX_HEIGHT;
  const pickerRows = mode === 'calendar' ? calendarMonth.weeks : weekCalendarRows;

  return (
    <Animated.View
      style={[
        styles.inlineDatePickerReveal,
        {
          maxHeight: revealValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, maxHeight],
          }),
          opacity: revealValue,
          transform: [
            {
              translateY: revealValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.inlineDatePickerPanel}>
        <View style={styles.datePickerHeader}>
          <View>
            <Text style={styles.datePickerEyebrow}>
              {mode === 'calendar' ? '캘린더' : '주간 보기'}
            </Text>
            <Text style={styles.datePickerTitle}>
              {mode === 'calendar' ? calendarMonth.monthLabel : formatWeekRange(weekCalendarRows)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="날짜 선택 닫기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.datePickerCloseButton,
              pressed && styles.dateButtonPressed,
            ]}
          >
            <Text style={styles.datePickerCloseButtonText}>×</Text>
          </Pressable>
        </View>

        {mode === 'calendar' ? (
          <View style={styles.datePickerMonthNavigator}>
            <Pressable
              accessibilityLabel="이전 달"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onMoveMonth(-1)}
              style={({ pressed }) => [
                styles.datePickerMonthButton,
                pressed && styles.dateButtonPressed,
              ]}
            >
              <Text style={styles.datePickerMonthButtonText}>{'‹'}</Text>
            </Pressable>
            <Text style={styles.datePickerMonthLabel}>{calendarMonth.monthLabel}</Text>
            <Pressable
              accessibilityLabel="다음 달"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onMoveMonth(1)}
              style={({ pressed }) => [
                styles.datePickerMonthButton,
                pressed && styles.dateButtonPressed,
              ]}
            >
              <Text style={styles.datePickerMonthButtonText}>{'›'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.datePickerWeekdayRow}>
          {['월', '화', '수', '목', '금', '토', '일'].map((label) => (
            <Text key={label} style={styles.datePickerWeekdayLabel}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {pickerRows.map((week, weekIndex) => (
            <View key={`picker-week-${weekIndex}`} style={styles.calendarWeekRow}>
              {week.map((item) => (
                <CalendarDateButton key={item.date} item={item} onSelectDate={onSelectDate} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function CalendarDateButton({
  item,
  onSelectDate,
}: {
  item: CalendarDateItem;
  onSelectDate: (date: DateString) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${formatFullDate(item.date)}로 이동`}
      accessibilityRole="button"
      onPress={() => onSelectDate(item.date)}
      style={({ pressed }) => [
        styles.calendarDateButton,
        item.isSelected && styles.selectedDateCell,
        item.isToday && !item.isSelected && styles.todayDateCell,
        pressed && styles.dateButtonPressed,
      ]}
    >
      <Text
        style={[
          styles.calendarDateText,
          !item.isCurrentMonth && styles.outsideMonthDateText,
          item.isSelected && styles.selectedDateText,
          item.isToday && !item.isSelected && styles.todayDateText,
        ]}
      >
        {item.dayNumber}
      </Text>
    </Pressable>
  );
}

function formatFullDate(date: DateString): string {
  const [yearText, monthText, dayText] = date.split('-');

  return `${yearText}년 ${Number(monthText)}월 ${Number(dayText)}일`;
}

function formatMonthDay(date: DateString): string {
  const [, monthText, dayText] = date.split('-');

  return `${Number(monthText)}월 ${Number(dayText)}일`;
}

function formatWeekRange(rows: CalendarDateItem[][]): string {
  const week = rows[0] ?? [];
  const firstDate = week[0]?.date;
  const lastDate = week[week.length - 1]?.date;

  if (!firstDate || !lastDate) {
    return '선택 주';
  }

  return `${formatMonthDay(firstDate)}-${formatMonthDay(lastDate)}`;
}

const styles = StyleSheet.create({
  dateNavigatorSection: {
    marginBottom: theme.spacing.md,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dateIconButton: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  dateIconButtonText: {
    color: theme.color.primary,
    fontSize: 30,
    fontWeight: '400',
  },
  dateButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  dateSelectorButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
  },
  dateSelectorText: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
  dateSelectorCaption: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    marginTop: 2,
  },
  dateToolButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  dateToolButtonDisabled: {
    backgroundColor: 'transparent',
  },
  dateToolButtonText: {
    color: theme.color.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  dateToolButtonTextDisabled: {
    color: theme.color.textMuted,
  },
  inlineDatePickerReveal: {
    overflow: 'hidden',
  },
  inlineDatePickerPanel: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.md,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  datePickerEyebrow: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  datePickerTitle: {
    color: theme.color.text,
    fontSize: theme.typography.heading,
    fontWeight: '700',
    marginTop: 2,
  },
  datePickerCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  datePickerCloseButtonText: {
    color: theme.color.textMuted,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },
  datePickerMonthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  datePickerMonthButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  datePickerMonthButtonText: {
    color: theme.color.primary,
    fontSize: 28,
    fontWeight: '400',
  },
  datePickerMonthLabel: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
  datePickerWeekdayRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  datePickerWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  calendarGrid: {
    gap: theme.spacing.xs,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  calendarDateButton: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
  },
  calendarDateText: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
  outsideMonthDateText: {
    color: theme.color.textMuted,
    fontWeight: '500',
  },
  selectedDateCell: {
    backgroundColor: theme.color.primary,
  },
  todayDateCell: {
    borderWidth: 1,
    borderColor: theme.color.primary,
    backgroundColor: theme.color.surface,
  },
  selectedDateText: {
    color: theme.color.surface,
  },
  todayDateText: {
    color: theme.color.primary,
  },
});
