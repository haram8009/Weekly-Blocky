import {
  buildWeekGrid,
  getWeekStartDate,
  type DateString,
  type WeekGridBlock,
} from '@weekly/domain';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

export default function TodayScreen() {
  const todayDate = getLocalDateString();
  const todayGrid = useMemo(() => {
    const weekGrid = buildWeekGrid({ weekStartDate: getWeekStartDate(todayDate, 'monday') });
    return weekGrid.days.find((day) => day.date === todayDate) ?? weekGrid.days[0];
  }, [todayDate]);
  const hourlyRows = useMemo(() => createHourlyRows(todayGrid?.blocks ?? []), [todayGrid]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>오늘</Text>
        <Text style={styles.title}>{formatMonthDay(todayDate)} 기록</Text>
      </View>

      <View style={styles.gridHeader}>
        <Text style={styles.gridTitle}>05:00-24:00</Text>
        <Text style={styles.gridMeta}>10분 블록 {todayGrid?.blocks.length ?? 0}개</Text>
      </View>

      <View style={styles.dayGrid}>
        {hourlyRows.map((row) => (
          <View key={row.hourLabel} style={styles.hourRow}>
            <Text style={styles.timeLabel}>{row.hourLabel}</Text>
            <View style={styles.hourBlocks}>
              {row.blocks.map((block) => (
                <View key={block.id} style={styles.emptyBlock} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function createHourlyRows(
  blocks: WeekGridBlock[],
): { hourLabel: string; blocks: WeekGridBlock[] }[] {
  const blocksPerHour = 6;
  const rows: { hourLabel: string; blocks: WeekGridBlock[] }[] = [];

  for (let index = 0; index < blocks.length; index += blocksPerHour) {
    const rowBlocks = blocks.slice(index, index + blocksPerHour);
    const firstBlock = rowBlocks[0];

    if (firstBlock) {
      rows.push({
        hourLabel: firstBlock.startTime,
        blocks: rowBlocks,
      });
    }
  }

  return rows;
}

function getLocalDateString(date = new Date()): DateString {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatMonthDay(date: DateString): string {
  const [, monthText, dayText] = date.split('-');

  return `${Number(monthText)}월 ${Number(dayText)}일`;
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
  gridHeader: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  gridTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  gridMeta: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  dayGrid: {
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.sm,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeLabel: {
    width: 44,
    color: theme.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  hourBlocks: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  emptyBlock: {
    flex: 1,
    minHeight: 24,
    borderRadius: 2,
    backgroundColor: theme.color.surfaceMuted,
  },
});
