import { type DateString, type PhotoReference } from '@weekly/domain';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntryPhotoReferenceList } from '@/components/EntryPhotoReferenceList';
import { TimeSelectField } from '@/components/TimeSelectField';
import { createDiaryTimeOptions } from '@/components/TimeSelectOptions';
import { theme } from '@/theme';
import {
  type DayPhotosLoadState,
  type EntryEditDraft,
  type EntryEditSaveState,
  type PhotoReferenceActionState,
} from '@/todayScreenTypes';

type CategoryPaletteItem = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

const DIARY_TIME_OPTIONS = createDiaryTimeOptions();
const DIARY_START_TIME_OPTIONS = DIARY_TIME_OPTIONS.slice(0, -1);
const DIARY_END_TIME_OPTIONS = DIARY_TIME_OPTIONS.slice(1);

type EntryEditorDrawerProps = {
  selectedDate: DateString;
  draft: EntryEditDraft | null;
  categoryPaletteItems: readonly CategoryPaletteItem[];
  editValidationErrorMessage: string | null;
  editSaveErrorMessage: string | null;
  editSaveState: EntryEditSaveState;
  canSaveEditedEntry: boolean;
  canDeleteEditedEntry: boolean;
  isDeleteConfirmVisible: boolean;
  dayPhotosLoadState: DayPhotosLoadState;
  dayPhotoCount: number;
  dayPhotosPermissionScope: string | null;
  dayPhotosErrorMessage: string | null;
  editingEntryPhotoReferences: readonly PhotoReference[];
  photoReferenceActionState: PhotoReferenceActionState;
  photoReferenceActionErrorMessage: string | null;
  onClose: () => void;
  onUpdateDraft: (patch: Partial<Omit<EntryEditDraft, 'id'>>) => void;
  onHidePhoto: (photoId: string) => Promise<void>;
  onUnlinkPhoto: (photoId: string) => Promise<void>;
  onShowDeleteConfirm: () => void;
  onHideDeleteConfirm: () => void;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
};

