import { type PhotoReference } from '@weekly/domain';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';
import { type DayEntriesLoadState } from '@/todayScreenTypes';
import { formatDuration, type DailyEntryListItem } from '@/todayViewModel';

const MAX_ENTRY_THUMBNAILS = 3;

type TodayEntryListProps = {
  state: DayEntriesLoadState;
  items: readonly DailyEntryListItem[];
  entryCount: number;
  photoReferencesByEntryId: ReadonlyMap<string, readonly PhotoReference[]>;
  onEntryPress: (entryId: string) => void;
};

export function TodayEntryList({
  state,
  items,
  entryCount,
  photoReferencesByEntryId,
  onEntryPress,
}: TodayEntryListProps) {
  return (
    <View style={styles.entryListSection}>
      <View style={styles.entryListHeader}>
        <Text style={styles.entryListTitle}>세션 목록</Text>
        <Text style={styles.entryListCount}>{entryCount}개</Text>
      </View>

      <EntryListContent
        state={state}
        items={items}
        photoReferencesByEntryId={photoReferencesByEntryId}
        onEntryPress={onEntryPress}
      />
    </View>
  );
}

function EntryListContent({
  state,
  items,
  photoReferencesByEntryId,
  onEntryPress,
}: Omit<TodayEntryListProps, 'entryCount'>) {
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
              <EntryPhotoPreview references={references} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function EntryPhotoPreview({ references }: { references: readonly PhotoReference[] }) {
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

const styles = StyleSheet.create({
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
    fontWeight: '600',
  },
  entryListCount: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  entryListStatus: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    paddingVertical: theme.spacing.md,
  },
  entryCardList: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  entryCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  entryCardPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  entryColorBar: {
    width: 4,
  },
  entryCardBody: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    paddingLeft: theme.spacing.md,
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
    fontWeight: '600',
  },
  entryDuration: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  entryCategory: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '500',
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
    fontWeight: '500',
    lineHeight: 26,
    paddingHorizontal: theme.spacing.sm,
  },
});
