import { getWeekStartDate, type WeekReview } from '@weekly/domain';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { getMobileWeekReviewByWeekStartDate } from '@/lib/supabase/weekReviews';
import { theme } from '@/theme';

type WeekReviewLoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function ReviewScreen() {
  const [weekReview, setWeekReview] = useState<WeekReview | null>(null);
  const [loadState, setLoadState] = useState<WeekReviewLoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const weekStartDate = getWeekStartDate(getLocalDateString(), 'monday');
  const loadWeekReview = useCallback(() => {
    setLoadState('loading');
    setErrorMessage(null);

    getMobileWeekReviewByWeekStartDate(weekStartDate)
      .then((nextWeekReview) => {
        setWeekReview(nextWeekReview);
        setLoadState('ready');
      })
      .catch((error) => {
        setWeekReview(null);
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : '주간 회고를 불러오지 못했습니다.',
        );
      });
  }, [weekStartDate]);

  useEffect(() => {
    loadWeekReview();
  }, [loadWeekReview]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>회고</Text>
        <Text style={styles.title}>주간 회고</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이번 주 합계</Text>
        <Text style={styles.sectionText}>카테고리별 합계와 회고 입력이 이 화면에 연결됩니다.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>서버 회고</Text>
        {renderWeekReviewContent({
          errorMessage,
          loadState,
          onRetry: loadWeekReview,
          weekReview,
        })}
      </View>
    </Screen>
  );
}

function renderWeekReviewContent({
  errorMessage,
  loadState,
  onRetry,
  weekReview,
}: {
  errorMessage: string | null;
  loadState: WeekReviewLoadState;
  onRetry: () => void;
  weekReview: WeekReview | null;
}) {
  if (loadState === 'idle' || loadState === 'loading') {
    return <Text style={styles.sectionText}>회고를 불러오고 있습니다.</Text>;
  }

  if (loadState === 'error') {
    return (
      <View style={styles.statusBlock}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <PrimaryButton label="다시 시도" onPress={onRetry} variant="secondary" />
      </View>
    );
  }

  if (!weekReview) {
    return <Text style={styles.sectionText}>이번 주 회고가 아직 없습니다.</Text>;
  }

  return (
    <View style={styles.reviewFields}>
      <Text style={styles.sectionText}>요약: {weekReview.summary || '-'}</Text>
      <Text style={styles.sectionText}>잘한 점: {weekReview.wins || '-'}</Text>
      <Text style={styles.sectionText}>아쉬운 점: {weekReview.problems || '-'}</Text>
      <Text style={styles.sectionText}>다음 주 집중: {weekReview.nextWeekFocus || '-'}</Text>
    </View>
  );
}

function getLocalDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
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
  section: {
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '800',
  },
  sectionText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  statusBlock: {
    gap: theme.spacing.md,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  reviewFields: {
    gap: theme.spacing.xs,
  },
});
