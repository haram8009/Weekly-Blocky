import {
  buildWeekGrid,
  createWeekGridTimeRangeSelection,
  EXAMPLE_CATEGORY_DEFINITIONS,
  getWeekStartDate,
  type DateString,
  type WeekGridBlock,
  type WeekGridTimeRangeSelection,
} from '@weekly/domain';
import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { Screen } from '@/components/Screen';
import { theme } from '@/theme';
import {
  getWeekGridSlotIndexFromPoint,
  type WeekGridSlotBounds,
  type WeekGridSlotPoint,
} from '@/todayGridSelection';

const BLOCKS_PER_HOUR = 6;
const BLOCK_ROW_GAP = theme.spacing.xs;
const BLOCK_COLUMN_GAP = 2;

type SelectionDraft = {
  anchorSlotIndex: number;
  focusSlotIndex: number;
};

export default function TodayScreen() {
  const blockMatrixRef = useRef<View>(null);
  const blockGridBoundsRef = useRef<WeekGridSlotBounds | null>(null);
  const selectionDraftRef = useRef<SelectionDraft | null>(null);
  const selectionStartPointRef = useRef<WeekGridSlotPoint | null>(null);
  const isSelectionGestureActiveRef = useRef(false);
  const todayDate = getLocalDateString();
  const todayGrid = useMemo(() => {
    const weekGrid = buildWeekGrid({ weekStartDate: getWeekStartDate(todayDate, 'monday') });
    return weekGrid.days.find((day) => day.date === todayDate) ?? weekGrid.days[0];
  }, [todayDate]);
  const blocks = todayGrid?.blocks ?? [];
  const hourlyRows = useMemo(() => createHourlyRows(blocks), [blocks]);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [confirmedSelection, setConfirmedSelection] = useState<WeekGridTimeRangeSelection | null>(
    null,
  );
  const draftSelection = useMemo(
    () => createSelectedRange(blocks, selectionDraft),
    [blocks, selectionDraft],
  );
  const displayedSelection = draftSelection ?? confirmedSelection;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: handleSelectionStart,
        onPanResponderMove: handleSelectionMove,
        onPanResponderRelease: handleSelectionEnd,
        onPanResponderTerminate: handleSelectionCancel,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onStartShouldSetPanResponder: () => true,
      }),
    [blocks],
  );

  function handleBlockGridLayout() {
    measureBlockGridBounds();
  }

  function handleSelectionStart(event: GestureResponderEvent) {
    const point = getPagePointFromGesture(event);

    selectionStartPointRef.current = point;
    isSelectionGestureActiveRef.current = true;
    measureBlockGridBounds((bounds) => {
      if (isSelectionGestureActiveRef.current) {
        startSelectionAtPoint(point, bounds);
      }
    });
  }

  function handleSelectionMove(
    event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) {
    const bounds = blockGridBoundsRef.current;

    if (isSelectionGestureActiveRef.current && bounds) {
      updateSelectionFocusFromPoint(getPagePointFromGesture(event, gestureState), bounds);
    }
  }

  function handleSelectionEnd(
    event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) {
    const releasePoint = getPagePointFromGesture(event, gestureState);
    const bounds = blockGridBoundsRef.current;

    isSelectionGestureActiveRef.current = false;

    if (bounds && selectionDraftRef.current) {
      updateSelectionFocusFromPoint(releasePoint, bounds);
      finishSelection();
      return;
    }

    measureBlockGridBounds((measuredBounds) => {
      startSelectionAtPoint(selectionStartPointRef.current ?? releasePoint, measuredBounds);
      updateSelectionFocusFromPoint(releasePoint, measuredBounds);
      finishSelection();
    });
  }

  function finishSelection() {
    const range = createSelectedRange(blocks, selectionDraftRef.current);
    if (range) {
      setConfirmedSelection(range);
    }

    selectionStartPointRef.current = null;
    applySelectionDraft(null);
  }

  function handleSelectionCancel() {
    isSelectionGestureActiveRef.current = false;
    selectionStartPointRef.current = null;
    applySelectionDraft(null);
  }

  function clearConfirmedSelection() {
    setConfirmedSelection(null);
  }

  function measureBlockGridBounds(onMeasured?: (bounds: WeekGridSlotBounds) => void) {
    blockMatrixRef.current?.measureInWindow((pageX, pageY, width, height) => {
      const bounds = { pageX, pageY, width, height };
      blockGridBoundsRef.current = bounds;
      onMeasured?.(bounds);
    });
  }

  function startSelectionAtPoint(point: WeekGridSlotPoint, bounds: WeekGridSlotBounds) {
    const slotIndex = getSlotIndexFromPoint(point, bounds);

    if (slotIndex === null) {
      return;
    }

    setConfirmedSelection(null);
    applySelectionDraft({
      anchorSlotIndex: slotIndex,
      focusSlotIndex: slotIndex,
    });
  }

  function updateSelectionFocusFromPoint(point: WeekGridSlotPoint, bounds: WeekGridSlotBounds) {
    const slotIndex = getSlotIndexFromPoint(point, bounds);

    if (slotIndex === null) {
      return;
    }

    const currentSelectionDraft = selectionDraftRef.current;
    applySelectionDraft(
      currentSelectionDraft
        ? {
            ...currentSelectionDraft,
            focusSlotIndex: slotIndex,
          }
        : {
            anchorSlotIndex: slotIndex,
            focusSlotIndex: slotIndex,
          },
    );
  }

  function getSlotIndexFromPoint(
    point: WeekGridSlotPoint,
    bounds: WeekGridSlotBounds,
  ): number | null {
    return getWeekGridSlotIndexFromPoint({
      blockCount: blocks.length,
      blocksPerRow: BLOCKS_PER_HOUR,
      bounds,
      columnGap: BLOCK_COLUMN_GAP,
      point,
      rowGap: BLOCK_ROW_GAP,
    });
  }

  function applySelectionDraft(nextSelectionDraft: SelectionDraft | null) {
    selectionDraftRef.current = nextSelectionDraft;
    setSelectionDraft(nextSelectionDraft);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>오늘</Text>
        <Text style={styles.title}>{formatMonthDay(todayDate)} 기록</Text>
      </View>

      <View style={styles.gridHeader}>
        <Text style={styles.gridTitle}>05:00-24:00</Text>
        <Text style={styles.gridMeta}>10분 블록 {todayGrid?.blocks.length ?? 0}개</Text>
        {displayedSelection ? (
          <Text style={styles.selectionText}>
            선택 {displayedSelection.startTime}-{displayedSelection.endTime}
          </Text>
        ) : null}
      </View>

      <View style={styles.dayGrid}>
        <View style={styles.gridBody}>
          <View style={styles.timeLabelColumn}>
            {hourlyRows.map((row) => (
              <Text key={row.hourLabel} style={styles.timeLabel}>
                {row.hourLabel}
              </Text>
            ))}
          </View>
          <View
            ref={blockMatrixRef}
            style={styles.blockMatrix}
            onLayout={handleBlockGridLayout}
            {...panResponder.panHandlers}
          >
            {hourlyRows.map((row) => (
              <View key={row.hourLabel} style={styles.hourBlocks}>
                {row.blocks.map((block) => (
                  <View
                    key={block.id}
                    style={[
                      styles.emptyBlock,
                      isBlockSelected(block.slotIndex, displayedSelection) && styles.selectedBlock,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={clearConfirmedSelection}
        transparent
        visible={confirmedSelection !== null}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={clearConfirmedSelection} />
          <View style={styles.categoryDrawer}>
            <View style={styles.categoryPaletteHeader}>
              <View>
                <Text style={styles.categoryPaletteTitle}>카테고리</Text>
                {confirmedSelection ? (
                  <Text style={styles.categoryPaletteRange}>
                    {confirmedSelection.startTime}-{confirmedSelection.endTime}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.categoryButtonList}>
              {EXAMPLE_CATEGORY_DEFINITIONS.map((category) => (
                <Pressable
                  key={category.key}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.categoryButton,
                    {
                      backgroundColor: category.color,
                      borderColor: category.color,
                    },
                    pressed && styles.categoryButtonPressed,
                  ]}
                >
                  <Text style={styles.categoryButtonText}>
                    {category.emoji} {category.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function createSelectedRange(
  blocks: WeekGridBlock[],
  selectionDraft: SelectionDraft | null,
): WeekGridTimeRangeSelection | null {
  if (!selectionDraft) {
    return null;
  }

  return createWeekGridTimeRangeSelection(
    blocks,
    selectionDraft.anchorSlotIndex,
    selectionDraft.focusSlotIndex,
  );
}

function getPagePointFromGesture(
  event: GestureResponderEvent,
  gestureState?: PanResponderGestureState,
): WeekGridSlotPoint {
  if (
    gestureState &&
    Number.isFinite(gestureState.moveX) &&
    Number.isFinite(gestureState.moveY) &&
    (gestureState.moveX !== 0 || gestureState.moveY !== 0)
  ) {
    return {
      pageX: gestureState.moveX,
      pageY: gestureState.moveY,
    };
  }

  return {
    pageX: event.nativeEvent.pageX,
    pageY: event.nativeEvent.pageY,
  };
}

function isBlockSelected(
  slotIndex: number,
  selectedRange: WeekGridTimeRangeSelection | null,
): boolean {
  return (
    selectedRange !== null &&
    slotIndex >= selectedRange.startSlotIndex &&
    slotIndex <= selectedRange.endSlotIndex
  );
}

function createHourlyRows(
  blocks: WeekGridBlock[],
): { hourLabel: string; blocks: WeekGridBlock[] }[] {
  const rows: { hourLabel: string; blocks: WeekGridBlock[] }[] = [];

  for (let index = 0; index < blocks.length; index += BLOCKS_PER_HOUR) {
    const rowBlocks = blocks.slice(index, index + BLOCKS_PER_HOUR);
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
  selectionText: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '800',
    lineHeight: 20,
  },
  dayGrid: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.sm,
  },
  gridBody: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timeLabelColumn: {
    gap: theme.spacing.xs,
  },
  timeLabel: {
    width: 44,
    minHeight: 24,
    color: theme.color.textMuted,
    fontSize: 11,
    lineHeight: 24,
  },
  blockMatrix: {
    flex: 1,
    gap: BLOCK_ROW_GAP,
  },
  hourBlocks: {
    flexDirection: 'row',
    gap: BLOCK_COLUMN_GAP,
  },
  emptyBlock: {
    flex: 1,
    minHeight: 24,
    borderRadius: 2,
    backgroundColor: theme.color.surfaceMuted,
  },
  selectedBlock: {
    backgroundColor: theme.color.accent,
  },
  drawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 33, 27, 0.18)',
  },
  categoryDrawer: {
    gap: theme.spacing.md,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  categoryPaletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPaletteTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  categoryPaletteRange: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    marginTop: theme.spacing.xs,
  },
  categoryButtonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
  },
  categoryButtonPressed: {
    opacity: 0.82,
  },
  categoryButtonText: {
    color: theme.color.surface,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
});