export function EntryEditorDrawer({
  selectedDate,
  draft,
  categoryPaletteItems,
  editValidationErrorMessage,
  editSaveErrorMessage,
  editSaveState,
  canSaveEditedEntry,
  canDeleteEditedEntry,
  isDeleteConfirmVisible,
  dayPhotosLoadState,
  dayPhotoCount,
  dayPhotosPermissionScope,
  dayPhotosErrorMessage,
  editingEntryPhotoReferences,
  photoReferenceActionState,
  photoReferenceActionErrorMessage,
  onClose,
  onUpdateDraft,
  onHidePhoto,
  onUnlinkPhoto,
  onShowDeleteConfirm,
  onHideDeleteConfirm,
  onDelete,
  onSave,
}: EntryEditorDrawerProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={draft !== null}>
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
                <Text style={styles.categoryPaletteTitle}>기록 편집</Text>
                <Text style={styles.categoryPaletteRange}>{formatMonthDay(selectedDate)}</Text>
              </View>
            </View>

            {draft ? (
              <>
                <View style={styles.timeInputRow}>
                  <TimeSelectField
                    accessibilityLabel="편집 시작 시간 선택"
                    invalid={Boolean(editValidationErrorMessage)}
                    label="시작"
                    onChange={(startTime) => onUpdateDraft({ startTime })}
                    options={DIARY_START_TIME_OPTIONS}
                    value={draft.startTime}
                  />
                  <TimeSelectField
                    accessibilityLabel="편집 종료 시간 선택"
                    invalid={Boolean(editValidationErrorMessage)}
                    label="종료"
                    onChange={(endTime) => onUpdateDraft({ endTime })}
                    options={DIARY_END_TIME_OPTIONS}
                    value={draft.endTime}
                  />
                </View>

                <View style={styles.editFieldGroup}>
                  <Text style={styles.timeInputLabel}>카테고리</Text>
                  <View style={styles.categoryButtonList}>
                    {categoryPaletteItems.map((category) => {
                      const isSelected = category.id === draft.categoryId;

                      return (
                        <Pressable
                          key={category.id}
                          accessibilityRole="button"
                          onPress={() => onUpdateDraft({ categoryId: category.id })}
                          style={({ pressed }) => [
                            styles.categoryButton,
                            {
                              backgroundColor: category.color,
                              borderColor: category.color,
                            },
                            isSelected && styles.categoryButtonSelected,
                            pressed && styles.categoryButtonPressed,
                          ]}
                        >
                          <Text style={styles.categoryButtonText}>
                            {category.emoji} {category.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.editFieldGroup}>
                  <Text style={styles.timeInputLabel}>메모</Text>
                  <TextInput
                    accessibilityLabel="기록 메모"
                    multiline
                    onChangeText={(note) => onUpdateDraft({ note })}
                    placeholder="메모"
                    style={[styles.timeInput, styles.noteInput]}
                    value={draft.note}
                  />
                </View>

                <View style={styles.editFieldGroup}>
                  <Text style={styles.timeInputLabel}>사진</Text>
                  <EntryPhotoReferenceList
                    state={dayPhotosLoadState}
                    photoCount={dayPhotoCount}
                    permissionScope={dayPhotosPermissionScope}
                    errorMessage={dayPhotosErrorMessage}
                    references={editingEntryPhotoReferences}
                    actionState={photoReferenceActionState}
                    onHidePhoto={onHidePhoto}
                    onUnlinkPhoto={onUnlinkPhoto}
                  />
                </View>

                {photoReferenceActionState === 'saving' ? (
                  <Text style={styles.categorySaveStatus}>사진 상태를 저장하고 있습니다.</Text>
                ) : null}
                {photoReferenceActionErrorMessage ? (
                  <Text style={styles.categorySaveError}>{photoReferenceActionErrorMessage}</Text>
                ) : null}

                {editValidationErrorMessage ? (
                  <Text style={styles.categorySaveError}>{editValidationErrorMessage}</Text>
                ) : null}
                {editSaveErrorMessage ? (
                  <Text style={styles.categorySaveError}>{editSaveErrorMessage}</Text>
                ) : null}
                {editSaveState === 'saving' ? (
                  <Text style={styles.categorySaveStatus}>수정 내용을 저장하고 있습니다.</Text>
                ) : null}
                {editSaveState === 'deleting' ? (
                  <Text style={styles.categorySaveStatus}>기록을 삭제하고 있습니다.</Text>
                ) : null}

                {isDeleteConfirmVisible ? (
                  <View style={styles.deleteConfirmBox}>
                    <Text style={styles.deleteConfirmTitle}>이 기록을 삭제할까요?</Text>
                    <View style={styles.editActionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={onHideDeleteConfirm}
                        style={({ pressed }) => [
                          styles.secondaryActionButton,
                          pressed && styles.secondaryActionButtonPressed,
                        ]}
                      >
                        <Text style={styles.secondaryActionButtonText}>취소</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: editSaveState === 'deleting' }}
                        disabled={editSaveState === 'deleting'}
                        onPress={() => void onDelete()}
                        style={({ pressed }) => [
                          styles.deleteConfirmButton,
                          editSaveState === 'deleting' && styles.deleteActionButtonDisabled,
                          pressed &&
                            editSaveState !== 'deleting' &&
                            styles.deleteConfirmButtonPressed,
                        ]}
                      >
                        <Text style={styles.deleteConfirmButtonText}>삭제</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canDeleteEditedEntry }}
                    disabled={!canDeleteEditedEntry}
                    onPress={onShowDeleteConfirm}
                    style={({ pressed }) => [
                      styles.deleteActionButton,
                      !canDeleteEditedEntry && styles.deleteActionButtonDisabled,
                      pressed && canDeleteEditedEntry && styles.deleteActionButtonPressed,
                    ]}
                  >
                    <Text style={styles.deleteActionButtonText}>삭제</Text>
                  </Pressable>
                )}

                <View style={styles.editActionRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.secondaryActionButton,
                      pressed && styles.secondaryActionButtonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryActionButtonText}>취소</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSaveEditedEntry }}
                    disabled={!canSaveEditedEntry}
                    onPress={() => void onSave()}
                    style={({ pressed }) => [
                      styles.primaryActionButton,
                      !canSaveEditedEntry && styles.primaryActionButtonDisabled,
                      pressed && canSaveEditedEntry && styles.primaryActionButtonPressed,
                    ]}
                  >
                    <Text style={styles.primaryActionButtonText}>저장</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatMonthDay(date: DateString): string {
  const [, monthText, dayText] = date.split('-');

  return `${Number(monthText)}월 ${Number(dayText)}일`;
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
  timeInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
  categoryButtonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
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
  categoryButtonSelected: {
    borderColor: theme.color.text,
  },
  categoryButtonText: {
    color: theme.color.surface,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  editFieldGroup: {
    gap: theme.spacing.sm,
  },
  noteInput: {
    minHeight: 88,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  editActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  deleteActionButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.md,
  },
  deleteActionButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  deleteActionButtonDisabled: {
    opacity: 0.42,
  },
  deleteActionButtonText: {
    color: theme.color.danger,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteConfirmBox: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
  },
  deleteConfirmTitle: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.danger,
    paddingHorizontal: theme.spacing.md,
  },
  deleteConfirmButtonPressed: {
    opacity: 0.84,
  },
  deleteConfirmButtonText: {
    color: theme.color.surface,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryActionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    paddingHorizontal: theme.spacing.md,
  },
  primaryActionButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  primaryActionButtonDisabled: {
    backgroundColor: theme.color.surfaceMuted,
  },
  primaryActionButtonText: {
    color: theme.color.surface,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.md,
  },
  secondaryActionButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  secondaryActionButtonText: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
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
