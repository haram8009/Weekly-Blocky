import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocalSettingsProvider } from '@/settings/LocalSettingsProvider';
import { theme } from '@/theme';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>화면을 불러오지 못했습니다</Text>
        <Text style={styles.fallbackMessage}>{error.message}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
          <Text style={styles.retryButtonLabel}>다시 시도</Text>
        </Pressable>
      </View>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocalSettingsProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.color.background,
            },
          }}
        />
      </LocalSettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
    backgroundColor: theme.color.background,
  },
  fallbackTitle: {
    color: theme.color.text,
    fontSize: theme.typography.heading,
    fontWeight: '800',
  },
  fallbackMessage: {
    color: theme.color.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  retryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
  },
  retryButtonLabel: {
    color: theme.color.surface,
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
});
