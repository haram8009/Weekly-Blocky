import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MobileAuthProvider, useMobileAuth } from '@/auth/MobileAuthProvider';
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
      <MobileAuthProvider>
        <LocalSettingsProvider>
          <AuthRouteGuard>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: theme.color.background,
                },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="categories" />
              <Stack.Screen name="settings/time-range" />
              <Stack.Screen
                name="(tabs)"
                options={{
                  gestureEnabled: false,
                }}
              />
            </Stack>
          </AuthRouteGuard>
        </LocalSettingsProvider>
      </MobileAuthProvider>
    </SafeAreaProvider>
  );
}

function AuthRouteGuard({ children }: PropsWithChildren) {
  const { status } = useMobileAuth();
  const router = useRouter();
  const segments = useSegments();
  const firstSegment = segments[0];

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const isPublicRoute = !firstSegment || firstSegment === 'login' || firstSegment === 'auth';

    if (status === 'authenticated' && isPublicRoute) {
      router.replace('/today');
      return;
    }

    if (status !== 'authenticated' && !isPublicRoute) {
      router.replace('/login');
    }
  }, [firstSegment, router, status]);

  return children;
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
    fontWeight: '700',
  },
  fallbackMessage: {
    color: theme.color.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  retryButton: {
    minHeight: 44,
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
