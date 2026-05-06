import { getDatesOfWeek, getWeekStartDate, type DateString } from '@weekly/domain';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

const previewDate: DateString = '2026-05-07';
const previewWeekStartDate = getWeekStartDate(previewDate, 'monday');
const previewWeekDates = getDatesOfWeek(previewWeekStartDate);

export default function WeekScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>이번 주</Text>
        <Text style={styles.title}>오늘 기준 주간 기록</Text>
        <Text style={styles.weekRange}>
          {previewWeekDates[0]} - {previewWeekDates[6]}
        </Text>
      </View>

      <View style={styles.gridPlaceholder}>
        <Text style={styles.placeholderTitle}>기록 그리드</Text>
        <Text style={styles.placeholderText}>10분 단위 주간 그리드가 이 영역에 연결됩니다.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
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
  weekRange: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  gridPlaceholder: {
    minHeight: 360,
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.lg,
  },
  placeholderTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholderText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
});
