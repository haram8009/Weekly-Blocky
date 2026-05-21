import {
  addDaysToDate,
  createReviewChartData,
  createWeeklyStats,
  getDatesOfWeek,
  getWeekStartDate,
  type Category,
  type DateString,
  type ReviewChartDailyBreakdown,
  type ReviewChartData,
  type ReviewChartGroup,
  type TimeEntry,
} from '@weekly/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { getMobileSupabaseEnvStatus } from '@/lib/supabase/env';
import { listMobileCategories } from '@/lib/supabase/categories';
import { listMobileTimeEntriesByWeek } from '@/lib/supabase/timeEntries';
import { formatDuration } from '@/todayViewModel';
import { theme } from '@/theme';

const WEEK_STEP_DAYS = 7;
const LINE_CHART_WIDTH = 320;
const LINE_CHART_HEIGHT = 180;
const DONUT_SIZE = 140;
const DONUT_RADIUS = 54;
const DONUT_STROKE_WIDTH = 18;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

type ReviewChartLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';

export default function ReviewScreen() {
  const todayDate = getLocalDateString();
  const todayWeekStartDate = getWeekStartDate(todayDate, 'monday');
  const [visibleWeekStartDate, setVisibleWeekStartDate] = useState<DateString>(todayWeekStartDate);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<ReviewChartLoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<DateString>(todayDate);
  const requestIdRef = useRef(0);
  const visibleWeekDates = useMemo(
    () => getDatesOfWeek(visibleWeekStartDate),
    [visibleWeekStartDate],
  );
  const isCurrentWeek = visibleWeekStartDate === todayWeekStartDate;
  const weeklyStats = useMemo(
    () =>
      createWeeklyStats({
        entries,
        categories,
        weekStartDate: visibleWeekStartDate,
      }),
    [categories, entries, visibleWeekStartDate],
  );
  const chartData = useMemo(
    () =>
      createReviewChartData({
        entries,
        categories,
        weekStartDate: visibleWeekStartDate,
      }),
    [categories, entries, visibleWeekStartDate],
  );
  const selectedDailyBreakdown =
    chartData.dailyBreakdowns.find((day) => day.date === selectedDate) ??
    chartData.dailyBreakdowns[0];

  const loadReviewChartData = useCallback((weekStartDate: DateString) => {
    const envStatus = getMobileSupabaseEnvStatus();
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    setEntries([]);
    setCategories([]);

    if (!envStatus.isConfigured) {
      setLoadState('unconfigured');
      setErrorMessage(`Supabase 환경 변수가 비어 있습니다: ${envStatus.missingKeys.join(', ')}`);
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    Promise.all([
      listMobileTimeEntriesByWeek(weekStartDate),
      listMobileCategories({ includeArchived: true }),
    ])
      .then(([nextEntries, nextCategories]) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setEntries(nextEntries);
        setCategories(nextCategories);
        setLoadState('ready');
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setEntries([]);
        setCategories([]);
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : '회고 차트를 불러오지 못했습니다.',
        );
      });
  }, []);

  useEffect(() => {
    loadReviewChartData(visibleWeekStartDate);
  }, [loadReviewChartData, visibleWeekStartDate]);

  useEffect(() => {
    setSelectedDate(visibleWeekDates.includes(todayDate) ? todayDate : visibleWeekDates[0]);
  }, [todayDate, visibleWeekDates]);

  function moveWeek(days: number) {
    setVisibleWeekStartDate((currentWeekStartDate) => addDaysToDate(currentWeekStartDate, days));
  }

  function moveToToday() {
    setVisibleWeekStartDate(getWeekStartDate(getLocalDateString(), 'monday'));
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
            <Text style={styles.sectionTitle}>회고 차트</Text>
            <Text style={styles.sectionText}>기록된 시간 기준으로 색상 그룹 흐름을 봅니다.</Text>
          </View>
        </View>
        {renderReviewChartContent({
          chartData,
          errorMessage,
          loadState,
          onRetry: () => loadReviewChartData(visibleWeekStartDate),
          selectedDailyBreakdown,
          selectedDate,
          setSelectedDate,
          weeklyStats,
        })}
      </View>
    </Screen>
  );
}

