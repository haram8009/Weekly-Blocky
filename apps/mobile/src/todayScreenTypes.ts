export type SelectionDraft = {
  anchorSlotIndex: number;
  focusSlotIndex: number;
};

export type DayEntriesLoadState = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';
export type DayPhotosLoadState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'disabled'
  | 'permission-denied'
  | 'error';
export type EntrySaveState = 'idle' | 'saving' | 'error';
export type EntryEditSaveState = 'idle' | 'saving' | 'deleting' | 'error';
export type PhotoReferenceActionState = 'idle' | 'saving' | 'error';

export type EntryEditDraft = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  categoryId: string;
  note: string;
};
