import { StyleSheet, Text } from 'react-native';

import { theme } from '@/theme';
import { type DayEntriesLoadState, type DayPhotosLoadState } from '@/todayScreenTypes';

type TodayStatusBannersProps = {
  dayEntriesLoadState: DayEntriesLoadState;
  dayPhotosLoadState: DayPhotosLoadState;
  dayPhotosPermissionScope: string | null;
  dayPhotosErrorMessage: string | null;
  thumbnailSyncErrorMessage: string | null;
};

export function TodayStatusBanners({
  dayEntriesLoadState,
  dayPhotosLoadState,
  dayPhotosPermissionScope,
  dayPhotosErrorMessage,
  thumbnailSyncErrorMessage,
}: TodayStatusBannersProps) {
  return (
    <>
      <DayStateBanner state={dayEntriesLoadState} />
      <DayPhotoStateBanner
        state={dayPhotosLoadState}
        permissionScope={dayPhotosPermissionScope}
        errorMessage={dayPhotosErrorMessage}
      />
      <ThumbnailSyncStateBanner errorMessage={thumbnailSyncErrorMessage} />
    </>
  );
}

function DayStateBanner({ state }: { state: DayEntriesLoadState }) {
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

function DayPhotoStateBanner({
  state,
  permissionScope,
  errorMessage,
}: {
  state: DayPhotosLoadState;
  permissionScope: string | null;
  errorMessage: string | null;
}) {
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
    return null;
  }

  return null;
}

function ThumbnailSyncStateBanner({ errorMessage }: { errorMessage: string | null }) {
  if (!errorMessage) {
    return null;
  }

  return (
    <Text style={[styles.photoStateBanner, styles.dayStateBannerError]}>
      썸네일 동기화 실패: {errorMessage}
    </Text>
  );
}

const styles = StyleSheet.create({
  dayStateBanner: {
    borderWidth: 0,
    borderLeftWidth: 3,
    borderColor: theme.color.border,
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  dayStateBannerError: {
    borderColor: theme.color.danger,
    color: theme.color.danger,
  },
  photoStateBanner: {
    borderWidth: 0,
    borderLeftWidth: 3,
    borderColor: theme.color.border,
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
});