function renderReviewChartContent({
  chartData,
  errorMessage,
  loadState,
  onRetry,
  selectedDailyBreakdown,
  selectedDate,
  setSelectedDate,
  weeklyStats,
}: {
  chartData: ReviewChartData;
  errorMessage: string | null;
  loadState: ReviewChartLoadState;
  onRetry: () => void;
  selectedDailyBreakdown: ReviewChartDailyBreakdown | undefined;
  selectedDate: DateString;
  setSelectedDate: (date: DateString) => void;
  weeklyStats: ReturnType<typeof createWeeklyStats>;
}) {
  if (loadState === 'idle' || loadState === 'loading') {
    return <Text style={styles.sectionText}>회고 차트를 불러오고 있습니다.</Text>;
  }

  if (loadState === 'unconfigured') {
    return (
      <View style={styles.statusBlock}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Text style={styles.sectionText}>서버 연결 설정 후 회고 차트를 볼 수 있습니다.</Text>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.statusBlock}>
        <Text style={styles.errorText}>회고 차트 조회 실패: {errorMessage}</Text>
        <PrimaryButton label="다시 불러오기" onPress={onRetry} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={styles.chartStack}>
      <MetricCards weeklyStats={weeklyStats} />
      {chartData.groups.length === 0 ? (
        <Text style={styles.sectionText}>이 주에는 아직 기록된 시간이 없습니다.</Text>
      ) : (
        <>
          <WeeklyRatioLineChart chartData={chartData} />
          <WeekdayTabs
            days={chartData.dailyBreakdowns}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
          />
          <DailyDonutChart breakdown={selectedDailyBreakdown} />
          <WeeklyTotalsTable groups={chartData.groups} />
        </>
      )}
    </View>
  );
}

function MetricCards({ weeklyStats }: { weeklyStats: ReturnType<typeof createWeeklyStats> }) {
  return (
    <View style={styles.metricGrid}>
      <MetricCard label="총 기록" value={formatDuration(weeklyStats.recordedMinutes)} />
      <MetricCard label="미기록" value={formatDuration(weeklyStats.unrecordedMinutes)} />
      <MetricCard label="완성률" value={`${weeklyStats.completionRate}%`} />
      <MetricCard
        label="낭비한 시간"
        tone="danger"
        value={formatDuration(weeklyStats.wastedMinutes)}
      />
    </View>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: 'danger';
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === 'danger' && styles.metricValueDanger]}>
        {value}
      </Text>
    </View>
  );
}

