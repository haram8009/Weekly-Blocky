import { EXAMPLE_CATEGORY_DEFINITIONS } from '@weekly/domain';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '@/theme';
import { type EntrySaveState } from '@/todayScreenTypes';

type CategoryPaletteItem = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

type TimeRangeCategoryDrawerProps = {
  visible: boolean;
  selectedRangeLabel: string | null;
  timeInputStart: string;
  timeInputEnd: string;
  timeInputError: string | null;
  categoryPaletteItems: readonly CategoryPaletteItem[];
  canApplySelectedRange: boolean;
  canMoveSelectionStartEarlier: boolean;
  canMoveSelectionStartLater: boolean;
  canMoveSelectionEndEarlier: boolean;
  canMoveSelectionEndLater: boolean;
  entrySaveState: EntrySaveState;
  entrySaveErrorMessage: string | null;
  onClose: () => void;
  onAdjustSelection: (edge: 'start' | 'end', deltaSlots: number) => void;
  onUpdateTimeInput: (nextStartTime: string, nextEndTime: string) => void;
  onApplyCategory: (categoryId: string) => Promise<void>;
};

export function TimeRangeCategoryDrawer({
  visible,
  selectedRangeLabel,
  timeInputStart,
  timeInputEnd,
  timeInputError,
  categoryPaletteItems,
  canApplySelectedRange,
  canMoveSelectionStartEarlier,
  canMoveSelectionStartLater,
  canMoveSelectionEndEarlier,
  canMoveSelectionEndLater,
  entrySaveState,
  entrySaveErrorMessage,
  onClose,
  onAdjustSelection,
  onUpdateTimeInput,
  onApplyCategory,
}: TimeRangeCategoryDrawerProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.drawerOverlay}>
        <Pressable style={styles.drawerBackdrop} onPress={onClose} />
        <View style={styles.categoryDrawer}>
          <ScrollView
            contentContainerStyle={styles.categoryDrawerContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.drawerHandle} />
            <View style={styles.categoryPaletteHeader}>
              <View>
                <Text style={styles.categoryPaletteTitle}>카테고리</Text>
                {selectedRangeLabel ? (
                  <Text style={styles.categoryPaletteRange}>{selectedRangeLabel}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.timeRangeEditor}>
              <View style={styles.rangeStepperGrid}>
                <RangeStepperButton
                  disabled={!canMoveSelectionStartEarlier}
                  label="시작 -10분"
                  onPress={() => onAdjustSelection('start', -1)}
                />
                <RangeStepperButton
                  disabled={!canMoveSelectionStartLater}
                  label="시작 +10분"
                  onPress={() => onAdjustSelection('start', 1)}
                />
                <RangeStepperButton
                  disabled={!canMoveSelectionEndEarlier}
                  label="종료 -10분"
                  onPress={() => onAdjustSelection('end', -1)}
                />
                <RangeStepperButton
                  disabled={!canMoveSelectionEndLater}
                  label="종료 +10분"
                  onPress={() => onAdjustSelection('end', 1)}
                />
              </View>

              <View style={styles.timeInputRow}>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.timeInputLabel}>시작</Text>
                  <TextInput
                    accessibilityLabel="시작 시간 직접 입력"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    onChangeText={(nextStartTime) => onUpdateTimeInput(nextStartTime, timeInputEnd)}
                    placeholder="HH:mm"
                    style={[styles.timeInput, timeInputError && styles.timeInputInvalid]}
                    value={timeInputStart}
                  />
                </View>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.timeInputLabel}>종료</Text>
                  <TextInput
                    accessibilityLabel="종료 시간 직접 입력"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    onChangeText={(nextEndTime) => onUpdateTimeInput(timeInputStart, nextEndTime)}
                    placeholder="HH:mm"
                    style={[styles.timeInput, timeInputError && styles.timeInputInvalid]}
                    value={timeInputEnd}
                  />
                </View>
              </View>
              {timeInputError ? <Text style={styles.timeInputError}>{timeInputError}</Text> : null}
            </View>

            <View style={styles.categoryButtonList}>
              {categoryPaletteItems.length === 0 ? (
                <View style={styles.categoryEmptyState}>
                  <Text style={styles.categoryEmptyTitle}>저장된 카테고리가 없습니다.</Text>
                  <Text style={styles.categoryEmptyDescription}>
                    예시:{' '}
                    {EXAMPLE_CATEGORY_DEFINITIONS.slice(0, 4)
                      .map((category) => `${category.emoji} ${category.name}`)
                      .join(', ')}
                  </Text>
                </View>
              ) : (
                categoryPaletteItems.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canApplySelectedRange }}
                    disabled={!canApplySelectedRange}
                    onPress={() => void onApplyCategory(category.id)}
                    style={({ pressed }) => [
                      styles.categoryButton,
                      {
                        backgroundColor: category.color,
                        borderColor: category.color,
                      },
                      !canApplySelectedRange && styles.categoryButtonDisabled,
                      pressed && canApplySelectedRange && styles.categoryButtonPressed,
                    ]}
                  >
                    <Text style={styles.categoryButtonText}>
                      {category.emoji} {category.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
            {entrySaveState === 'saving' ? (
              <Text style={styles.categorySaveStatus}>기록을 저장하고 있습니다.</Text>
            ) : null}
            {entrySaveErrorMessage ? (
              <Text style={styles.categorySaveError}>{entrySaveErrorMessage}</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RangeStepperButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rangeStepperButton,
        disabled && styles.rangeStepperButtonDisabled,
        pressed && !disabled && styles.rangeStepperButtonPressed,
      ]}
    >
      <Text
        style={[styles.rangeStepperButtonText, disabled && styles.rangeStepperButtonTextDisabled]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  drawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  categoryDrawer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: theme.color.surface,
    maxHeight: '92%',
  },
  categoryDrawerContent: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.color.border,
    marginBottom: theme.spacing.sm,
  },
  categoryPaletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPaletteTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  categoryPaletteRange: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    marginTop: theme.spacing.xs,
  },
  timeRangeEditor: {
    gap: theme.spacing.md,
  },
  rangeStepperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  rangeStepperButton: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
  },
  rangeStepperButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  rangeStepperButtonDisabled: {
    backgroundColor: theme.color.surface,
    opacity: 0.62,
  },
  rangeStepperButtonText: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    textAlign: 'center',
  },
  rangeStepperButtonTextDisabled: {
    color: theme.color.textMuted,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timeInputGroup: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  timeInputLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  timeInput: {
    minHeight: 44,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 0,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '500',
    paddingHorizontal: 0,
  },
  timeInputInvalid: {
    borderColor: theme.color.danger,
  },
  timeInputError: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  categoryButtonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryEmptyState: {
    width: '100%',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
  categoryEmptyTitle: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  categoryEmptyDescription: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  categoryButton: {
    minHeight: 42,
    minWidth: 96,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
  },
  categoryButtonPressed: {
    opacity: 0.82,
  },
  categoryButtonDisabled: {
    opacity: 0.42,
  },
  categoryButtonText: {
    color: theme.color.surface,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  categorySaveStatus: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  categorySaveError: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
