import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import type { AppSettings } from '@weekly/domain';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import {
  ensureMobileDefaultSettings,
  getMobileSettings,
  updateMobileSettings,
  type UpdateSettingsInput,
} from '@/lib/supabase/settings';
import { useLocalSettings } from '@/settings/LocalSettingsProvider';
import { theme } from '@/theme';

type ServerSettingsState = 'idle' | 'loading' | 'ready' | 'error';
type PhotoPermissionState = 'idle' | 'loading' | 'ready' | 'requesting' | 'error';
type PhotoPermissionResponse = Awaited<ReturnType<typeof MediaLibrary.getPermissionsAsync>>;
type PhotoSettingsKey = 'photoMatchingEnabled' | 'thumbnailSyncEnabled';

export default function SettingsScreen() {
  const { signOut, status, user } = useMobileAuth();
  const { settings } = useLocalSettings();
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [serverSettings, setServerSettings] = useState<AppSettings | null>(null);
  const [serverSettingsState, setServerSettingsState] = useState<ServerSettingsState>('idle');
  const [serverSettingsMessage, setServerSettingsMessage] = useState<string | null>(null);
  const [photoPermission, setPhotoPermission] = useState<PhotoPermissionResponse | null>(null);
  const [photoPermissionState, setPhotoPermissionState] = useState<PhotoPermissionState>('idle');
  const [photoPermissionMessage, setPhotoPermissionMessage] = useState<string | null>(null);
  const [savingPhotoSetting, setSavingPhotoSetting] = useState<PhotoSettingsKey | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setServerSettings(null);
      setServerSettingsState('idle');
      setServerSettingsMessage(null);
      return;
    }

    let isActive = true;

    setServerSettingsState('loading');
    setServerSettingsMessage(null);

    getMobileSettings()
      .then((settingsFromServer) => settingsFromServer ?? ensureMobileDefaultSettings())
      .then((settingsFromServer) => {
        if (!isActive) {
          return;
        }

        setServerSettings(settingsFromServer);
        setServerSettingsState('ready');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setServerSettings(null);
        setServerSettingsState('error');
        setServerSettingsMessage(
          error instanceof Error ? error.message : '서버 설정을 불러오지 못했습니다.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [status]);

  const loadPhotoPermission = useCallback(() => {
    let isActive = true;

    setPhotoPermissionState('loading');
    setPhotoPermissionMessage(null);

    MediaLibrary.getPermissionsAsync()
      .then((permission) => {
        if (!isActive) {
          return;
        }

        setPhotoPermission(permission);
        setPhotoPermissionState('ready');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setPhotoPermission(null);
        setPhotoPermissionState('error');
        setPhotoPermissionMessage(
          error instanceof Error ? error.message : '사진 권한 상태를 확인하지 못했습니다.',
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => loadPhotoPermission(), [loadPhotoPermission]);

  async function handleSignOut() {
    setIsSigningOut(true);
    setAuthMessage(null);

    try {
      await signOut();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : '로그아웃에 실패했습니다.');
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleRequestPhotoPermission() {
    setPhotoPermissionState('requesting');
    setPhotoPermissionMessage(null);

    try {
      const permission = await MediaLibrary.requestPermissionsAsync();

      setPhotoPermission(permission);
      setPhotoPermissionState('ready');
    } catch (error) {
      setPhotoPermissionState('error');
      setPhotoPermissionMessage(
        error instanceof Error ? error.message : '사진 권한을 요청하지 못했습니다.',
      );
    }
  }

  async function handleOpenSystemSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      setPhotoPermissionMessage(
        error instanceof Error ? error.message : '시스템 설정을 열지 못했습니다.',
      );
    }
  }

  async function handleUpdatePhotoSetting(changes: UpdateSettingsInput, key: PhotoSettingsKey) {
    setSavingPhotoSetting(key);
    setServerSettingsMessage(null);

    try {
      const nextSettings = await updateMobileSettings(changes);

      setServerSettings(nextSettings);
      setServerSettingsState('ready');
    } catch (error) {
      setServerSettingsMessage(
        error instanceof Error ? error.message : '사진 설정을 저장하지 못했습니다.',
      );
    } finally {
      setSavingPhotoSetting(null);
    }
  }

  const photoAccessLabel = formatPhotoPermissionStatus(photoPermissionState, photoPermission);
  const photoAccessDescription = formatPhotoPermissionDescription(photoPermission);
  const photoMatchingEnabled = serverSettings?.photoMatchingEnabled ?? false;
  const thumbnailSyncEnabled = serverSettings?.thumbnailSyncEnabled ?? false;
  const isPhotoSettingsDisabled = serverSettingsState === 'loading' || savingPhotoSetting !== null;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>설정</Text>
        <Text style={styles.title}>로컬 설정</Text>
      </View>

      <View style={styles.list}>
        <View style={styles.row}>
          <Text style={styles.label}>주 시작 요일</Text>
          <Text style={styles.value}>
            {settings.weekStartDay === 'monday' ? '월요일' : '일요일'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>기본 시작 시간</Text>
          <Text style={styles.value}>{settings.defaultDayStartTime}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>시간대</Text>
          <Text style={styles.value}>기기 시간대</Text>
        </View>
      </View>

      <View style={styles.accountSection}>
        <View style={styles.row}>
          <Text style={styles.label}>로그인 이메일</Text>
          <Text style={styles.value}>{user?.email ?? '알 수 없음'}</Text>
        </View>
        <View style={styles.accountAction}>
          <PrimaryButton
            disabled={isSigningOut}
            label={isSigningOut ? '로그아웃 중' : '로그아웃'}
            onPress={() => void handleSignOut()}
            variant="secondary"
          />
          {authMessage ? <Text style={styles.errorText}>{authMessage}</Text> : null}
        </View>
      </View>

      <View style={styles.accountSection}>
        <View style={styles.row}>
          <Text style={styles.label}>서버 설정</Text>
          <Text style={styles.value}>{formatServerSettingsState(serverSettingsState)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>서버 표시 범위</Text>
          <Text style={styles.value}>
            {serverSettings
              ? `${serverSettings.visibleStartTime}-${serverSettings.visibleEndTime}`
              : '-'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>전체 보기</Text>
          <Text style={styles.value}>
            {serverSettings ? (serverSettings.useFullDayView ? '켜짐' : '꺼짐') : '-'}
          </Text>
        </View>
        {serverSettingsMessage ? (
          <View style={styles.accountAction}>
            <Text style={styles.errorText}>{serverSettingsMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.photoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>사진 권한</Text>
          <Text style={styles.statusBadge}>{photoAccessLabel}</Text>
        </View>
        <Text style={styles.helperText}>
          촬영 시각이 기록 시간 안에 들어오는 사진만 단서로 표시합니다. 사진 원본은 자동 업로드하지
          않으며, 데스크톱 웹에는 사용자가 켠 작은 썸네일만 표시할 수 있습니다.
        </Text>
        <Text style={styles.helperText}>
          권한을 거부해도 시간 기록, 수정, 삭제 기능은 그대로 사용할 수 있습니다.
        </Text>
        <Text style={styles.permissionDescription}>{photoAccessDescription}</Text>

        <View style={styles.photoActions}>
          <PrimaryButton
            disabled={photoPermissionState === 'requesting'}
            label={photoPermissionState === 'requesting' ? '요청 중' : '사진 접근 허용'}
            onPress={() => void handleRequestPhotoPermission()}
          />
          <PrimaryButton label="상태 새로고침" onPress={loadPhotoPermission} variant="secondary" />
          <PrimaryButton
            label="시스템 설정 열기"
            onPress={() => void handleOpenSystemSettings()}
            variant="secondary"
          />
        </View>

        {photoPermissionMessage ? (
          <Text style={styles.errorText}>{photoPermissionMessage}</Text>
        ) : null}

        <View style={styles.toggleList}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.label}>사진 매칭</Text>
              <Text style={styles.toggleDescription}>
                기록 시간대 사진 단서를 모바일에서 사용합니다.
              </Text>
            </View>
            <Switch
              disabled={isPhotoSettingsDisabled}
              onValueChange={(value) =>
                void handleUpdatePhotoSetting(
                  { photoMatchingEnabled: value },
                  'photoMatchingEnabled',
                )
              }
              thumbColor={photoMatchingEnabled ? theme.color.primary : theme.color.surface}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              value={photoMatchingEnabled}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.label}>썸네일 동기화</Text>
              <Text style={styles.toggleDescription}>
                켠 경우에만 작은 썸네일을 서버에 동기화할 수 있습니다.
              </Text>
            </View>
            <Switch
              disabled={isPhotoSettingsDisabled}
              onValueChange={(value) =>
                void handleUpdatePhotoSetting(
                  { thumbnailSyncEnabled: value },
                  'thumbnailSyncEnabled',
                )
              }
              thumbColor={thumbnailSyncEnabled ? theme.color.primary : theme.color.surface}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              value={thumbnailSyncEnabled}
            />
          </View>
          {savingPhotoSetting ? (
            <Text style={styles.statusText}>
              {savingPhotoSetting === 'photoMatchingEnabled'
                ? '사진 매칭 설정 저장 중'
                : '썸네일 동기화 설정 저장 중'}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function formatServerSettingsState(state: ServerSettingsState): string {
  if (state === 'loading') {
    return '불러오는 중';
  }

  if (state === 'ready') {
    return '연결됨';
  }

  if (state === 'error') {
    return '오류';
  }

  return '대기';
}

function formatPhotoPermissionStatus(
  state: PhotoPermissionState,
  permission: PhotoPermissionResponse | null,
): string {
  if (state === 'loading') {
    return '확인 중';
  }

  if (state === 'requesting') {
    return '요청 중';
  }

  if (state === 'error') {
    return '오류';
  }

  if (!permission) {
    return '요청 전';
  }

  const status = String(permission.status);
  const accessPrivileges = getAccessPrivileges(permission);

  if (status === 'granted' && accessPrivileges === 'limited') {
    return '제한됨';
  }

  if (status === 'granted') {
    return '허용됨';
  }

  if (status === 'denied') {
    return '거부됨';
  }

  return '요청 전';
}

function formatPhotoPermissionDescription(permission: PhotoPermissionResponse | null): string {
  if (!permission) {
    return '사진 기능을 쓰기 전 권한을 요청할 수 있습니다.';
  }

  const status = String(permission.status);
  const accessPrivileges = getAccessPrivileges(permission);

  if (status === 'granted' && accessPrivileges === 'limited') {
    return '제한 권한 상태입니다. 사용자가 허용한 사진만 날짜별 조회와 매칭 대상으로 사용합니다.';
  }

  if (status === 'granted') {
    return '사진 접근이 허용되었습니다. 이후 날짜별 사진 조회에서 기록 시간대 사진만 매칭합니다.';
  }

  if (status === 'denied') {
    return '사진 접근이 거부되었습니다. 기록 기능은 계속 사용할 수 있고, 필요하면 시스템 설정에서 다시 허용할 수 있습니다.';
  }

  return '아직 권한을 요청하지 않았습니다.';
}

function getAccessPrivileges(permission: PhotoPermissionResponse): string | null {
  if ('accessPrivileges' in permission && typeof permission.accessPrivileges === 'string') {
    return permission.accessPrivileges;
  }

  return null;
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: theme.spacing.lg,
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
  list: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingHorizontal: theme.spacing.lg,
  },
  label: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '500',
  },
  value: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontSize: theme.typography.body,
    textAlign: 'right',
  },
  accountSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    marginTop: theme.spacing.md,
  },
  accountAction: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  photoSection: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
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
  statusBadge: {
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  helperText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  permissionDescription: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    lineHeight: 20,
  },
  photoActions: {
    gap: theme.spacing.sm,
  },
  toggleList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
  },
  toggleRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  toggleDescription: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  statusText: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '500',
    lineHeight: 20,
    padding: theme.spacing.lg,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
