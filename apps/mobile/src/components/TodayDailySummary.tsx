import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';
import { type DayPhotosLoadState } from '@/todayScreenTypes';
import { formatDuration, type DailySummary } from '@/todayViewModel';

type TodayDailySummaryProps = {
  dailySummary: DailySummary;
  dayPhotosLoadState: DayPhotosLoadState;
  dayPhotoCount: number;
};

export function TodayDailySummary({
  dailySummary,
  dayPhotosLoadState,
  dayPhotoCount,
}: TodayDailySummaryProps) {
  return (
    <View style={styles.dailySummary}>
      <View style={styles.summaryMetric}>
        <Text style={styles.summaryMetricLabel}>완성률</Text>
        <Text style={styles.summaryMetricValue}>{dailySummary.completionRate}%</Text>
      </View>
      <View style={styles.summaryMetric}>
        <Text style={styles.summaryMetricLabel}>기록</Text>
        <Text style={styles.summaryMetricValue}>
          {formatDuration(dailySummary.recordedMinutes)}
        </Text>
      </View>
      <View style={styles.summaryMetric}>
        <Text style={styles.summaryMetricLabel}>미기록</Text>
        <Text style={styles.summaryMetricValue}>
          {formatDuration(dailySummary.unrecordedMinutes)}
        </Text>
      </View>
      <View style={styles.summaryMetric}>
        <Text style={styles.summaryMetricLabel}>최다</Text>
        <Text style={styles.summaryMetricValue}>{dailySummary.topCategoryLabel ?? '없음'}</Text>
      </View>
      <View style={styles.summaryMetric}>
        <Text style={styles.summaryMetricLabel}>사진</Text>
        <Text style={styles.summaryMetricValue}>
          {formatDayPhotoSummary(dayPhotosLoadState, dayPhotoCount)}
        </Text>
      </View>
    </View>
  );
}

function formatDayPhotoSummary(state: DayPhotosLoadState, photoCount: number): string {
  if (state === 'loading' || state === 'idle') {
    return '확인 중';
  }

  if (state === 'disabled') {
    return '꺼짐';
  }

  if (state === 'permission-denied') {
    return '권한 없음';
  }

  if (state === 'error') {
    return '오류';
  }

  return `${photoCount}개`;
}

const styles = StyleSheet.create({
  dailySummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  summaryMetric: {
    flexBasis: '29%',
    flexGrow: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  summaryMetricLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  summaryMetricValue: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
});
