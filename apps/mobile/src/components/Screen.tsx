import { type PropsWithChildren, type Ref } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  scrollEnabled?: boolean;
  scrollEventThrottle?: number;
  scrollViewRef?: Ref<ScrollView>;
  contentStyle?: ViewStyle;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}>;

export function Screen({
  children,
  scroll = true,
  scrollEnabled = true,
  scrollEventThrottle,
  scrollViewRef,
  contentStyle,
  onScroll,
}: ScreenProps) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          onScroll={onScroll}
          scrollEnabled={scrollEnabled}
          scrollEventThrottle={scrollEventThrottle}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
});
