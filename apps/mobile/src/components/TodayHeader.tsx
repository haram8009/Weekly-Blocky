import { type DateString } from '@weekly/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

type TodayHeaderProps = {
  selectedDate: DateString;
  isTodaySelected: boolean;
  onOpenCategories: () => void;
};

export function TodayHeader({ selectedDate, isTodaySelected, onOpenCategories }: TodayHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <View style={styles.headerTitleCopy}>
          <Text style={styles.eyebrow}>{isTodaySelected ? '오늘' : '선택 날짜'}</Text>
          <Text style={styles.title}>{formatMonthDay(selectedDate)} 기록</Text>
        </View>
        <Pressable
          accessibilityLabel="카테고리 관리 열기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onOpenCategories}
          style={({ pressed }) => [styles.headerMenuButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.headerMenuButtonText}>...</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatMonthDay(date: DateString): string {
  const [, monthText, dayText] = date.split('-');

  return `${Number(monthText)}월 ${Number(dayText)}일`;
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  headerTitleCopy: {
    flex: 1,
    gap: 2,
  },
  headerMenuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  headerMenuButtonText: {
    color: theme.color.primary,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 20,
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
  buttonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
});
