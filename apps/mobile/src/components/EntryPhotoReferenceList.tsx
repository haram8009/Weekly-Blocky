import { type PhotoReference } from '@weekly/domain';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';
import { type DayPhotosLoadState, type PhotoReferenceActionState } from '@/todayScreenTypes';

type EntryPhotoReferenceListProps = {
  state: DayPhotosLoadState;
  photoCount: number;
  permissionScope: string | null;
  errorMessage: string | null;
  references: readonly PhotoReference[];
  actionState: PhotoReferenceActionState;
  onHidePhoto: (photoId: string) => Promise<void>;
  onUnlinkPhoto: (photoId: string) => Promise<void>;
};

export function EntryPhotoReferenceList({
  state,
  photoCount,
  permissionScope,
  errorMessage,
  references,
  actionState,
  onHidePhoto,
  onUnlinkPhoto,
}: EntryPhotoReferenceListProps) {
  const status = (
    <EntryPhotoLookupStatus
      state={state}
      photoCount={photoCount}
      permissionScope={permissionScope}
      errorMessage={errorMessage}
    />
  );
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

function EntryPhotoLookupStatus({
  state,
  photoCount,
  permissionScope,
  errorMessage,
}: {
  state: DayPhotosLoadState;
  photoCount: number;
  permissionScope: string | null;
  errorMessage: string | null;
}) {
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

function formatPhotoCapturedTime(capturedAt: string): string {
  const timeText = capturedAt.includes('T') ? capturedAt.split('T')[1]?.slice(0, 5) : null;

  return timeText && /^\d{2}:\d{2}$/.test(timeText) ? timeText : '시간 미상';
}

const styles = StyleSheet.create({
  entryPhotoStatus: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    paddingVertical: theme.spacing.sm,
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
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceMuted,
  },
  entryPhotoDetailFallbackText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  entryPhotoDetailTime: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    textAlign: 'center',
  },
  entryPhotoActionRow: {
    gap: theme.spacing.xs,
  },
  entryPhotoActionButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
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
    fontWeight: '500',
    textAlign: 'center',
  },
  entryPhotoHideButton: {
    borderColor: theme.color.danger,
  },
  entryPhotoHideButtonText: {
    color: theme.color.danger,
  },
});
