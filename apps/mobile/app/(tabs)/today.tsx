import {
  addDaysToDate,
  buildWeekGrid,
  createWeekGridTimeRangeSelection,
  DEFAULT_WEEK_GRID_START_TIME,
  DEFAULT_WEEK_GRID_END_TIME,
  EXAMPLE_CATEGORY_DEFINITIONS,
  getWeekStartDate,
  WEEK_GRID_SLOT_MINUTES,
  type Category,
  type DateString,
  type PhotoReference,
  type TimeEntry,
  type WeekGridBlock,
  type WeekGridTimeRangeSelection,
} from '@weekly/domain';
import { getSupabaseStorageErrorMessage } from '@weekly/data';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
} from 'react-native';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { Screen } from '@/components/Screen';
import { getMobileSupabaseEnvStatus } from '@/lib/supabase/env';
import { listMobileCategories } from '@/lib/supabase/categories';
import { getMobileSettings } from '@/lib/supabase/settings';
import {
  createMobileTimeEntry,
  deleteMobileTimeEntry,
  listMobileTimeEntriesByDate,
  updateMobileTimeEntry,
} from '@/lib/supabase/timeEntries';
import type { DatePhotoAsset } from '@/photos/datePhotoAssets';
import { listDatePhotoAssets } from '@/photos/mediaLibrary';
import {
  hidePhotoReference,
  syncDatePhotoReferences,
  unlinkPhotoReference,
} from '@/photos/photoReferenceStore';
import { theme } from '@/theme';
import {
  getWeekGridSlotIndexFromPoint,
  type WeekGridSlotBounds,
  type WeekGridSlotPoint,
} from '@/todayGridSelection';
import {
  createTimeRangeSelectionFromSlot,
  createTimeRangeSelectionFromTimes,
  expandTimeRangeSelection,
} from '@/timeRangeSelection';
import {
  createCategoryPaletteItems,
  createDailyEntryListItems,
  createDailySummary,
  formatDuration,
  resolveSelectedDate,
  type DailyEntryListItem,
} from '@/todayViewModel';

const BLOCKS_PER_HOUR = 6;
const BLOCK_ROW_GAP = theme.spacing.xs;
const BLOCK_COLUMN_GAP = 2;
const LONG_PRESS_SELECTION_DELAY_MS = 300;
const LONG_PRESS_MOVE_TOLERANCE = 8;
const EDGE_AUTO_SCROLL_THRESHOLD = 80;
const EDGE_AUTO_SCROLL_MAX_STEP = 12;
const MAX_ENTRY_THUMBNAILS = 3;

type SelectionDraft = {
  anchorSlotIndex: number;
  focusSlotIndex: number;
};

type DayEntriesLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';
type DayPhotosLoadState = 'idle' | 'loading' | 'ready' | 'disabled' | 'permission-denied' | 'error';
type EntrySaveState = 'idle' | 'saving' | 'error';
type EntryEditSaveState = 'idle' | 'saving' | 'deleting' | 'error';
type PhotoReferenceActionState = 'idle' | 'saving' | 'error';

type EntryEditDraft = {
  id: string;
  startTime: string;
  endTime: string;
  categoryId: string;
  note: string;
};