function WeeklyRatioLineChart({ chartData }: { chartData: ReviewChartData }) {
  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>주간 색상 그룹 비율</Text>
      <Svg width="100%" height={LINE_CHART_HEIGHT} viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`}>
        {[0, 50, 100].map((ratio) => {
          const y = LINE_CHART_HEIGHT - (ratio / 100) * LINE_CHART_HEIGHT;

          return (
            <Polyline
              key={ratio}
              points={`0,${y} ${LINE_CHART_WIDTH},${y}`}
              stroke={theme.color.border}
              strokeWidth={1}
            />
          );
        })}
        {chartData.groups.map((group) => (
          <Polyline
            key={group.key}
            fill="none"
            points={group.dailyPoints
              .map((point, index) => {
                const x = (index / 6) * LINE_CHART_WIDTH;
                const y = LINE_CHART_HEIGHT - (point.ratio / 100) * LINE_CHART_HEIGHT;

                return `${x},${y}`;
              })
              .join(' ')}
            stroke={group.color}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth={3}
          />
        ))}
      </Svg>
      <View style={styles.weekdayLabels}>
        {chartData.weekDates.map((date, index) => (
          <Text key={date} style={styles.weekdayLabel}>
            {chartData.dailyBreakdowns[index]?.weekdayLabel}
          </Text>
        ))}
      </View>
      <ChartLegend groups={chartData.groups} />
    </View>
  );
}

function ChartLegend({ groups }: { groups: ReviewChartGroup[] }) {
  return (
    <View style={styles.legend}>
      {groups.map((group) => (
        <View key={group.key} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: group.color }]} />
          <Text style={styles.legendText}>{group.label}</Text>
        </View>
      ))}
    </View>
  );
}

function WeekdayTabs({
  days,
  onSelectDate,
  selectedDate,
}: {
  days: ReviewChartDailyBreakdown[];
  onSelectDate: (date: DateString) => void;
  selectedDate: DateString;
}) {
  return (
    <View style={styles.weekdayTabs}>
      {days.map((day) => {
        const isSelected = day.date === selectedDate;

        return (
          <Pressable
            accessibilityRole="button"
            key={day.date}
            onPress={() => onSelectDate(day.date)}
            style={({ pressed }) => [
              styles.weekdayTab,
              isSelected && styles.weekdayTabSelected,
              pressed && styles.weekdayTabPressed,
            ]}
          >
            <Text style={[styles.weekdayTabText, isSelected && styles.weekdayTabTextSelected]}>
              {day.weekdayLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DailyDonutChart({ breakdown }: { breakdown: ReviewChartDailyBreakdown | undefined }) {
  let accumulatedRatio = 0;
  const segments = breakdown?.segments ?? [];

  return (
    <View style={styles.dailyBreakdown}>
      <View style={styles.donutWrap}>
        <Svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
          <Circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            fill="none"
            r={DONUT_RADIUS}
            stroke={theme.color.border}
            strokeWidth={DONUT_STROKE_WIDTH}
          />
          {segments.map((segment) => {
            const dashLength = (segment.ratio / 100) * DONUT_CIRCUMFERENCE;
            const rotation = -90 + accumulatedRatio * 3.6;

            accumulatedRatio += segment.ratio;

            return (
              <Circle
                key={segment.key}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                fill="none"
                r={DONUT_RADIUS}
                stroke={segment.color}
                strokeDasharray={`${dashLength} ${DONUT_CIRCUMFERENCE - dashLength}`}
                strokeLinecap="butt"
                strokeWidth={DONUT_STROKE_WIDTH}
                transform={`rotate(${rotation} ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
              />
            );
          })}
        </Svg>
        {segments.length === 0 ? <Text style={styles.donutEmptyText}>기록 없음</Text> : null}
      </View>
      <View style={styles.segmentList}>
        {segments.length === 0 ? (
          <Text style={styles.sectionText}>선택한 요일에 기록된 시간이 없습니다.</Text>
        ) : (
          segments.map((segment) => (
            <View key={segment.key} style={styles.segmentRow}>
              <View style={[styles.swatch, { backgroundColor: segment.color }]} />
              <Text style={styles.segmentLabel}>{segment.label}</Text>
              <Text style={styles.segmentValue}>
                {formatDuration(segment.minutes)} · {segment.ratio}%
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function WeeklyTotalsTable({ groups }: { groups: ReviewChartGroup[] }) {
  return (
    <View style={styles.totalsTable}>
      {groups.map((group) => (
        <View key={group.key} style={styles.totalRow}>
          <View style={[styles.swatch, { backgroundColor: group.color }]} />
          <View style={styles.totalTextGroup}>
            <Text style={styles.totalLabel}>{group.label}</Text>
            <Text style={styles.totalCategories}>{group.categoryNames.join(', ')}</Text>
          </View>
          <Text style={styles.totalValue}>
            {formatDuration(group.totalMinutes)} · {group.ratio}% · {group.peakWeekdayLabel ?? '-'}
          </Text>
        </View>
      ))}
    </View>
  );
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

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: theme.spacing.lg,
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
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
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
    fontWeight: '600',
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
  chartStack: {
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metricCard: {
    minWidth: '47%',
    flexGrow: 1,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.md,
  },
  metricLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  metricValue: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '900',
  },
  metricValueDanger: {
    color: theme.color.danger,
  },
  chartBlock: {
    gap: theme.spacing.sm,
  },
  chartTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  weekdayLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekdayLabel: {
    width: 32,
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  weekdayTabs: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  weekdayTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
  },
  weekdayTabPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  weekdayTabSelected: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primary,
  },
  weekdayTabText: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  weekdayTabTextSelected: {
    color: theme.color.surface,
  },
  dailyBreakdown: {
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  donutWrap: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutEmptyText: {
    position: 'absolute',
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  segmentList: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  segmentLabel: {
    flex: 1,
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  segmentValue: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  totalsTable: {
    gap: theme.spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.sm,
  },
  totalTextGroup: {
    flex: 1,
    gap: 2,
  },
  totalLabel: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  totalCategories: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  totalValue: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '800',
    textAlign: 'right',
  },
});
