import {
  buildWeekGrid,
  createWeekGridTimeRangeSelection,
  EXAMPLE_CATEGORY_DEFINITIONS,
  getWeekStartDate,
  type DateString,
  type WeekGridBlock,
  type WeekGridTimeRangeSelection,
} from '@weekly/domain';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
const LONG_PRESS_SELECTION_DELAY_MS = 300;
const LONG_PRESS_MOVE_TOLERANCE = 8;
const EDGE_AUTO_SCROLL_THRESHOLD = 80;
const EDGE_AUTO_SCROLL_MAX_STEP = 12;

type SelectionDraft = {
  anchorSlotIndex: number;
  focusSlotIndex: number;
};

export default function TodayScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const scrollViewRef = useRef<ScrollView>(null);
  const blockMatrixRef = useRef<View>(null);
  const blockGridBoundsRef = useRef<WeekGridSlotBounds | null>(null);
  const selectionDraftRef = useRef<SelectionDraft | null>(null);
  const selectionStartPointRef = useRef<WeekGridSlotPoint | null>(null);
  const latestTouchPointRef = useRef<WeekGridSlotPoint | null>(null);
  const isSelectionGestureActiveRef = useRef(false);
  const isTouchActiveRef = useRef(false);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollStepRef = useRef(0);
  const scrollOffsetYRef = useRef(0);
  const selectionPulseValue = useRef(new Animated.Value(0)).current;
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const draftSelection = useMemo(
    () => createSelectedRange(blocks, selectionDraft),
    [blocks, selectionDraft],
  );
  const displayedSelection = draftSelection ?? confirmedSelection;
  const selectedBlockPulseStyle = useMemo(
    () => ({
      opacity: selectionPulseValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.88],
      }),
      transform: [
        {
          scale: selectionPulseValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.06],
          }),
        },
      ],
    }),
    [selectionPulseValue],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => isSelectionGestureActiveRef.current,
        onMoveShouldSetPanResponderCapture: () => isSelectionGestureActiveRef.current,
        onPanResponderMove: handleSelectionMove,
        onPanResponderRelease: handleSelectionRelease,
        onPanResponderTerminate: handleSelectionCancel,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => isSelectionGestureActiveRef.current,
        onStartShouldSetPanResponder: () => false,
      }),
    [blocks],
  );

  useEffect(
    () => () => {
      clearLongPressTimer();
      stopAutoScroll();
      selectionPulseValue.stopAnimation();
    },
    [selectionPulseValue],
  );

  function handleBlockGridLayout() {
    measureBlockGridBounds();
  }

  function handleBlockGridTouchStart(event: GestureResponderEvent) {
    const point = getPagePointFromGesture(event);

    clearLongPressTimer();
    stopAutoScroll();
    isTouchActiveRef.current = true;
    selectionStartPointRef.current = point;
    latestTouchPointRef.current = point;
    longPressTimeoutRef.current = setTimeout(
      activateSelectionFromLongPress,
      LONG_PRESS_SELECTION_DELAY_MS,
    );
  }

  function handleBlockGridTouchMove(event: GestureResponderEvent) {
    handleSelectionMoveToPoint(getPagePointFromGesture(event));
  }

  function handleSelectionMove(
    event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) {
    handleSelectionMoveToPoint(getPagePointFromGesture(event, gestureState));
  }

  function handleSelectionMoveToPoint(point: WeekGridSlotPoint) {
    latestTouchPointRef.current = point;

    if (!isSelectionGestureActiveRef.current) {
      cancelLongPressIfMovedTooFar(point);
      return;
    }

    const bounds = blockGridBoundsRef.current;

    if (bounds) {
      updateSelectionFocusFromPoint(point, bounds);
    }

    updateAutoScroll(point);
  }

  function handleBlockGridTouchEnd(event: GestureResponderEvent) {
    finishSelectionAtPoint(getPagePointFromGesture(event));
  }

  function handleSelectionRelease(
    event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) {
    finishSelectionAtPoint(getPagePointFromGesture(event, gestureState));
  }

  function finishSelectionAtPoint(releasePoint: WeekGridSlotPoint) {
    clearLongPressTimer();
    isTouchActiveRef.current = false;

    if (!isSelectionGestureActiveRef.current) {
      resetSelectionGesture();
      return;
    }

    const bounds = blockGridBoundsRef.current;

    isSelectionGestureActiveRef.current = false;
    setIsSelectionMode(false);
    stopAutoScroll();

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

  function activateSelectionFromLongPress() {
    clearLongPressTimer();

    if (!isTouchActiveRef.current || isSelectionGestureActiveRef.current) {
      return;
    }

    const startPoint = selectionStartPointRef.current;

    if (!startPoint) {
      return;
    }

    measureBlockGridBounds((bounds) => {
      if (!isTouchActiveRef.current || isSelectionGestureActiveRef.current) {
        return;
      }

      isSelectionGestureActiveRef.current = true;
      setIsSelectionMode(true);
      triggerSelectionFeedback();
      startSelectionAtPoint(startPoint, bounds);

      if (latestTouchPointRef.current) {
        updateSelectionFocusFromPoint(latestTouchPointRef.current, bounds);
        updateAutoScroll(latestTouchPointRef.current);
      }
    });
  }

  function triggerSelectionFeedback() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    selectionPulseValue.stopAnimation();
    selectionPulseValue.setValue(0);
    Animated.sequence([
      Animated.timing(selectionPulseValue, {
        duration: 120,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(selectionPulseValue, {
        duration: 140,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function finishSelection() {
    const range = createSelectedRange(blocks, selectionDraftRef.current);
    if (range) {
      setConfirmedSelection(range);
    }

    resetSelectionGesture();
  }

  function handleSelectionCancel() {
    resetSelectionGesture();
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

  function handleScreenScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
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

  function cancelLongPressIfMovedTooFar(point: WeekGridSlotPoint) {
    const startPoint = selectionStartPointRef.current;

    if (!startPoint) {
      return;
    }

    if (getPointDistance(startPoint, point) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }
  }

  function clearLongPressTimer() {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function updateAutoScroll(point: WeekGridSlotPoint) {
    autoScrollStepRef.current = getAutoScrollStep(point);

    if (autoScrollStepRef.current === 0) {
      stopAutoScroll();
      return;
    }

    startAutoScroll();
  }

  function startAutoScroll() {
    if (autoScrollFrameRef.current !== null) {
      return;
    }

    const tick = () => {
      if (!isSelectionGestureActiveRef.current || autoScrollStepRef.current === 0) {
        autoScrollFrameRef.current = null;
        return;
      }

      const nextOffsetY = Math.max(0, scrollOffsetYRef.current + autoScrollStepRef.current);
      scrollOffsetYRef.current = nextOffsetY;
      scrollViewRef.current?.scrollTo({ animated: false, y: nextOffsetY });
      measureBlockGridBounds((bounds) => {
        if (isSelectionGestureActiveRef.current && latestTouchPointRef.current) {
          updateSelectionFocusFromPoint(latestTouchPointRef.current, bounds);
        }
      });

      autoScrollFrameRef.current = requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = requestAnimationFrame(tick);
  }

  function stopAutoScroll() {
    autoScrollStepRef.current = 0;

    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function getAutoScrollStep(point: WeekGridSlotPoint): number {
    const distanceFromTop = point.pageY;
    const distanceFromBottom = windowHeightRef.current - point.pageY;

    if (distanceFromTop < EDGE_AUTO_SCROLL_THRESHOLD) {
      return -getAutoScrollSpeed(EDGE_AUTO_SCROLL_THRESHOLD - distanceFromTop);
    }

    if (distanceFromBottom < EDGE_AUTO_SCROLL_THRESHOLD) {
      return getAutoScrollSpeed(EDGE_AUTO_SCROLL_THRESHOLD - distanceFromBottom);
    }

    return 0;
  }

  function resetSelectionGesture() {
    clearLongPressTimer();
    stopAutoScroll();
    isSelectionGestureActiveRef.current = false;
    isTouchActiveRef.current = false;
    selectionStartPointRef.current = null;
    latestTouchPointRef.current = null;
    setIsSelectionMode(false);
    applySelectionDraft(null);
  }

  return (
    <Screen
      onScroll={handleScreenScroll}
      scrollEnabled={!isSelectionMode}
      scrollEventThrottle={16}
      scrollViewRef={scrollViewRef}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>오늘</Text>
        <Text style={styles.title}>{formatMonthDay(todayDate)} 기록</Text>
      </View>

      <View style={styles.gridHeader}>
        <Text style={styles.gridTitle}>05:00-24:00</Text>
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
            onTouchCancel={handleSelectionCancel}
            onTouchEnd={handleBlockGridTouchEnd}
            onTouchMove={handleBlockGridTouchMove}
            onTouchStart={handleBlockGridTouchStart}
            {...panResponder.panHandlers}
          >
            {hourlyRows.map((row) => (
              <View key={row.hourLabel} style={styles.hourBlocks}>
                {row.blocks.map((block) => (
                  <View key={block.id} style={styles.blockContainer}>
                    <Animated.View
                      style={[
                        styles.emptyBlock,
                        isBlockSelected(block.slotIndex, displayedSelection) &&
                          styles.selectedBlock,
                        isBlockSelected(block.slotIndex, displayedSelection) &&
                          selectedBlockPulseStyle,
                      ]}
                    />
                  </View>
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

function getPointDistance(firstPoint: WeekGridSlotPoint, secondPoint: WeekGridSlotPoint): number {
  return Math.hypot(firstPoint.pageX - secondPoint.pageX, firstPoint.pageY - secondPoint.pageY);
}

function getAutoScrollSpeed(distanceIntoEdge: number): number {
  const ratio = Math.min(Math.max(distanceIntoEdge / EDGE_AUTO_SCROLL_THRESHOLD, 0), 1);

  return Math.ceil(ratio * EDGE_AUTO_SCROLL_MAX_STEP);
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
  blockContainer: {
    flex: 1,
    minHeight: 24,
  },
  emptyBlock: {
    flex: 1,
    minHeight: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 2,
    backgroundColor: theme.color.surfaceMuted,
  },
  selectedBlock: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.primary,
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
