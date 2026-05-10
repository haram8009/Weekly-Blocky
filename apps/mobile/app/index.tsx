import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

export default function StartScreen() {
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.productName}>Weekly</Text>
        <Text style={styles.title}>10분 단위로 보는 이번 주</Text>
        <Text style={styles.description}>
          모바일에서 기록하고 데스크톱에서 같은 흐름을 확인합니다. 사진 원본은 자동 업로드하지
          않습니다.
        </Text>
      </View>

      <View style={styles.actions}>
        <Link href="/login" replace asChild>
          <PrimaryButton label="시작하기" />
        </Link>
        <Link href="/login" replace asChild>
          <PrimaryButton label="로그인" variant="secondary" />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    gap: theme.spacing.xxl,
  },
  header: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  productName: {
    color: theme.color.primary,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  title: {
    color: theme.color.text,
    fontSize: theme.typography.title,
    fontWeight: '900',
    lineHeight: 40,
  },
  description: {
    color: theme.color.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 25,
  },
  actions: {
    gap: theme.spacing.md,
  },
});
