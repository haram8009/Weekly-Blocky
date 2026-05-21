import {
  addDaysToDate,
  buildWeekGrid,
  createWeekGridTimeRangeSelection,
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
  PanResponder,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
  type ScrollView,
  type View,
} from 'react-native';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { EntryEditorDrawer } from '@/components/EntryEditorDrawer';
import { TimeRangeCategoryDrawer } from '@/components/TimeRangeCategoryDrawer';
import { TodayDailySummary } from '@/components/TodayDailySummary';
import { Screen } from '@/components/Screen';
import { TodayDateNavigator, type DatePickerMode } from '@/components/TodayDateNavigator';
import { TodayEntryList } from '@/components/TodayEntryList';
import { TodayHeader } from '@/components/TodayHeader';
import { TodayStatusBanners } from '@/components/TodayStatusBanners';
import { TodayTimeBlockGrid, type TodayHourRow } from '@/components/TodayTimeBlockGrid';
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
  type DayEntriesLoadState,
  type DayPhotosLoadState,
  type EntryEditDraft,
  type EntryEditSaveState,
  type EntrySaveState,
  type PhotoReferenceActionState,
  type SelectionDraft,
} from '@/todayScreenTypes';
import {
  createCalendarMonth,
  createCategoryPaletteItems,
  createDailyEntryListItems,
  createDailySummary,
  createWeekCalendarRows,
  resolveSelectedDate,
} from '@/todayViewModel';

