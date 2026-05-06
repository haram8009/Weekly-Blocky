import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { theme } from '@/theme';

type PrimaryButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({ label, variant = 'primary', style, ...props }: PrimaryButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        state.pressed && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.label, !isPrimary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.color.primary,
  },
  primaryPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  secondary: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderWidth: 1,
  },
  secondaryPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  label: {
    color: theme.color.surface,
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: theme.color.text,
  },
});
