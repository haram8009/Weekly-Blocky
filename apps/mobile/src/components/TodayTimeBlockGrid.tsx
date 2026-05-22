import {
  createDisplayTimeEntry,
  type Category,
  type PhotoReference,
  type TimeString,
  type TimeEntry,
  type WeekGridBlock,
  type WeekGridTimeRangeSelection,
} from '@weekly/domain';
import { type MutableRefObject, type RefObject } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';

import { theme } from '@/theme';

const BLOCK_ROW_GAP = theme.spacing.xs;
const BLOCK_COLUMN_GAP = 2;
const BLOCK_MIN_HEIGHT = 30;
const NEXT_DAY_DIVIDER_HEIGHT = 18;

export type TodayHourRow = {
  key: string;
  hourLabel: string;
  nextDayDividerLabel?: string;
  blocks: WeekGridBlock[];
};

type TodayTimeBlockGridProps = {
  hourlyRows: readonly TodayHourRow[];
  entries: readonly TimeEntry[];
  visibleStartTime: TimeString;
  visibleEndTime: TimeString;
  categoryById: ReadonlyMap<string, Category>;
  displayedSelection: WeekGridTimeRangeSelection | null;
  photoReferencesByEntryId: ReadonlyMap<string, readonly PhotoReference[]>;
  selectedBlockPulseStyle: {
    opacity: Animated.AnimatedInterpolation<string | number>;
    transform: { scale: Animated.AnimatedInterpolation<string | number> }[];
  };
  blockMatrixRef: RefObject<View | null>;
  tappedSlotIndexRef: MutableRefObject<number | null>;
  panHandlers: PanResponderInstance['panHandlers'];
  onLayout: (event: LayoutChangeEvent) => void;
  onTouchCancel: () => void;
  onTouchEnd: (event: GestureResponderEvent) => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchStart: (event: GestureResponderEvent) => void;
};

export function TodayTimeBlockGrid({
  hourlyRows,
  entries,
  visibleStartTime,
  visibleEndTime,
  categoryById,
  displayedSelection,
  photoReferencesByEntryId,
  selectedBlockPulseStyle,
  blockMatrixRef,
  tappedSlotIndexRef,
  panHandlers,
  onLayout,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
}: TodayTimeBlockGridProps) {
  const nextDayDividers = hourlyRows.flatMap((row, index) =>
    row.nextDayDividerLabel
      ? [
          {
            key: `${row.key}:next-day`,
            label: row.nextDayDividerLabel,
            top:
              index * (BLOCK_MIN_HEIGHT + BLOCK_ROW_GAP) -
              BLOCK_ROW_GAP / 2 -
              NEXT_DAY_DIVIDER_HEIGHT / 2,
          },
        ]
      : [],
  );

  return (
    <View style={styles.dayGrid}>
      <View style={styles.gridBody}>
        <View style={styles.timeLabelColumn}>
          {hourlyRows.map((row) => (
            <Text key={row.key} style={styles.timeLabel}>
              {row.hourLabel}
            </Text>
          ))}
        </View>
        <View
          ref={blockMatrixRef}
          style={styles.blockMatrix}
          onLayout={onLayout}
          onTouchCancel={onTouchCancel}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchMove}
          onTouchStart={onTouchStart}
          {...panHandlers}
        >
          {hourlyRows.map((row) => (
            <View key={row.key} style={styles.hourBlocks}>
              {row.blocks.map((block) => {
                const blockEntryMatch = getEntryCoveringBlock(
                  block,
                  entries,
                  visibleStartTime,
                  visibleEndTime,
                );
                const blockEntry = blockEntryMatch?.entry ?? null;
                const blockCategory = blockEntry ? categoryById.get(blockEntry.categoryId) : null;
                const isSelected = isBlockSelected(block.slotIndex, displayedSelection);
                const blockPhotoReferences =
                  blockEntry && block.startTime === blockEntryMatch?.displayStartTime
                    ? (photoReferencesByEntryId.get(blockEntry.id) ?? [])
                    : [];

                return (
                  <View
                    key={block.id}
                    onTouchStart={() => {
                      tappedSlotIndexRef.current = block.slotIndex;
                    }}
                    style={styles.blockContainer}
                  >
                    <Animated.View
                      style={[
                        styles.emptyBlock,
                        blockCategory && {
                          backgroundColor: blockCategory.color,
                          borderColor: blockCategory.color,
                        },
                        isSelected && styles.selectedBlock,
                        isSelected && selectedBlockPulseStyle,
                      ]}
                    >
                      <BlockPhotoIndicator references={blockPhotoReferences} />
                    </Animated.View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        {nextDayDividers.map((divider) => (
          <View
            key={divider.key}
            pointerEvents="none"
            style={[styles.nextDayDivider, { top: divider.top }]}
          >
            <View style={styles.nextDayDividerLine} />
            <Text style={styles.nextDayDividerText}>{divider.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BlockPhotoIndicator({ references }: { references: readonly PhotoReference[] }) {
  if (references.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.blockPhotoIndicator}>
      <Text style={styles.blockPhotoIndicatorText}>
        {references.length > 9 ? '9+' : String(references.length)}
      </Text>
    </View>
  );
}

function getEntryCoveringBlock(
  block: WeekGridBlock,
  entries: readonly TimeEntry[],
  visibleStartTime: TimeString,
  visibleEndTime: TimeString,
): { entry: TimeEntry; displayStartTime: TimeString } | null {
  return (
    entries.flatMap((entry) => {
      if (entry.deletedAt) {
        return [];
      }

      const displayEntry = createDisplayTimeEntry({
        entry,
        visibleStartTime,
        visibleEndTime,
      });

      return displayEntry.displayDate === block.date &&
        displayEntry.displayStartTime <= block.startTime &&
        displayEntry.displayEndTime >= block.endTime
        ? [{ entry, displayStartTime: displayEntry.displayStartTime }]
        : [];
    })[0] ?? null
  );
}

function isBlockSelected(slotIndex: number, selection: WeekGridTimeRangeSelection | null): boolean {
  return (
    selection !== null &&
    slotIndex >= selection.startSlotIndex &&
    slotIndex <= selection.endSlotIndex
  );
}

const styles = StyleSheet.create({
  dayGrid: {
    marginBottom: theme.spacing.xl,
  },
  gridBody: {
    position: 'relative',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timeLabelColumn: {
    gap: theme.spacing.xs,
  },
  timeLabel: {
    width: 44,
    minHeight: BLOCK_MIN_HEIGHT,
    color: theme.color.textMuted,
    fontSize: 11,
    lineHeight: BLOCK_MIN_HEIGHT,
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
    minHeight: BLOCK_MIN_HEIGHT,
  },
  emptyBlock: {
    flex: 1,
    minHeight: BLOCK_MIN_HEIGHT,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 3,
    backgroundColor: '#F4F4F5',
    overflow: 'hidden',
  },
  blockPhotoIndicator: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 3,
  },
  blockPhotoIndicatorText: {
    color: theme.color.text,
    fontSize: 8,
    fontWeight: '600',
    lineHeight: 10,
  },
  selectedBlock: {
    backgroundColor: theme.color.accent,
    borderWidth: 1,
    borderColor: theme.color.primary,
  },
  nextDayDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    height: NEXT_DAY_DIVIDER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextDayDividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: NEXT_DAY_DIVIDER_HEIGHT / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.color.border,
  },
  nextDayDividerText: {
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.color.background,
    color: theme.color.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
});
