import { Tabs } from 'expo-router';

import { theme } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.textMuted,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.caption,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen name="today" options={{ title: '오늘' }} />
      <Tabs.Screen name="week" options={{ title: '주간' }} />
      <Tabs.Screen name="review" options={{ title: '회고' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
