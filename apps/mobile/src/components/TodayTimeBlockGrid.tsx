import {
  type Category,
  type PhotoReference,
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

export type TodayHourRow = {
  hourLabel: string;
  blocks: WeekGridBlock[];
};

type TodayTimeBlockGridProps = {
  hourlyRows: readonly TodayHourRow[];
  entries: readonly TimeEntry[];
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
  return (
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
          onLayout={onLayout}
          onTouchCancel={onTouchCancel}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchMove}
          onTouchStart={onTouchStart}
          {...panHandlers}
        >
          {hourlyRows.map((row) => (
            <View key={row.hourLabel} style={styles.hourBlocks}>
              {row.blocks.map((block) => {
                const blockEntry = getEntryCoveringBlock(block, entries);
                const blockCategory = blockEntry ? categoryById.get(blockEntry.categoryId) : null;
                const isSelected = isBlockSelected(block.slotIndex, displayedSelection);
                const blockPhotoReferences =
                  blockEntry && block.startTime === blockEntry.startTime
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
): TimeEntry | null {
  return (
    entries.find(
      (entry) =>
        !entry.deletedAt && entry.startTime <= block.startTime && entry.endTime >= block.endTime,
    ) ?? null
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
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timeLabelColumn: {
    gap: theme.spacing.xs,
  },
  timeLabel: {
    width: 44,
    minHeight: 30,
    color: theme.color.textMuted,
    fontSize: 11,
    lineHeight: 30,
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
    minHeight: 30,
  },
  emptyBlock: {
    flex: 1,
    minHeight: 30,
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
});
