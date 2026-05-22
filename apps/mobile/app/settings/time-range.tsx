import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppSettings } from '@weekly/domain';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TimeSelectField } from '@/components/TimeSelectField';
import { createDiaryTimeOptions } from '@/components/TimeSelectOptions';
import {
  ensureMobileDefaultSettings,
  getMobileSettings,
  updateMobileSettings,
} from '@/lib/supabase/settings';
import { validateVisibleTimeSettingsDraft } from '@/settings/visibleTimeSettings';
import { theme } from '@/theme';

type ServerSettingsState = 'idle' | 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'error';

const DIARY_TIME_OPTIONS = createDiaryTimeOptions();
const VISIBLE_START_TIME_OPTIONS = DIARY_TIME_OPTIONS.slice(0, -1);
const VISIBLE_END_TIME_OPTIONS = DIARY_TIME_OPTIONS.slice(1);

export default function TimeRangeSettingsScreen() {
  const router = useRouter();
  const [serverSettings, setServerSettings] = useState<AppSettings | null>(null);
  const [serverSettingsState, setServerSettingsState] = useState<ServerSettingsState>('idle');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [visibleStartTimeDraft, setVisibleStartTimeDraft] = useState('');
  const [visibleEndTimeDraft, setVisibleEndTimeDraft] = useState('');
  const [useFullDayViewDraft, setUseFullDayViewDraft] = useState(false);

  useEffect(() => {
    let isActive = true;

    setServerSettingsState('loading');
    setMessage(null);

    getMobileSettings()
      .then((settings) => settings ?? ensureMobileDefaultSettings())
      .then((settings) => {
        if (!isActive) {
          return;
        }

        setServerSettings(settings);
        setVisibleStartTimeDraft(settings.visibleStartTime);
        setVisibleEndTimeDraft(settings.visibleEndTime);
        setUseFullDayViewDraft(settings.useFullDayView);
        setServerSettingsState('ready');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setServerSettings(null);
        setServerSettingsState('error');
        setMessage(error instanceof Error ? error.message : '서버 설정을 불러오지 못했습니다.');
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSave() {
    const validation = validateVisibleTimeSettingsDraft(visibleStartTimeDraft, visibleEndTimeDraft);

    if (!validation.isValid) {
      setSaveState('error');
      setMessage(validation.errorMessage);
      return;
    }

    setSaveState('saving');
    setMessage(null);

    try {
      const nextSettings = await updateMobileSettings({
        ...validation.input,
        useFullDayView: useFullDayViewDraft,
      });

      setServerSettings(nextSettings);
      setVisibleStartTimeDraft(nextSettings.visibleStartTime);
      setVisibleEndTimeDraft(nextSettings.visibleEndTime);
      setUseFullDayViewDraft(nextSettings.useFullDayView);
      setSaveState('idle');
      router.back();
    } catch (error) {
      setSaveState('error');
      setMessage(error instanceof Error ? error.message : '서버 설정을 저장하지 못했습니다.');
    }
  }

  const isDisabled = serverSettingsState === 'loading' || saveState === 'saving' || !serverSettings;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>설정</Text>
        <Text style={styles.title}>서버 표시 범위</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.timeInputRow}>
          <TimeSelectField
            accessibilityLabel="서버 표시 시작 시간 선택"
            disabled={isDisabled}
            invalid={saveState === 'error'}
            label="시작 시간"
            onChange={(value) => {
              setVisibleStartTimeDraft(value);
              setUseFullDayViewDraft(false);
              setMessage(null);
              setSaveState('idle');
            }}
            options={VISIBLE_START_TIME_OPTIONS}
            value={visibleStartTimeDraft}
          />
          <TimeSelectField
            accessibilityLabel="서버 표시 종료 시간 선택"
            disabled={isDisabled}
            invalid={saveState === 'error'}
            label="종료 시간"
            onChange={(value) => {
              setVisibleEndTimeDraft(value);
              setUseFullDayViewDraft(false);
              setMessage(null);
              setSaveState('idle');
            }}
            options={VISIBLE_END_TIME_OPTIONS}
            value={visibleEndTimeDraft}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={() => {
            setVisibleStartTimeDraft('00:00');
            setVisibleEndTimeDraft('24:00');
            setUseFullDayViewDraft(true);
            setMessage(null);
            setSaveState('idle');
          }}
          style={({ pressed }) => [
            styles.fullDayButton,
            isDisabled && styles.fullDayButtonDisabled,
            pressed && !isDisabled && styles.fullDayButtonPressed,
          ]}
        >
          <View style={styles.toggleCopy}>
            <Text style={styles.label}>00:00-24:00 전체 보기</Text>
            <Text style={styles.toggleDescription}>
              누르면 시작 시간과 종료 시간이 하루 전체로 맞춰집니다.
            </Text>
          </View>
          <Text style={styles.fullDayButtonText}>적용</Text>
        </Pressable>

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton
            disabled={isDisabled}
            label={saveState === 'saving' ? '저장 중' : '저장'}
            onPress={() => void handleSave()}
          />
          <PrimaryButton label="뒤로" onPress={() => router.back()} variant="secondary" />
        </View>
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
  section: {
    gap: theme.spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    paddingVertical: theme.spacing.lg,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  label: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '500',
  },
  fullDayButton: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  fullDayButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  fullDayButtonDisabled: {
    opacity: 0.56,
  },
  fullDayButtonText: {
    color: theme.color.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  toggleCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  toggleDescription: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  actions: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.lg,
  },
});
