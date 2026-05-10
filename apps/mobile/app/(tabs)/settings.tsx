import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useLocalSettings } from '@/settings/LocalSettingsProvider';
import { theme } from '@/theme';

export default function SettingsScreen() {
  const { signOut, user } = useMobileAuth();
  const { settings } = useLocalSettings();
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    </Screen>
  );
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
