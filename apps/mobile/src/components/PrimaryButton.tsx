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
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
  },
  primary: {
    backgroundColor: 'transparent',
  },
  primaryPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  secondaryPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  label: {
    color: theme.color.primary,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  secondaryLabel: {
    color: theme.color.textMuted,
  },
});
