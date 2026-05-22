import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

export default function ReviewScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>회고</Text>
        <Text style={styles.title}>AI 분석 인사이트</Text>
      </View>

      <View style={styles.insightPanel}>
        <Text style={styles.panelLabel}>후속 범위</Text>
        <Text style={styles.panelTitle}>주간 기록을 바탕으로 인사이트를 준비할 예정입니다.</Text>
        <Text style={styles.panelText}>
          색상 그룹 흐름과 요일별 점유율은 주간 탭에서 확인하고, 이곳에는 나중에 AI가 시간 사용
          패턴과 다음 주 제안을 정리해주는 화면을 넣습니다.
        </Text>
      </View>
    </Screen>
  );
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
  insightPanel: {
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
  },
  panelLabel: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  panelTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    lineHeight: 24,
  },
  panelText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