export default function TodayScreen() {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const { user } = useMobileAuth();
  const { height: windowHeight } = useWindowDimensions();
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const scrollViewRef = useRef<ScrollView>(null);
  const blockMatrixRef = useRef<View>(null);
  const blockGridBoundsRef = useRef<WeekGridSlotBounds | null>(null);
  const blockGridLayoutRef = useRef<{ width: number; height: number } | null>(null);
  const tappedSlotIndexRef = useRef<number | null>(null);
  const hasTouchMovedRef = useRef(false);
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
  const requestedDate = useMemo(
    () => resolveSelectedDate(searchParams.date, todayDate),
    [searchParams.date, todayDate],
  );
  const [selectedDate, setSelectedDate] = useState<DateString>(requestedDate);
  const selectedDayGrid = useMemo(() => {
    const weekGrid = buildWeekGrid({ weekStartDate: getWeekStartDate(selectedDate, 'monday') });
    return weekGrid.days.find((day) => day.date === selectedDate) ?? weekGrid.days[0];
  }, [selectedDate]);
  const blocks = selectedDayGrid?.blocks ?? [];
  const hourlyRows = useMemo(() => createHourlyRows(blocks), [blocks]);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [confirmedSelection, setConfirmedSelection] = useState<WeekGridTimeRangeSelection | null>(
    null,
  );
  const [timeInputStart, setTimeInputStart] = useState('');
  const [timeInputEnd, setTimeInputEnd] = useState('');
  const [timeInputError, setTimeInputError] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dayEntriesLoadState, setDayEntriesLoadState] = useState<DayEntriesLoadState>('idle');
  const [dayPhotos, setDayPhotos] = useState<DatePhotoAsset[]>([]);
  const [dayPhotoReferences, setDayPhotoReferences] = useState<PhotoReference[]>([]);
  const [dayPhotosLoadState, setDayPhotosLoadState] = useState<DayPhotosLoadState>('idle');
  const [dayPhotosPermissionScope, setDayPhotosPermissionScope] = useState<string | null>(null);
  const [dayPhotosErrorMessage, setDayPhotosErrorMessage] = useState<string | null>(null);
  const [thumbnailSyncEnabled, setThumbnailSyncEnabled] = useState(false);
  const [thumbnailSyncErrorMessage, setThumbnailSyncErrorMessage] = useState<string | null>(null);
  const [entrySaveState, setEntrySaveState] = useState<EntrySaveState>('idle');
  const [entrySaveErrorMessage, setEntrySaveErrorMessage] = useState<string | null>(null);
  const [editingEntryDraft, setEditingEntryDraft] = useState<EntryEditDraft | null>(null);
  const [editSaveState, setEditSaveState] = useState<EntryEditSaveState>('idle');
  const [editSaveErrorMessage, setEditSaveErrorMessage] = useState<string | null>(null);
  const [photoReferenceActionState, setPhotoReferenceActionState] =
    useState<PhotoReferenceActionState>('idle');
  const [photoReferenceActionErrorMessage, setPhotoReferenceActionErrorMessage] = useState<
    string | null
  >(null);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const isTodaySelected = selectedDate === todayDate;
  const visibleMinutes = blocks.length * WEEK_GRID_SLOT_MINUTES;
  const dailyEntryItems = useMemo(
    () => createDailyEntryListItems(dayEntries, categories),
    [categories, dayEntries],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const dailySummary = useMemo(
    () => createDailySummary(dayEntries, categories, visibleMinutes),
    [categories, dayEntries, visibleMinutes],
  );
  const categoryPaletteItems = useMemo(
    () => createCategoryPaletteItems(categories, dayEntries),
    [categories, dayEntries],
  );
  const photoReferencesByEntryId = useMemo(
    () => groupVisiblePhotoReferencesByEntryId(dayPhotoReferences),
    [dayPhotoReferences],
  );
  const draftSelection = useMemo(
    () => createSelectedRange(blocks, selectionDraft),
    [blocks, selectionDraft],
  );
  const displayedSelection = draftSelection ?? confirmedSelection;
  const canApplySelectedRange =
    confirmedSelection !== null && timeInputError === null && entrySaveState !== 'saving';
  const editValidationErrorMessage = useMemo(
    () =>
      editingEntryDraft ? getEntryEditValidationError(blocks, editingEntryDraft, categories) : null,
    [blocks, categories, editingEntryDraft],
  );
  const canSaveEditedEntry =
    editingEntryDraft !== null &&
    editValidationErrorMessage === null &&
    !isDeleteConfirmVisible &&
    editSaveState !== 'saving' &&
    editSaveState !== 'deleting';
  const canDeleteEditedEntry = editingEntryDraft !== null && editSaveState !== 'deleting';
  const editingEntryPhotoReferences = editingEntryDraft
    ? (photoReferencesByEntryId.get(editingEntryDraft.id) ?? [])
    : [];
  const canMoveSelectionStartEarlier =
    confirmedSelection !== null &&
    expandTimeRangeSelection(blocks, confirmedSelection, 'start', -1) !== null;
  const canMoveSelectionStartLater =
    confirmedSelection !== null &&
    expandTimeRangeSelection(blocks, confirmedSelection, 'start', 1) !== null;
  const canMoveSelectionEndEarlier =
    confirmedSelection !== null &&
    expandTimeRangeSelection(blocks, confirmedSelection, 'end', -1) !== null;
  const canMoveSelectionEndLater =
    confirmedSelection !== null &&
    expandTimeRangeSelection(blocks, confirmedSelection, 'end', 1) !== null;
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

  useEffect(() => {
    setSelectedDate(requestedDate);
  }, [requestedDate]);

  useEffect(() => {
    setConfirmedSelection(null);
    setTimeInputStart('');
    setTimeInputEnd('');
    setTimeInputError(null);
    setEntrySaveState('idle');
    setEntrySaveErrorMessage(null);
    setEditingEntryDraft(null);
    setEditSaveState('idle');
    setEditSaveErrorMessage(null);
    setPhotoReferenceActionState('idle');
    setPhotoReferenceActionErrorMessage(null);
    setIsDeleteConfirmVisible(false);
    selectionDraftRef.current = null;
    setSelectionDraft(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!confirmedSelection) {
      return;
    }

    setTimeInputStart(confirmedSelection.startTime);
    setTimeInputEnd(confirmedSelection.endTime);
    setTimeInputError(null);
    setEntrySaveState('idle');
    setEntrySaveErrorMessage(null);
  }, [confirmedSelection]);

  useEffect(() => {
    const envStatus = getMobileSupabaseEnvStatus();

    if (!envStatus.isConfigured) {
      setDayEntries([]);
      setCategories([]);
      setDayEntriesLoadState('unconfigured');
      return;
    }

    let isActive = true;

    setDayEntriesLoadState('loading');

    void loadSelectedDateData(selectedDate)
      .then(([nextEntries, nextCategories]) => {
        if (!isActive) {
          return;
        }

        setDayEntries(nextEntries);
        setCategories(nextCategories);
        setDayEntriesLoadState('ready');
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setDayEntries([]);
        setCategories([]);
        setDayEntriesLoadState('error');
      });

    return () => {
      isActive = false;
    };
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      const envStatus = getMobileSupabaseEnvStatus();

      if (!envStatus.isConfigured) {
        return undefined;
      }

      let isActive = true;

      void listMobileCategories({ includeArchived: true })
        .then((nextCategories) => {
          if (isActive) {
            setCategories(nextCategories);
          }
        })
        .catch(() => undefined);

      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    const envStatus = getMobileSupabaseEnvStatus();
    let isActive = true;

    setDayPhotos([]);
    setDayPhotoReferences([]);
    setDayPhotosPermissionScope(null);
    setDayPhotosErrorMessage(null);
    setThumbnailSyncEnabled(false);
    setThumbnailSyncErrorMessage(null);

    if (!envStatus.isConfigured) {
      setDayPhotosLoadState('disabled');
      return;
    }

    setDayPhotosLoadState('loading');

    getMobileSettings()
      .then((settings) => {
        if (!settings?.photoMatchingEnabled) {
          return {
            state: 'disabled' as const,
            assets: [],
            permissionScope: null,
            errorMessage: null,
            thumbnailSyncEnabled: false,
          };
        }

        return listDatePhotoAssets(selectedDate).then((result) => ({
          ...result,
          thumbnailSyncEnabled: settings.thumbnailSyncEnabled,
        }));
      })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setDayPhotos(result.assets);
        setDayPhotosPermissionScope(result.permissionScope);
        setDayPhotosLoadState(result.state);
        setDayPhotosErrorMessage(result.errorMessage);
        setThumbnailSyncEnabled(result.thumbnailSyncEnabled);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setDayPhotos([]);
        setDayPhotosPermissionScope(null);
        setThumbnailSyncEnabled(false);
        setThumbnailSyncErrorMessage(null);
        setDayPhotosLoadState('error');
        setDayPhotosErrorMessage(
          error instanceof Error ? error.message : '이 날짜 사진을 불러오지 못했습니다.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [selectedDate]);

  useEffect(
    () => () => {
      clearLongPressTimer();
      stopAutoScroll();
      selectionPulseValue.stopAnimation();
    },
    [selectionPulseValue],
  );

  useEffect(() => {
    if (
      !user ||
      dayEntriesLoadState !== 'ready' ||
      dayPhotosLoadState !== 'ready' ||
      dayPhotos.length === 0
    ) {
      return;
    }

    let isActive = true;

    syncDatePhotoReferences({
      userId: user.id,
      date: selectedDate,
      assets: dayPhotos,
      entries: dayEntries,
      thumbnailSyncEnabled,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setDayPhotoReferences(result.references);
        setThumbnailSyncErrorMessage(result.thumbnailSyncErrorMessage);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setDayPhotoReferences([]);
        setThumbnailSyncErrorMessage(null);
        setDayPhotosLoadState('error');
        setDayPhotosErrorMessage(
          error instanceof Error ? error.message : '사진 참조를 저장하지 못했습니다.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [
    dayEntries,
    dayEntriesLoadState,
    dayPhotos,
    dayPhotosLoadState,
    selectedDate,
    thumbnailSyncEnabled,
    user,
  ]);

  function moveSelectedDate(days: number) {
    setSelectedDate((currentDate) => {
      const nextDate = addDaysToDate(currentDate, days);
      router.setParams({ date: nextDate });
      return nextDate;
    });
  }

  function moveToToday() {
    const nextDate = getLocalDateString();
    router.setParams({ date: nextDate });
    setSelectedDate(nextDate);
  }

  function handleBlockGridLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    blockGridLayoutRef.current = { width, height };
    measureBlockGridBounds();
  }

  function handleBlockGridTouchStart(event: GestureResponderEvent) {
    const point = getBlockGridPointFromGesture(event);

    clearLongPressTimer();
    stopAutoScroll();
    hasTouchMovedRef.current = false;
    isTouchActiveRef.current = true;
    selectionStartPointRef.current = point;
    latestTouchPointRef.current = point;
    longPressTimeoutRef.current = setTimeout(
      activateSelectionFromLongPress,
      LONG_PRESS_SELECTION_DELAY_MS,
    );
  }

  function handleBlockGridTouchMove(event: GestureResponderEvent) {
    hasTouchMovedRef.current = true;
    tappedSlotIndexRef.current = null;
    handleSelectionMoveToPoint(getBlockGridPointFromGesture(event));
  }

  function handleSelectionMove(
    event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) {
    hasTouchMovedRef.current = true;
    tappedSlotIndexRef.current = null;
    handleSelectionMoveToPoint(getBlockGridPointFromGesture(event, gestureState));
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
    finishSelectionAtPoint(getBlockGridPointFromGesture(event));
  }

  function handleSelectionRelease(
    event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) {
    finishSelectionAtPoint(getBlockGridPointFromGesture(event, gestureState));
  }

  function finishSelectionAtPoint(releasePoint: WeekGridSlotPoint) {
    clearLongPressTimer();
    isTouchActiveRef.current = false;

    if (!isSelectionGestureActiveRef.current) {
      finishTapSelection();
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
    setTimeInputStart('');
    setTimeInputEnd('');
    setTimeInputError(null);
    setEntrySaveState('idle');
    setEntrySaveErrorMessage(null);
  }

  function finishTapSelection() {
    const tappedSlotIndex = tappedSlotIndexRef.current;

    if (tappedSlotIndex !== null && !hasTouchMovedRef.current) {
      confirmSelectionAtSlotIndex(tappedSlotIndex);
      resetSelectionGesture();
      return;
    }

    resetSelectionGesture();
  }

  function confirmSelectionAtSlotIndex(slotIndex: number) {
    const block = blocks[slotIndex];
    const blockEntry = block ? getEntryCoveringBlock(block, dayEntries) : null;

    if (blockEntry) {
      openEntryEditor(blockEntry);
      return;
    }

    const nextSelection = createTimeRangeSelectionFromSlot(blocks, slotIndex);

    if (nextSelection) {
      setConfirmedSelection(nextSelection);
    }
  }

  function adjustConfirmedSelection(edge: 'start' | 'end', deltaSlots: number) {
    if (!confirmedSelection) {
      return;
    }

    const nextSelection = expandTimeRangeSelection(blocks, confirmedSelection, edge, deltaSlots);

    if (nextSelection) {
      setConfirmedSelection(nextSelection);
    }
  }

  function updateTimeInput(nextStartTime: string, nextEndTime: string) {
    setTimeInputStart(nextStartTime);
    setTimeInputEnd(nextEndTime);

    const result = createTimeRangeSelectionFromTimes(blocks, nextStartTime, nextEndTime);

    if (result.isValid) {
      setConfirmedSelection(result.selection);
      setTimeInputError(null);
      return;
    }

    setTimeInputError(result.errorMessage);
  }

  async function applyCategoryToSelection(categoryId: string) {
    if (!confirmedSelection || timeInputError || entrySaveState === 'saving') {
      return;
    }

    const selection = confirmedSelection;

    setEntrySaveState('saving');
    setEntrySaveErrorMessage(null);

    try {
      await createMobileTimeEntry({
        date: selectedDate,
        startTime: selection.startTime,
        endTime: selection.endTime,
        categoryId,
      });

      const [nextEntries, nextCategories] = await loadSelectedDateData(selectedDate);
      setDayEntries(nextEntries);
      setCategories(nextCategories);
      setDayEntriesLoadState('ready');
      clearConfirmedSelection();
    } catch (error) {
      setEntrySaveState('error');
      setEntrySaveErrorMessage(getSupabaseStorageErrorMessage(error));
    }
  }

  function openEntryEditorById(entryId: string) {
    const entry = dayEntries.find((item) => item.id === entryId);

    if (entry) {
      openEntryEditor(entry);
    }
  }

  function openEntryEditor(entry: TimeEntry) {
    clearConfirmedSelection();
    setEditingEntryDraft({
      id: entry.id,
      startTime: entry.startTime,
      endTime: entry.endTime,
      categoryId: entry.categoryId,
      note: entry.note,
    });
    setEditSaveState('idle');
    setEditSaveErrorMessage(null);
    setPhotoReferenceActionState('idle');
    setPhotoReferenceActionErrorMessage(null);
    setIsDeleteConfirmVisible(false);
  }

  function closeEntryEditor() {
    setEditingEntryDraft(null);
    setEditSaveState('idle');
    setEditSaveErrorMessage(null);
    setPhotoReferenceActionState('idle');
    setPhotoReferenceActionErrorMessage(null);
    setIsDeleteConfirmVisible(false);
  }

  function updateEditingEntryDraft(patch: Partial<Omit<EntryEditDraft, 'id'>>) {
    setEditingEntryDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, ...patch } : currentDraft,
    );
    setEditSaveState('idle');
    setEditSaveErrorMessage(null);
    setIsDeleteConfirmVisible(false);
  }

  async function hideEditingPhotoReference(photoId: string) {
    await updateEditingPhotoReference(photoId, 'hide');
  }

  async function unlinkEditingPhotoReference(photoId: string) {
    await updateEditingPhotoReference(photoId, 'unlink');
  }

  async function updateEditingPhotoReference(photoId: string, action: 'hide' | 'unlink') {
    if (photoReferenceActionState === 'saving') {
      return;
    }

    if (!user) {
      setPhotoReferenceActionState('error');
      setPhotoReferenceActionErrorMessage('로그인 후 사진 상태를 변경할 수 있습니다.');
      return;
    }

    setPhotoReferenceActionState('saving');
    setPhotoReferenceActionErrorMessage(null);

    try {
      const nextReferences =
        action === 'hide'
          ? await hidePhotoReference({ userId: user.id, date: selectedDate, photoId })
          : await unlinkPhotoReference({ userId: user.id, date: selectedDate, photoId });

      setDayPhotoReferences(nextReferences);
      setPhotoReferenceActionState('idle');
    } catch (error) {
      setPhotoReferenceActionState('error');
      setPhotoReferenceActionErrorMessage(
        error instanceof Error ? error.message : '사진 상태를 저장하지 못했습니다.',
      );
    }
  }

  async function saveEditedEntry() {
    if (
      !editingEntryDraft ||
      editValidationErrorMessage ||
      isDeleteConfirmVisible ||
      editSaveState === 'saving' ||
      editSaveState === 'deleting'
    ) {
      return;
    }

    const draft = editingEntryDraft;

    setEditSaveState('saving');
    setEditSaveErrorMessage(null);

    try {
      await updateMobileTimeEntry({
        id: draft.id,
        date: selectedDate,
        startTime: draft.startTime,
        endTime: draft.endTime,
        categoryId: draft.categoryId,
        note: draft.note,
      });

      const [nextEntries, nextCategories] = await loadSelectedDateData(selectedDate);
      setDayEntries(nextEntries);
      setCategories(nextCategories);
      setDayEntriesLoadState('ready');
      closeEntryEditor();
    } catch (error) {
      setEditSaveState('error');
      setEditSaveErrorMessage(getSupabaseStorageErrorMessage(error));
    }
  }

  function requestDeleteEditedEntry() {
    if (!canDeleteEditedEntry) {
      return;
    }

    setIsDeleteConfirmVisible(true);
    setEditSaveState('idle');
    setEditSaveErrorMessage(null);
  }

  async function deleteEditedEntry() {
    if (!editingEntryDraft || editSaveState === 'deleting') {
      return;
    }

    const entryId = editingEntryDraft.id;

    setEditSaveState('deleting');
    setEditSaveErrorMessage(null);

    try {
      await deleteMobileTimeEntry({ id: entryId });

      const [nextEntries, nextCategories] = await loadSelectedDateData(selectedDate);
      setDayEntries(nextEntries);
      setCategories(nextCategories);
      setDayEntriesLoadState('ready');
      closeEntryEditor();
    } catch (error) {
      setEditSaveState('error');
      setEditSaveErrorMessage(getSupabaseStorageErrorMessage(error));
      setIsDeleteConfirmVisible(false);
    }
  }

  function measureBlockGridBounds(onMeasured?: (bounds: WeekGridSlotBounds) => void) {
    blockMatrixRef.current?.measureInWindow((pageX, pageY, width, height) => {
      const layout = blockGridLayoutRef.current;
      const bounds = {
        pageX,
        pageY,
        width: layout?.width ?? width,
        height: layout?.height ?? height,
      };
      blockGridBoundsRef.current = bounds;
      onMeasured?.(bounds);
    });
  }

  function getBlockGridPointFromGesture(
    event: GestureResponderEvent,
    gestureState?: PanResponderGestureState,
  ): WeekGridSlotPoint {
    return getPagePointFromGesture(event, gestureState);
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
    tappedSlotIndexRef.current = null;
    hasTouchMovedRef.current = false;
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
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTitleCopy}>
            <Text style={styles.eyebrow}>{isTodaySelected ? '오늘' : '선택 날짜'}</Text>
            <Text style={styles.title}>{formatMonthDay(selectedDate)} 기록</Text>
          </View>
          <Pressable
            accessibilityLabel="카테고리 관리 열기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/categories')}
            style={({ pressed }) => [styles.headerMenuButton, pressed && styles.dateButtonPressed]}
          >
            <Text style={styles.headerMenuButtonText}>...</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.dateNavigator}>
        <Pressable
          accessibilityLabel="이전 날로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => moveSelectedDate(-1)}
          style={({ pressed }) => [styles.dateButton, pressed && styles.dateButtonPressed]}
        >
          <Text style={styles.dateButtonText}>{'<'}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isTodaySelected}
          onPress={moveToToday}
          style={({ pressed }) => [
            styles.todayDateButton,
            isTodaySelected && styles.todayDateButtonDisabled,
            pressed && !isTodaySelected && styles.todayDateButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.todayDateButtonText,
              isTodaySelected && styles.todayDateButtonTextDisabled,
            ]}
          >
            오늘
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="다음 날로 이동"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => moveSelectedDate(1)}
          style={({ pressed }) => [styles.dateButton, pressed && styles.dateButtonPressed]}
        >
          <Text style={styles.dateButtonText}>{'>'}</Text>
        </Pressable>
      </View>

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
            {formatDayPhotoSummary(dayPhotosLoadState, dayPhotos.length)}
          </Text>
        </View>
      </View>

      <View style={styles.gridHeader}>
        <Text style={styles.gridTitle}>
          {DEFAULT_WEEK_GRID_START_TIME}-{DEFAULT_WEEK_GRID_END_TIME}
        </Text>
      </View>

      {renderDayStateBanner(dayEntriesLoadState)}
      {renderDayPhotoStateBanner(
        dayPhotosLoadState,
        dayPhotos.length,
        dayPhotosPermissionScope,
        dayPhotosErrorMessage,
      )}
      {renderThumbnailSyncStateBanner(thumbnailSyncErrorMessage)}

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
                {row.blocks.map((block) => {
                  const blockEntry = getEntryCoveringBlock(block, dayEntries);
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
                        {renderBlockPhotoIndicator(blockPhotoReferences)}
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.entryListSection}>
        <View style={styles.entryListHeader}>
          <Text style={styles.entryListTitle}>세션 목록</Text>
          <Text style={styles.entryListCount}>{dailySummary.entryCount}개</Text>
        </View>

        {renderEntryListContent(
          dayEntriesLoadState,
          dailyEntryItems,
          photoReferencesByEntryId,
          openEntryEditorById,
        )}
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
            <ScrollView
              contentContainerStyle={styles.categoryDrawerContent}
              keyboardShouldPersistTaps="handled"
            >
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

              <View style={styles.timeRangeEditor}>
                <View style={styles.rangeStepperGrid}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canMoveSelectionStartEarlier}
                    onPress={() => adjustConfirmedSelection('start', -1)}
                    style={({ pressed }) => [
                      styles.rangeStepperButton,
                      !canMoveSelectionStartEarlier && styles.rangeStepperButtonDisabled,
                      pressed && canMoveSelectionStartEarlier && styles.rangeStepperButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeStepperButtonText,
                        !canMoveSelectionStartEarlier && styles.rangeStepperButtonTextDisabled,
                      ]}
                    >
                      시작 -10분
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canMoveSelectionStartLater}
                    onPress={() => adjustConfirmedSelection('start', 1)}
                    style={({ pressed }) => [
                      styles.rangeStepperButton,
                      !canMoveSelectionStartLater && styles.rangeStepperButtonDisabled,
                      pressed && canMoveSelectionStartLater && styles.rangeStepperButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeStepperButtonText,
                        !canMoveSelectionStartLater && styles.rangeStepperButtonTextDisabled,
                      ]}
                    >
                      시작 +10분
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canMoveSelectionEndEarlier}
                    onPress={() => adjustConfirmedSelection('end', -1)}
                    style={({ pressed }) => [
                      styles.rangeStepperButton,
                      !canMoveSelectionEndEarlier && styles.rangeStepperButtonDisabled,
                      pressed && canMoveSelectionEndEarlier && styles.rangeStepperButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeStepperButtonText,
                        !canMoveSelectionEndEarlier && styles.rangeStepperButtonTextDisabled,
                      ]}
                    >
                      종료 -10분
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canMoveSelectionEndLater}
                    onPress={() => adjustConfirmedSelection('end', 1)}
                    style={({ pressed }) => [
                      styles.rangeStepperButton,
                      !canMoveSelectionEndLater && styles.rangeStepperButtonDisabled,
                      pressed && canMoveSelectionEndLater && styles.rangeStepperButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeStepperButtonText,
                        !canMoveSelectionEndLater && styles.rangeStepperButtonTextDisabled,
                      ]}
                    >
                      종료 +10분
                    </Text>
                  </Pressable>
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
                      onChangeText={(nextStartTime) => updateTimeInput(nextStartTime, timeInputEnd)}
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
                      onChangeText={(nextEndTime) => updateTimeInput(timeInputStart, nextEndTime)}
                      placeholder="HH:mm"
                      style={[styles.timeInput, timeInputError && styles.timeInputInvalid]}
                      value={timeInputEnd}
                    />
                  </View>
                </View>
                {timeInputError ? (
                  <Text style={styles.timeInputError}>{timeInputError}</Text>
                ) : null}
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
                      onPress={() => void applyCategoryToSelection(category.id)}
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

      <Modal
        animationType="slide"
        onRequestClose={closeEntryEditor}
        transparent
        visible={editingEntryDraft !== null}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={closeEntryEditor} />
          <View style={styles.categoryDrawer}>
            <ScrollView
              contentContainerStyle={styles.categoryDrawerContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.categoryPaletteHeader}>
                <View>
                  <Text style={styles.categoryPaletteTitle}>기록 편집</Text>
                  <Text style={styles.categoryPaletteRange}>{formatMonthDay(selectedDate)}</Text>
                </View>
              </View>

              {editingEntryDraft ? (
                <>
                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.timeInputLabel}>시작</Text>
                      <TextInput
                        accessibilityLabel="편집 시작 시간"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        onChangeText={(startTime) => updateEditingEntryDraft({ startTime })}
                        placeholder="HH:mm"
                        style={[
                          styles.timeInput,
                          editValidationErrorMessage && styles.timeInputInvalid,
                        ]}
                        value={editingEntryDraft.startTime}
                      />
                    </View>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.timeInputLabel}>종료</Text>
                      <TextInput
                        accessibilityLabel="편집 종료 시간"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        onChangeText={(endTime) => updateEditingEntryDraft({ endTime })}
                        placeholder="HH:mm"
                        style={[
                          styles.timeInput,
                          editValidationErrorMessage && styles.timeInputInvalid,
                        ]}
                        value={editingEntryDraft.endTime}
                      />
                    </View>
                  </View>

                  <View style={styles.editFieldGroup}>
                    <Text style={styles.timeInputLabel}>카테고리</Text>
                    <View style={styles.categoryButtonList}>
                      {categoryPaletteItems.map((category) => {
                        const isSelected = category.id === editingEntryDraft.categoryId;

                        return (
                          <Pressable
                            key={category.id}
                            accessibilityRole="button"
                            onPress={() => updateEditingEntryDraft({ categoryId: category.id })}
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
                      onChangeText={(note) => updateEditingEntryDraft({ note })}
                      placeholder="메모"
                      style={[styles.timeInput, styles.noteInput]}
                      value={editingEntryDraft.note}
                    />
                  </View>

                  <View style={styles.editFieldGroup}>
                    <Text style={styles.timeInputLabel}>사진</Text>
                    {renderEntryPhotoReferenceList(
                      dayPhotosLoadState,
                      dayPhotos.length,
                      dayPhotosPermissionScope,
                      dayPhotosErrorMessage,
                      editingEntryPhotoReferences,
                      photoReferenceActionState,
                      hideEditingPhotoReference,
                      unlinkEditingPhotoReference,
                    )}
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
                          onPress={() => setIsDeleteConfirmVisible(false)}
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
                          onPress={() => void deleteEditedEntry()}
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
                      onPress={requestDeleteEditedEntry}
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
                      onPress={closeEntryEditor}
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
                      onPress={() => void saveEditedEntry()}
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
    </Screen>
  );
}

function loadSelectedDateData(date: DateString): Promise<[TimeEntry[], Category[]]> {
  return Promise.all([
    listMobileTimeEntriesByDate(date),
    listMobileCategories({ includeArchived: true }),
  ]);
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

function getEntryEditValidationError(
  blocks: readonly WeekGridBlock[],
  draft: EntryEditDraft,
  categories: readonly Category[],
): string | null {
  const rangeResult = createTimeRangeSelectionFromTimes(blocks, draft.startTime, draft.endTime);

  if (!rangeResult.isValid) {
    return rangeResult.errorMessage;
  }

  if (!categories.some((category) => category.id === draft.categoryId && !category.deletedAt)) {
    return '카테고리를 선택해주세요.';
  }

  return null;
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

function renderDayStateBanner(state: DayEntriesLoadState) {
  if (state === 'loading' || state === 'idle') {
    return <Text style={styles.dayStateBanner}>기록을 불러오고 있습니다.</Text>;
  }

  if (state === 'unconfigured') {
    return <Text style={styles.dayStateBanner}>서버 연결 전이라 기록 저장을 대기합니다.</Text>;
  }

  if (state === 'error') {
    return (
      <Text style={[styles.dayStateBanner, styles.dayStateBannerError]}>
        네트워크 또는 서버 오류로 기록을 불러오지 못했습니다.
      </Text>
    );
  }

  return null;
}

function renderDayPhotoStateBanner(
  state: DayPhotosLoadState,
  photoCount: number,
  permissionScope: string | null,
  errorMessage: string | null,
) {
  if (state === 'loading' || state === 'idle') {
    return <Text style={styles.photoStateBanner}>사진 단서를 확인하고 있습니다.</Text>;
  }

  if (state === 'disabled') {
    return null;
  }

  if (state === 'permission-denied') {
    return (
      <Text style={styles.photoStateBanner}>
        사진 접근 권한이 없어 사진 단서를 표시하지 않습니다.
      </Text>
    );
  }

  if (state === 'error') {
    return (
      <Text style={[styles.photoStateBanner, styles.dayStateBannerError]}>
        {errorMessage ?? '사진을 불러오지 못했습니다.'}
      </Text>
    );
  }

  if (permissionScope === 'limited') {
    return (
      <Text style={styles.photoStateBanner}>
        제한 권한으로 허용된 사진 {photoCount}개를 확인했습니다.
      </Text>
    );
  }

  return <Text style={styles.photoStateBanner}>이 날짜 사진 {photoCount}개를 확인했습니다.</Text>;
}

function renderThumbnailSyncStateBanner(errorMessage: string | null) {
  if (!errorMessage) {
    return null;
  }

  return (
    <Text style={[styles.photoStateBanner, styles.dayStateBannerError]}>
      썸네일 동기화 실패: {errorMessage}
    </Text>
  );
}

function renderEntryPhotoLookupContent(
  state: DayPhotosLoadState,
  photoCount: number,
  permissionScope: string | null,
  errorMessage: string | null,
) {
  if (state === 'loading' || state === 'idle') {
    return <Text style={styles.entryPhotoStatus}>사진을 확인하고 있습니다.</Text>;
  }

  if (state === 'disabled') {
    return <Text style={styles.entryPhotoStatus}>설정에서 사진 매칭이 꺼져 있습니다.</Text>;
  }

  if (state === 'permission-denied') {
    return <Text style={styles.entryPhotoStatus}>사진 접근 권한이 없습니다.</Text>;
  }

  if (state === 'error') {
    return (
      <Text style={[styles.entryPhotoStatus, styles.entryPhotoStatusError]}>
        {errorMessage ?? '사진을 불러오지 못했습니다.'}
      </Text>
    );
  }

  return (
    <Text style={styles.entryPhotoStatus}>
      {permissionScope === 'limited' ? '허용된 사진' : '이 날짜 사진'} {photoCount}개
    </Text>
  );
}

function renderEntryPhotoReferenceList(
  state: DayPhotosLoadState,
  photoCount: number,
  permissionScope: string | null,
  errorMessage: string | null,
  references: readonly PhotoReference[],
  actionState: PhotoReferenceActionState,
  onHidePhoto: (photoId: string) => Promise<void>,
  onUnlinkPhoto: (photoId: string) => Promise<void>,
) {
  const status = renderEntryPhotoLookupContent(state, photoCount, permissionScope, errorMessage);
  const isActionDisabled = actionState === 'saving';

  if (state !== 'ready') {
    return status;
  }

  if (references.length === 0) {
    return (
      <View style={styles.entryPhotoDetailBox}>
        {status}
        <Text style={styles.entryPhotoEmptyText}>이 기록 시간대에 연결된 사진이 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.entryPhotoDetailBox}>
      {status}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.entryPhotoDetailList}
      >
        {references.map((reference, index) => (
          <View key={reference.id} style={styles.entryPhotoDetailItem}>
            {reference.thumbnailLocalUri ? (
              <Image
                accessibilityLabel={`연결 사진 ${index + 1}`}
                source={{ uri: reference.thumbnailLocalUri }}
                style={styles.entryPhotoDetailImage}
              />
            ) : (
              <View style={styles.entryPhotoDetailFallback}>
                <Text style={styles.entryPhotoDetailFallbackText}>사진</Text>
              </View>
            )}
            <Text style={styles.entryPhotoDetailTime}>
              {formatPhotoCapturedTime(reference.capturedAt)}
            </Text>
            <View style={styles.entryPhotoActionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isActionDisabled }}
                disabled={isActionDisabled}
                onPress={() => void onUnlinkPhoto(reference.id)}
                style={({ pressed }) => [
                  styles.entryPhotoActionButton,
                  isActionDisabled && styles.entryPhotoActionButtonDisabled,
                  pressed && !isActionDisabled && styles.entryPhotoActionButtonPressed,
                ]}
              >
                <Text style={styles.entryPhotoActionButtonText}>연결 해제</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isActionDisabled }}
                disabled={isActionDisabled}
                onPress={() => void onHidePhoto(reference.id)}
                style={({ pressed }) => [
                  styles.entryPhotoActionButton,
                  styles.entryPhotoHideButton,
                  isActionDisabled && styles.entryPhotoActionButtonDisabled,
                  pressed && !isActionDisabled && styles.entryPhotoActionButtonPressed,
                ]}
              >
                <Text style={[styles.entryPhotoActionButtonText, styles.entryPhotoHideButtonText]}>
                  숨김
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function renderBlockPhotoIndicator(references: readonly PhotoReference[]) {
  if (references.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.blockPhotoIndicator}>
      <Text style={styles.blockPhotoIndicatorText}>
        {formatCompactPhotoCount(references.length)}
      </Text>
    </View>
  );
}

function renderEntryListContent(
  state: DayEntriesLoadState,
  items: readonly DailyEntryListItem[],
  photoReferencesByEntryId: ReadonlyMap<string, readonly PhotoReference[]>,
  onEntryPress: (entryId: string) => void,
) {
  if (state === 'loading' || state === 'idle') {
    return <Text style={styles.entryListStatus}>기록 목록을 불러오고 있습니다.</Text>;
  }

  if (state === 'unconfigured') {
    return (
      <Text style={styles.entryListStatus}>서버 연결 전이라 기록 목록을 표시하지 않습니다.</Text>
    );
  }

  if (state === 'error') {
    return <Text style={styles.entryListStatus}>기록 목록을 불러오지 못했습니다.</Text>;
  }

  if (items.length === 0) {
    return <Text style={styles.entryListStatus}>이 날짜에는 아직 기록이 없습니다.</Text>;
  }

  return (
    <View style={styles.entryCardList}>
      {items.map((item) => {
        const references = photoReferencesByEntryId.get(item.id) ?? [];

        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onEntryPress(item.id)}
            style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}
          >
            <View style={[styles.entryColorBar, { backgroundColor: item.categoryColor }]} />
            <View style={styles.entryCardBody}>
              <View style={styles.entryCardHeader}>
                <Text style={styles.entryTime}>{item.timeRangeLabel}</Text>
                <Text style={styles.entryDuration}>{formatDuration(item.durationMinutes)}</Text>
              </View>
              <Text style={styles.entryCategory}>
                {item.categoryEmoji} {item.categoryName}
              </Text>
              {item.note ? <Text style={styles.entryNote}>{item.note}</Text> : null}
              {renderEntryPhotoPreview(references)}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function renderEntryPhotoPreview(references: readonly PhotoReference[]) {
  if (references.length === 0) {
    return null;
  }

  const thumbnailReferences = references
    .filter((reference) => reference.thumbnailLocalUri)
    .slice(0, MAX_ENTRY_THUMBNAILS);
  const remainingCount = references.length - thumbnailReferences.length;

  return (
    <View style={styles.entryPhotoPreviewRow}>
      {thumbnailReferences.map((reference, index) => (
        <Image
          key={reference.id}
          accessibilityLabel={`기록 사진 썸네일 ${index + 1}`}
          source={{ uri: reference.thumbnailLocalUri ?? '' }}
          style={styles.entryPhotoPreviewImage}
        />
      ))}
      {thumbnailReferences.length === 0 ? (
        <Text style={styles.entryPhotoCountBadge}>사진 {references.length}개</Text>
      ) : null}
      {remainingCount > 0 ? (
        <Text style={styles.entryPhotoCountBadge}>+{remainingCount}</Text>
      ) : null}
    </View>
  );
}

function groupVisiblePhotoReferencesByEntryId(
  references: readonly PhotoReference[],
): Map<string, PhotoReference[]> {
  const referencesByEntryId = new Map<string, PhotoReference[]>();

  for (const reference of references) {
    if (!reference.entryId || reference.isHidden || reference.deletedAt) {
      continue;
    }

    const currentReferences = referencesByEntryId.get(reference.entryId) ?? [];
    currentReferences.push(reference);
    referencesByEntryId.set(reference.entryId, currentReferences);
  }

  return referencesByEntryId;
}

function getLocalDateString(date = new Date()): DateString {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
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

function formatCompactPhotoCount(photoCount: number): string {
  return photoCount > 9 ? '9+' : String(photoCount);
}

function formatPhotoCapturedTime(capturedAt: string): string {
  const timeText = capturedAt.includes('T') ? capturedAt.split('T')[1]?.slice(0, 5) : null;

  return timeText && /^\d{2}:\d{2}$/.test(timeText) ? timeText : '시간 미상';
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  headerTitleCopy: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  headerMenuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  headerMenuButtonText: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '900',
    lineHeight: 20,
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
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  dateButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  dateButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  dateButtonText: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '900',
  },
  todayDateButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  todayDateButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  todayDateButtonDisabled: {
    backgroundColor: theme.color.surfaceMuted,
  },
  todayDateButtonText: {
    color: theme.color.surface,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  todayDateButtonTextDisabled: {
    color: theme.color.textMuted,
  },
  dailySummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  summaryMetric: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 72,
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.md,
  },
  summaryMetricLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  summaryMetricValue: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
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
  dayStateBanner: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  dayStateBannerError: {
    borderColor: theme.color.danger,
    color: theme.color.danger,
  },
  photoStateBanner: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  dayGrid: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    marginBottom: theme.spacing.lg,
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
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 2,
    backgroundColor: theme.color.surfaceMuted,
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
    fontWeight: '900',
    lineHeight: 10,
  },
  selectedBlock: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.primary,
  },
  entryListSection: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  entryListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  entryListTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '900',
  },
  entryListCount: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  entryListStatus: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    padding: theme.spacing.lg,
  },
  entryCardList: {
    gap: theme.spacing.sm,
  },
  entryCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  entryCardPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  entryColorBar: {
    width: 6,
  },
  entryCardBody: {
    flex: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  entryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  entryTime: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '900',
  },
  entryDuration: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  entryCategory: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '800',
    lineHeight: 20,
  },
  entryNote: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  entryPhotoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  entryPhotoPreviewImage: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceMuted,
  },
  entryPhotoCountBadge: {
    minHeight: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceMuted,
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
    lineHeight: 26,
    paddingHorizontal: theme.spacing.sm,
  },
  entryPhotoStatus: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    padding: theme.spacing.md,
  },
  entryPhotoStatusError: {
    borderColor: theme.color.danger,
    color: theme.color.danger,
  },
  entryPhotoDetailBox: {
    gap: theme.spacing.sm,
  },
  entryPhotoEmptyText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  entryPhotoDetailList: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  entryPhotoDetailItem: {
    width: 112,
    gap: theme.spacing.xs,
  },
  entryPhotoDetailImage: {
    width: 112,
    height: 112,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
  },
  entryPhotoDetailFallback: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
  },
  entryPhotoDetailFallbackText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  entryPhotoDetailTime: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '800',
    textAlign: 'center',
  },
  entryPhotoActionRow: {
    gap: theme.spacing.xs,
  },
  entryPhotoActionButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.sm,
  },
  entryPhotoActionButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  entryPhotoActionButtonDisabled: {
    opacity: 0.48,
  },
  entryPhotoActionButtonText: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontWeight: '800',
    textAlign: 'center',
  },
  entryPhotoHideButton: {
    borderColor: theme.color.danger,
  },
  entryPhotoHideButtonText: {
    color: theme.color.danger,
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
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    maxHeight: '92%',
  },
  categoryDrawerContent: {
    gap: theme.spacing.md,
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
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.sm,
  },
  rangeStepperButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  rangeStepperButtonDisabled: {
    backgroundColor: theme.color.surfaceMuted,
    opacity: 0.62,
  },
  rangeStepperButtonText: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  timeInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
    paddingHorizontal: theme.spacing.md,
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
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
    padding: theme.spacing.md,
  },
  categoryEmptyTitle: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '900',
  },
  categoryEmptyDescription: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  categoryButton: {
    minHeight: 48,
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
  categoryButtonDisabled: {
    opacity: 0.42,
  },
  categoryButtonText: {
    color: theme.color.surface,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontWeight: '800',
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
    borderWidth: 1,
    borderColor: theme.color.danger,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
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
    fontWeight: '900',
    textAlign: 'center',
  },
  deleteConfirmBox: {
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.color.danger,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.md,
  },
  deleteConfirmTitle: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryActionButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  secondaryActionButtonText: {
    color: theme.color.text,
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontWeight: '900',
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
