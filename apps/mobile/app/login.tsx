import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useMobileAuth } from '@/auth/MobileAuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { theme } from '@/theme';

type AuthMode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const { errorMessage: sessionErrorMessage, signIn, signUp, status } = useMobileAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === 'signUp';
  const canSubmit =
    status !== 'unconfigured' && email.trim().length > 0 && password.length >= 6 && !isSubmitting;

  async function submit() {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setMessage('회원가입을 요청했습니다. 이메일 확인이 필요한 경우 메일함을 확인해주세요.');
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '인증 요청에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <Text style={styles.productName}>Weekly</Text>
          <Text style={styles.title}>계정으로 기록을 연결합니다</Text>
          <Text style={styles.description}>
            같은 이메일 계정으로 모바일 기록과 데스크톱 주간 열람을 동기화합니다.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.modeSwitch}>
            <PrimaryButton
              label="로그인"
              onPress={() => setMode('signIn')}
              variant={isSignUp ? 'secondary' : 'primary'}
            />
            <PrimaryButton
              label="회원가입"
              onPress={() => setMode('signUp')}
              variant={isSignUp ? 'primary' : 'secondary'}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              onChangeText={setPassword}
              placeholder="6자 이상"
              secureTextEntry
              style={styles.input}
              textContentType={isSignUp ? 'newPassword' : 'password'}
              value={password}
            />
          </View>

          <PrimaryButton
            disabled={!canSubmit}
            label={isSubmitting ? '처리 중' : isSignUp ? '회원가입' : '로그인'}
            onPress={() => void submit()}
            style={!canSubmit ? styles.disabledButton : undefined}
          />

          {status === 'unconfigured' ? (
            <Text style={styles.errorText}>Supabase 환경 변수를 먼저 설정해야 합니다.</Text>
          ) : null}
          {sessionErrorMessage && status !== 'unconfigured' ? (
            <Text style={styles.errorText}>{sessionErrorMessage}</Text>
          ) : null}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  keyboardAvoidingView: {
    gap: theme.spacing.xxl,
  },
  header: {
    gap: theme.spacing.md,
  },
  productName: {
    color: theme.color.primary,
    fontSize: theme.typography.body,
    fontWeight: '800',
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
  form: {
    gap: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.lg,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  field: {
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
  },
  disabledButton: {
    opacity: 0.56,
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
  messageText: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
  },
});