const BLOCKS_PER_HOUR = 6;
const BLOCK_ROW_GAP = theme.spacing.xs;
const BLOCK_COLUMN_GAP = 2;
const LONG_PRESS_SELECTION_DELAY_MS = 300;
const LONG_PRESS_MOVE_TOLERANCE = 8;
const EDGE_AUTO_SCROLL_THRESHOLD = 80;
const EDGE_AUTO_SCROLL_MAX_STEP = 12;
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
  const datePickerRevealValue = useRef(new Animated.Value(0)).current;
  const todayDate = getLocalDateString();
  const requestedDate = useMemo(
    () => resolveSelectedDate(searchParams.date, todayDate),
    [searchParams.date, todayDate],
  );
  const [selectedDate, setSelectedDate] = useState<DateString>(requestedDate);
  const selectedDateRef = useRef<DateString>(requestedDate);
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode>(null);
  const [visibleCalendarMonthDate, setVisibleCalendarMonthDate] =
    useState<DateString>(requestedDate);
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
  const calendarMonth = useMemo(
    () =>
      createCalendarMonth({
        visibleMonthDate: visibleCalendarMonthDate,
        selectedDate,
        todayDate,
      }),
    [selectedDate, todayDate, visibleCalendarMonthDate],
  );
  const weekCalendarRows = useMemo(
    () => createWeekCalendarRows({ selectedDate, todayDate }),
    [selectedDate, todayDate],
  );
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
    selectedDateRef.current = requestedDate;
    setSelectedDate(requestedDate);
    setVisibleCalendarMonthDate(requestedDate);
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
    if (!datePickerMode) {
      datePickerRevealValue.setValue(0);
      return;
    }

    datePickerRevealValue.setValue(0);
    Animated.timing(datePickerRevealValue, {
      duration: 220,
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [datePickerMode, datePickerRevealValue]);

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
      datePickerRevealValue.stopAnimation();
    },
    [datePickerRevealValue, selectionPulseValue],
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

  function selectDate(nextDate: DateString) {
    selectedDateRef.current = nextDate;
    router.setParams({ date: nextDate });
    setSelectedDate(nextDate);
    setVisibleCalendarMonthDate(nextDate);
    setDatePickerMode(null);
  }

  function moveSelectedDate(days: number) {
    selectDate(addDaysToDate(selectedDateRef.current, days));
  }

  function moveToToday() {
    selectDate(getLocalDateString());
  }

  function openDatePicker(mode: Exclude<DatePickerMode, null>) {
    setVisibleCalendarMonthDate(selectedDate);
    setDatePickerMode(mode);
  }

  function closeDatePicker() {
    setDatePickerMode(null);
  }

  function movePickerMonth(months: number) {
    setVisibleCalendarMonthDate((currentDate) => addMonthsToDate(currentDate, months));
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
      <TodayHeader
        selectedDate={selectedDate}
        isTodaySelected={isTodaySelected}
        onOpenCategories={() => router.push('/categories')}
      />

      <TodayDateNavigator
        selectedDate={selectedDate}
        isTodaySelected={isTodaySelected}
        mode={datePickerMode}
        revealValue={datePickerRevealValue}
        calendarMonth={calendarMonth}
        weekCalendarRows={weekCalendarRows}
        onMoveSelectedDate={moveSelectedDate}
        onMoveToToday={moveToToday}
        onOpenDatePicker={openDatePicker}
        onCloseDatePicker={closeDatePicker}
        onMovePickerMonth={movePickerMonth}
        onSelectDate={selectDate}
      />

      <TodayStatusBanners
        dayEntriesLoadState={dayEntriesLoadState}
        dayPhotosLoadState={dayPhotosLoadState}
        dayPhotosPermissionScope={dayPhotosPermissionScope}
        dayPhotosErrorMessage={dayPhotosErrorMessage}
        thumbnailSyncErrorMessage={thumbnailSyncErrorMessage}
      />

      <TodayTimeBlockGrid
        hourlyRows={hourlyRows}
        entries={dayEntries}
        categoryById={categoryById}
        displayedSelection={displayedSelection}
        photoReferencesByEntryId={photoReferencesByEntryId}
        selectedBlockPulseStyle={selectedBlockPulseStyle}
        blockMatrixRef={blockMatrixRef}
        tappedSlotIndexRef={tappedSlotIndexRef}
        panHandlers={panResponder.panHandlers}
        onLayout={handleBlockGridLayout}
        onTouchCancel={handleSelectionCancel}
        onTouchEnd={handleBlockGridTouchEnd}
        onTouchMove={handleBlockGridTouchMove}
        onTouchStart={handleBlockGridTouchStart}
      />

      <TodayDailySummary
        dailySummary={dailySummary}
        dayPhotosLoadState={dayPhotosLoadState}
        dayPhotoCount={dayPhotos.length}
      />

      <TodayEntryList
        state={dayEntriesLoadState}
        items={dailyEntryItems}
        entryCount={dailySummary.entryCount}
        photoReferencesByEntryId={photoReferencesByEntryId}
        onEntryPress={openEntryEditorById}
      />

      <TimeRangeCategoryDrawer
        visible={confirmedSelection !== null}
        selectedRangeLabel={
          confirmedSelection
            ? `${confirmedSelection.startTime}-${confirmedSelection.endTime}`
            : null
        }
        timeInputStart={timeInputStart}
        timeInputEnd={timeInputEnd}
        timeInputError={timeInputError}
        categoryPaletteItems={categoryPaletteItems}
        canApplySelectedRange={canApplySelectedRange}
        canMoveSelectionStartEarlier={canMoveSelectionStartEarlier}
        canMoveSelectionStartLater={canMoveSelectionStartLater}
        canMoveSelectionEndEarlier={canMoveSelectionEndEarlier}
        canMoveSelectionEndLater={canMoveSelectionEndLater}
        entrySaveState={entrySaveState}
        entrySaveErrorMessage={entrySaveErrorMessage}
        onClose={clearConfirmedSelection}
        onAdjustSelection={adjustConfirmedSelection}
        onUpdateTimeInput={updateTimeInput}
        onApplyCategory={applyCategoryToSelection}
      />

      <EntryEditorDrawer
        selectedDate={selectedDate}
        draft={editingEntryDraft}
        categoryPaletteItems={categoryPaletteItems}
        editValidationErrorMessage={editValidationErrorMessage}
        editSaveErrorMessage={editSaveErrorMessage}
        editSaveState={editSaveState}
        canSaveEditedEntry={canSaveEditedEntry}
        canDeleteEditedEntry={canDeleteEditedEntry}
        isDeleteConfirmVisible={isDeleteConfirmVisible}
        dayPhotosLoadState={dayPhotosLoadState}
        dayPhotoCount={dayPhotos.length}
        dayPhotosPermissionScope={dayPhotosPermissionScope}
        dayPhotosErrorMessage={dayPhotosErrorMessage}
        editingEntryPhotoReferences={editingEntryPhotoReferences}
        photoReferenceActionState={photoReferenceActionState}
        photoReferenceActionErrorMessage={photoReferenceActionErrorMessage}
        onClose={closeEntryEditor}
        onUpdateDraft={updateEditingEntryDraft}
        onHidePhoto={hideEditingPhotoReference}
        onUnlinkPhoto={unlinkEditingPhotoReference}
        onShowDeleteConfirm={requestDeleteEditedEntry}
        onHideDeleteConfirm={() => setIsDeleteConfirmVisible(false)}
        onDelete={deleteEditedEntry}
        onSave={saveEditedEntry}
      />
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

function createHourlyRows(blocks: readonly WeekGridBlock[]): TodayHourRow[] {
  const rows: TodayHourRow[] = [];

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

function addMonthsToDate(date: DateString, months: number): DateString {
  const [yearText, monthText] = date.split('-');
  const parsedDate = new Date(Number(yearText), Number(monthText) - 1 + months, 1);

  return [parsedDate.getFullYear(), String(parsedDate.getMonth() + 1).padStart(2, '0'), '01'].join(
    '-',
  ) as DateString;
}
