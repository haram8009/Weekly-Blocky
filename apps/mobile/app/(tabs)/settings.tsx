import { useState } from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppSettings } from '@weekly/domain';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ensureMobileDefaultSettings, getMobileSettings } from '@/lib/supabase/settings';
import { useLocalSettings } from '@/settings/LocalSettingsProvider';
import { theme } from '@/theme';

type ServerSettingsState = 'idle' | 'loading' | 'ready' | 'error';

export default function SettingsScreen() {
  const { signOut, status, user } = useMobileAuth();
  const { settings } = useLocalSettings();
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [serverSettings, setServerSettings] = useState<AppSettings | null>(null);
  const [serverSettingsState, setServerSettingsState] = useState<ServerSettingsState>('idle');
  const [serverSettingsMessage, setServerSettingsMessage] = useState<string | null>(null);

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

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
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
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
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
    fontWeight: '700',
  },
  value: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontSize: theme.typography.body,
    textAlign: 'right',
  },
  accountSection: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    marginTop: theme.spacing.lg,
  },
  accountAction: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
