import {
  EXAMPLE_CATEGORY_DEFINITIONS,
  type Category,
  type ExampleCategoryDefinition,
} from '@weekly/domain';
import { getSupabaseStorageErrorMessage } from '@weekly/data';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutRectangle,
  type PanResponderGestureState,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import {
  archiveMobileCategory,
  createMobileCategory,
  listMobileCategories,
  updateMobileCategory,
} from '@/lib/supabase/categories';
import { getMobileSupabaseEnvStatus } from '@/lib/supabase/env';
import { theme } from '@/theme';

type CategoryLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';
type CategorySaveState = 'idle' | 'saving' | 'archiving' | 'ordering';
type CategoryFormMode = 'create' | 'edit';

type CategoryFormDraft = {
  id: string | null;
  mode: CategoryFormMode;
  name: string;
  color: string;
  emoji: string;
  weeklyGoalMinutes: string;
  sortOrder: number;
  isArchived: boolean;
};

type ParsedCategoryForm = {
  name: string;
  color: string;
  emoji: string;
  weeklyGoalMinutes: number | null;
  sortOrder: number;
};

const COLOR_PRESETS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
] as const;

const DRAG_START_DELAY_MS = 240;

type CategoryDragState = {
  categoryId: string;
  currentIndex: number;
  hasChanged: boolean;
};

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<CategoryLoadState>('idle');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryFormDraft | null>(null);
  const [saveState, setSaveState] = useState<CategorySaveState>('idle');
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [archivingCategoryId, setArchivingCategoryId] = useState<string | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const dragStateRef = useRef<CategoryDragState | null>(null);
  const dragStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowLayoutsRef = useRef(new Map<string, LayoutRectangle>());
  const sortedCategoriesRef = useRef<Category[]>([]);
  const saveStateRef = useRef<CategorySaveState>('idle');

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt),
      ),
    [categories],
  );
  sortedCategoriesRef.current = sortedCategories;
  saveStateRef.current = saveState;
  const isDraggingCategory = draggingCategoryId !== null;
  const isUiBusy = saveState !== 'idle' || isDraggingCategory;

  const loadCategories = useCallback(async () => {
    const envStatus = getMobileSupabaseEnvStatus();

    if (!envStatus.isConfigured) {
      setCategories([]);
      setLoadState('unconfigured');
      setLoadMessage('Supabase 환경 변수가 설정되지 않았습니다.');
      return;
    }

    setLoadState('loading');
    setLoadMessage(null);

    try {
      const nextCategories = await listMobileCategories({ includeArchived: true });

      setCategories(nextCategories);
      setLoadState('ready');
    } catch (error) {
      setCategories([]);
      setLoadState('error');
      setLoadMessage(getSupabaseStorageErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCategories();

      return undefined;
    }, [loadCategories]),
  );

  function returnToToday() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/today');
  }

  function startCreateDraft() {
    setDraft(createEmptyDraft(getNextSortOrder(categories)));
    setFormMessage(null);
    setStatusMessage(null);
  }

  function startExampleDraft(example: ExampleCategoryDefinition) {
    setDraft({
      id: null,
      mode: 'create',
      name: example.name,
      color: getExamplePresetColor(example),
      emoji: example.emoji,
      weeklyGoalMinutes:
        example.weeklyGoalMinutes === null ? '' : String(example.weeklyGoalMinutes),
      sortOrder: getNextSortOrder(categories),
      isArchived: false,
    });
    setFormMessage(null);
    setStatusMessage(null);
  }

  function startEditDraft(category: Category) {
    setDraft({
      id: category.id,
      mode: 'edit',
      name: category.name,
      color: category.color,
      emoji: category.emoji,
      weeklyGoalMinutes:
        category.weeklyGoalMinutes === null ? '' : String(category.weeklyGoalMinutes),
      sortOrder: category.sortOrder,
      isArchived: category.isArchived,
    });
    setFormMessage(null);
    setStatusMessage(null);
  }

  async function handleSaveDraft() {
    if (!draft || saveState !== 'idle') {
      return;
    }

    const parsedDraft = parseCategoryForm(draft);

    if (typeof parsedDraft === 'string') {
      setFormMessage(parsedDraft);
      return;
    }

    setSaveState('saving');
    setFormMessage(null);
    setStatusMessage(null);

    try {
      if (draft.mode === 'edit' && draft.id) {
        await updateMobileCategory({ id: draft.id, ...parsedDraft });
        setStatusMessage('카테고리를 수정했습니다.');
      } else {
        await createMobileCategory(parsedDraft);
        setStatusMessage('카테고리를 추가했습니다.');
      }

      setDraft(null);
      await loadCategories();
    } catch (error) {
      setFormMessage(getSupabaseStorageErrorMessage(error));
    } finally {
      setSaveState('idle');
    }
  }

  function requestArchive(id: string, isArchived: boolean) {
    if (isArchived || saveState !== 'idle') {
      return;
    }

    Alert.alert('카테고리 보관', '기존 기록은 유지되고 새 기록 팔레트에서는 숨겨집니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '보관',
        style: 'destructive',
        onPress: () => void archiveCategory(id),
      },
    ]);
  }

  async function archiveCategory(id: string) {
    setSaveState('archiving');
    setArchivingCategoryId(id);
    setFormMessage(null);
    setStatusMessage(null);

    try {
      await archiveMobileCategory({ id });
      setStatusMessage('카테고리를 보관했습니다.');

      if (draft?.id === id) {
        setDraft(null);
      }

      await loadCategories();
    } catch (error) {
      setFormMessage(getSupabaseStorageErrorMessage(error));
    } finally {
      setArchivingCategoryId(null);
      setSaveState('idle');
    }
  }

  function createDragHandleResponder(categoryId: string) {
    return PanResponder.create({
      onMoveShouldSetPanResponder: () => saveStateRef.current === 'idle',
      onPanResponderGrant: () => {
        if (saveStateRef.current !== 'idle') {
          return;
        }

        clearDragStartTimer();
        dragStartTimerRef.current = setTimeout(() => {
          beginCategoryDrag(categoryId);
        }, DRAG_START_DELAY_MS);
      },
      onPanResponderMove: (_event, gestureState) => {
        handleCategoryDragMove(categoryId, gestureState);
      },
      onPanResponderRelease: () => {
        void finishCategoryDrag();
      },
      onPanResponderTerminate: () => {
        void finishCategoryDrag();
      },
      onPanResponderTerminationRequest: () => false,
      onStartShouldSetPanResponder: () => saveStateRef.current === 'idle',
    });
  }

  function beginCategoryDrag(categoryId: string) {
    if (saveStateRef.current !== 'idle') {
      return;
    }

    const currentIndex = sortedCategoriesRef.current.findIndex(
      (category) => category.id === categoryId,
    );

    if (currentIndex < 0) {
      return;
    }

    dragStateRef.current = {
      categoryId,
      currentIndex,
      hasChanged: false,
    };
    setDraggingCategoryId(categoryId);
    setFormMessage(null);
    setStatusMessage(null);
  }

  function handleCategoryDragMove(categoryId: string, gestureState: PanResponderGestureState) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.categoryId !== categoryId) {
      return;
    }

    const activeLayout = rowLayoutsRef.current.get(categoryId);

    if (!activeLayout) {
      return;
    }

    const activeCenter = activeLayout.y + activeLayout.height / 2 + gestureState.dy;
    const targetIndex = getDragTargetIndex(categoryId, activeCenter);

    if (targetIndex !== dragState.currentIndex) {
      reorderCategoriesLocally(categoryId, targetIndex);
    }
  }

  function getDragTargetIndex(categoryId: string, activeCenter: number): number {
    let targetIndex = 0;

    for (const category of sortedCategoriesRef.current) {
      if (category.id === categoryId) {
        continue;
      }

      const layout = rowLayoutsRef.current.get(category.id);

      if (layout && activeCenter > layout.y + layout.height / 2) {
        targetIndex += 1;
      }
    }

    return Math.min(targetIndex, sortedCategoriesRef.current.length - 1);
  }

  function reorderCategoriesLocally(categoryId: string, targetIndex: number) {
    const orderedCategories = [...sortedCategoriesRef.current];
    const currentIndex = orderedCategories.findIndex((category) => category.id === categoryId);

    if (currentIndex < 0) {
      return;
    }

    const [movingCategory] = orderedCategories.splice(currentIndex, 1);
    orderedCategories.splice(targetIndex, 0, movingCategory);

    const nextCategories = orderedCategories.map((category, index) => ({
      ...category,
      sortOrder: (index + 1) * 10,
    }));

    sortedCategoriesRef.current = nextCategories;
    setCategories(nextCategories);

    if (dragStateRef.current) {
      dragStateRef.current.currentIndex = targetIndex;
      dragStateRef.current.hasChanged = true;
    }
  }

  async function finishCategoryDrag() {
    clearDragStartTimer();

    const dragState = dragStateRef.current;

    dragStateRef.current = null;
    setDraggingCategoryId(null);

    if (!dragState?.hasChanged) {
      return;
    }

    setSaveState('ordering');
    setFormMessage(null);
    setStatusMessage(null);

    try {
      await Promise.all(
        sortedCategoriesRef.current.map((category, index) =>
          updateMobileCategory({ id: category.id, sortOrder: (index + 1) * 10 }),
        ),
      );
      setStatusMessage('표시 순서를 변경했습니다.');
      await loadCategories();
    } catch (error) {
      setFormMessage(getSupabaseStorageErrorMessage(error));
      await loadCategories();
    } finally {
      setSaveState('idle');
    }
  }

  function clearDragStartTimer() {
    if (dragStartTimerRef.current) {
      clearTimeout(dragStartTimerRef.current);
      dragStartTimerRef.current = null;
    }
  }

  return (
    <Screen scrollEnabled={!isDraggingCategory}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={returnToToday}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.backButtonText}>{'‹'}</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>카테고리</Text>
          <Text style={styles.title}>카테고리 관리</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton
          disabled={loadState === 'loading' || loadState === 'unconfigured' || isUiBusy}
          label="새 카테고리"
          onPress={startCreateDraft}
        />
      </View>

      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

      {draft ? (
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {draft.mode === 'edit' ? '카테고리 편집' : '카테고리 추가'}
            </Text>
            {draft.isArchived ? <Text style={styles.archivedBadge}>보관됨</Text> : null}
          </View>

          {draft.mode === 'create' ? (
            <View style={styles.exampleChipSection}>
              <Text style={styles.inputLabel}>예시</Text>
              <View style={styles.exampleChipList}>
                {EXAMPLE_CATEGORY_DEFINITIONS.map((example) => (
                  <Pressable
                    accessibilityRole="button"
                    key={example.key}
                    onPress={() => startExampleDraft(example)}
                    style={({ pressed }) => [
                      styles.exampleChip,
                      pressed && styles.exampleChipPressed,
                    ]}
                  >
                    <Text style={styles.exampleChipText}>
                      {example.emoji} {example.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.inlineInputs}>
            <View style={styles.emojiInputGroup}>
              <Text style={styles.inputLabel}>이모지</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(emoji) => setDraft({ ...draft, emoji })}
                placeholder="📚"
                style={styles.textInput}
                value={draft.emoji}
              />
            </View>
            <View style={styles.nameInputGroup}>
              <Text style={styles.inputLabel}>이름</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(name) => setDraft({ ...draft, name })}
                placeholder="예: 공부/주요 업무"
                style={styles.textInput}
                value={draft.name}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>색상</Text>
            <View style={styles.colorPresetList}>
              {COLOR_PRESETS.map((color) => {
                const isSelected = draft.color.toUpperCase() === color;

                return (
                  <Pressable
                    accessibilityLabel={`${color} 색상 선택`}
                    accessibilityRole="button"
                    key={color}
                    onPress={() => setDraft({ ...draft, color })}
                    style={[
                      styles.colorPreset,
                      { backgroundColor: color },
                      isSelected && styles.colorPresetSelected,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>주간 목표(분)</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              onChangeText={(weeklyGoalMinutes) => setDraft({ ...draft, weeklyGoalMinutes })}
              placeholder="비워두면 목표 없음"
              style={styles.textInput}
              value={draft.weeklyGoalMinutes}
            />
          </View>

          {formMessage ? <Text style={styles.errorText}>{formMessage}</Text> : null}

          <View style={styles.formActions}>
            <PrimaryButton
              disabled={isUiBusy}
              label={saveState === 'saving' ? '저장 중' : '저장'}
              onPress={() => void handleSaveDraft()}
            />
            <PrimaryButton
              disabled={isUiBusy}
              label="취소"
              onPress={() => setDraft(null)}
              variant="secondary"
            />
            {draft.mode === 'edit' && !draft.isArchived ? (
              <Pressable
                accessibilityRole="button"
                disabled={isUiBusy}
                onPress={() => draft.id && requestArchive(draft.id, draft.isArchived)}
                style={({ pressed }) => [
                  styles.archiveButton,
                  pressed && !isUiBusy && styles.archiveButtonPressed,
                ]}
              >
                <Text style={styles.archiveButtonText}>보관 처리</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.listSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>저장된 카테고리</Text>
          <Text style={styles.countBadge}>{sortedCategories.length}개</Text>
        </View>

        {loadState === 'loading' ? <Text style={styles.helperText}>불러오는 중입니다.</Text> : null}
        {loadState === 'unconfigured' || loadState === 'error' ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>{loadMessage ?? '카테고리를 불러오지 못했습니다.'}</Text>
          </View>
        ) : null}

        {loadState === 'ready' && sortedCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>저장된 카테고리가 없습니다.</Text>
            <Text style={styles.helperText}>새 카테고리를 눌러 직접 만들 수 있습니다.</Text>
          </View>
        ) : null}

        {sortedCategories.map((category) => {
          const isArchiving = archivingCategoryId === category.id;
          const isDragging = draggingCategoryId === category.id;
          const dragHandleResponder = createDragHandleResponder(category.id);

          return (
            <View
              key={category.id}
              onLayout={(event) => {
                rowLayoutsRef.current.set(category.id, event.nativeEvent.layout);
              }}
              style={[styles.categoryItem, isDragging && styles.categoryItemDragging]}
            >
              <View style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.categoryColorDot, { backgroundColor: category.color }]} />
                  <View style={styles.categoryCopy}>
                    <View style={styles.categoryTitleRow}>
                      <Text style={styles.categoryName}>
                        {category.emoji} {category.name}
                      </Text>
                      {category.isArchived ? (
                        <Text style={styles.archivedBadge}>보관됨</Text>
                      ) : null}
                    </View>
                    <Text style={styles.categoryMeta}>
                      목표 {formatGoalMinutes(category.weeklyGoalMinutes)}
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isUiBusy}
                    onPress={() => startEditDraft(category)}
                    style={({ pressed }) => [
                      styles.smallButton,
                      isUiBusy && styles.smallButtonDisabled,
                      pressed && !isUiBusy && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.smallButtonText}>편집</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={category.isArchived || isUiBusy}
                    onPress={() => requestArchive(category.id, category.isArchived)}
                    style={({ pressed }) => [
                      styles.smallButton,
                      styles.smallDangerButton,
                      (category.isArchived || isUiBusy) && styles.smallButtonDisabled,
                      pressed &&
                        !category.isArchived &&
                        !isUiBusy &&
                        styles.smallDangerButtonPressed,
                    ]}
                  >
                    <Text style={[styles.smallButtonText, styles.smallDangerButtonText]}>
                      {isArchiving ? '보관 중' : '보관'}
                    </Text>
                  </Pressable>
                </View>

                <View
                  {...dragHandleResponder.panHandlers}
                  accessibilityLabel="카테고리 순서 변경"
                  accessibilityRole="button"
                  style={[styles.dragHandle, isDragging && styles.dragHandleActive]}
                >
                  <Text style={styles.dragHandleText}>☰</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function createEmptyDraft(sortOrder: number): CategoryFormDraft {
  return {
    id: null,
    mode: 'create',
    name: '',
    color: '#3B82F6',
    emoji: '🧭',
    weeklyGoalMinutes: '',
    sortOrder,
    isArchived: false,
  };
}

function getNextSortOrder(categories: readonly Category[]): number {
  if (categories.length === 0) {
    return 10;
  }

  return Math.max(...categories.map((category) => category.sortOrder)) + 10;
}

function getExamplePresetColor(example: ExampleCategoryDefinition): string {
  const presetIndex = Math.max(0, Math.floor(example.sortOrder / 10) - 1) % COLOR_PRESETS.length;

  return COLOR_PRESETS[presetIndex];
}

function parseCategoryForm(draft: CategoryFormDraft): ParsedCategoryForm | string {
  const name = draft.name.trim();
  const color = draft.color.trim().toUpperCase();
  const emoji = draft.emoji.trim();
  const weeklyGoalText = draft.weeklyGoalMinutes.trim();

  if (!name) {
    return '카테고리 이름을 입력해주세요.';
  }

  if (!/^#[0-9A-F]{6}$/.test(color)) {
    return '색상은 #RRGGBB 형식으로 입력해주세요.';
  }

  if (!emoji) {
    return '이모지를 입력해주세요.';
  }

  if (weeklyGoalText.length > 0 && !/^\d+$/.test(weeklyGoalText)) {
    return '주간 목표는 0 이상의 정수 분 단위로 입력해주세요.';
  }

  const weeklyGoalMinutes =
    weeklyGoalText.length === 0 ? null : Number.parseInt(weeklyGoalText, 10);

  return {
    name,
    color,
    emoji,
    weeklyGoalMinutes,
    sortOrder: draft.sortOrder,
  };
}

function formatGoalMinutes(minutes: number | null): string {
  if (minutes === null) {
    return '없음';
  }

  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0 ? `${hours}시간` : `${hours}시간 ${remainingMinutes}분`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  backButtonText: {
    color: theme.color.primary,
    fontSize: 30,
    fontWeight: '400',
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xs,
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
  actionRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  formSection: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  listSection: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  countBadge: {
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  archivedBadge: {
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  inputGroup: {
    gap: theme.spacing.xs,
  },
  inputLabel: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  textInput: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.typography.body,
    paddingHorizontal: 0,
    paddingVertical: theme.spacing.xs,
  },
  colorPresetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  colorPreset: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: theme.color.surface,
    borderRadius: 17,
  },
  colorPresetSelected: {
    borderColor: theme.color.text,
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  emojiInputGroup: {
    width: 76,
    gap: theme.spacing.xs,
  },
  nameInputGroup: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  formActions: {
    gap: theme.spacing.sm,
  },
  archiveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.lg,
  },
  archiveButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  archiveButtonText: {
    color: theme.color.danger,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  messageBox: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
  },
  emptyState: {
    gap: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  helperText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  exampleChipSection: {
    gap: theme.spacing.sm,
  },
  exampleChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  exampleChip: {
    minHeight: 32,
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  exampleChipPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  exampleChipText: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  categoryItem: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
    paddingTop: theme.spacing.md,
  },
  categoryItemDragging: {
    backgroundColor: theme.color.surfaceMuted,
    opacity: 0.92,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  categoryColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  categoryCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryName: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  categoryMeta: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  smallButton: {
    minHeight: 40,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.md,
  },
  smallDangerButton: {
    borderColor: theme.color.danger,
  },
  smallDangerButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  smallButtonDisabled: {
    opacity: 0.45,
  },
  smallButtonText: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  smallDangerButtonText: {
    color: theme.color.danger,
  },
  dragHandle: {
    width: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  dragHandleActive: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.surfaceMuted,
  },
  dragHandleText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.body,
    fontWeight: '500',
  },
  buttonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  statusText: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
