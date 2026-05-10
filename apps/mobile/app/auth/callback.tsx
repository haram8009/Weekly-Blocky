import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { errorMessage, status } = useMobileAuth();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/today');
    }
  }, [router, status]);

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>이메일 확인 중</Text>
        <Text style={styles.description}>
          확인 링크를 앱으로 연결하고 있습니다. 잠시 후 오늘 기록 화면으로 이동합니다.
        </Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {status !== 'loading' && status !== 'authenticated' ? (
          <PrimaryButton label="로그인으로 돌아가기" onPress={() => router.replace('/login')} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  content: {
    gap: theme.spacing.lg,
  },
  title: {
    color: theme.color.text,
    fontSize: theme.typography.heading,
    fontWeight: '900',
    lineHeight: 30,
  },
  description: {
    color: theme.color.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
