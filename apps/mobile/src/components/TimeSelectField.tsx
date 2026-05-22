import { type TimeString } from '@weekly/domain';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';
import { createTimeHourOptions, createTimeMinuteOptions } from '@/components/TimeSelectOptions';

const TIME_HOUR_OPTIONS = createTimeHourOptions();
const TIME_MINUTE_OPTIONS = createTimeMinuteOptions();

type TimeSelectFieldProps = {
  label: string;
  value: TimeString;
  options: readonly TimeString[];
  disabled?: boolean;
  invalid?: boolean;
  accessibilityLabel: string;
  onChange: (value: TimeString) => void;
};

export function TimeSelectField({
  label,
  value,
  options,
  disabled = false,
  invalid = false,
  accessibilityLabel,
  onChange,
}: TimeSelectFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const optionSet = useMemo(() => new Set(options), [options]);
  const selectedHour = value.slice(0, 2);
  const selectedMinute = value.slice(3, 5);

  function selectPart(part: 'hour' | 'minute', nextValue: string) {
    const nextTime = `${part === 'hour' ? nextValue : selectedHour}:${
      part === 'minute' ? nextValue : selectedMinute
    }`;

    if (optionSet.has(nextTime)) {
      onChange(nextTime);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: isExpanded }}
        disabled={disabled}
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.button,
          invalid && styles.buttonInvalid,
          disabled && styles.buttonDisabled,
          pressed && !disabled && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.value, disabled && styles.valueDisabled]}>{value}</Text>
        <Text style={[styles.chevron, disabled && styles.valueDisabled]}>
          {isExpanded ? '접기' : '선택'}
        </Text>
      </Pressable>
      {isExpanded && !disabled ? (
        <View style={styles.optionPanel}>
          <TimePartColumn
            label="시"
            options={TIME_HOUR_OPTIONS}
            selectedValue={selectedHour}
            isOptionEnabled={(hour) => optionSet.has(`${hour}:${selectedMinute}`)}
            onSelect={(hour) => selectPart('hour', hour)}
          />
          <TimePartColumn
            label="분"
            options={TIME_MINUTE_OPTIONS}
            selectedValue={selectedMinute}
            isOptionEnabled={(minute) => optionSet.has(`${selectedHour}:${minute}`)}
            onSelect={(minute) => selectPart('minute', minute)}
          />
        </View>
      ) : null}
    </View>
  );
}

function TimePartColumn({
  label,
  options,
  selectedValue,
  isOptionEnabled,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  selectedValue: string;
  isOptionEnabled: (value: string) => boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.partColumn}>
      <Text style={styles.partColumnLabel}>{label}</Text>
      <ScrollView
        nestedScrollEnabled
        style={styles.optionList}
        contentContainerStyle={styles.optionListContent}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => {
          const isSelected = option === selectedValue;
          const isEnabled = isOptionEnabled(option);

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isEnabled, selected: isSelected }}
              disabled={!isEnabled}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [
                styles.optionButton,
                isSelected && styles.optionButtonSelected,
                !isEnabled && styles.optionButtonDisabled,
                pressed && isEnabled && styles.optionButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                  !isEnabled && styles.optionTextDisabled,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.md,
  },
  buttonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  buttonInvalid: {
    borderColor: theme.color.danger,
  },
  value: {
    color: theme.color.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  valueDisabled: {
    color: theme.color.textMuted,
  },
  chevron: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  optionPanel: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  partColumn: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  partColumnLabel: {
    color: theme.color.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  optionList: {
    maxHeight: 176,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
  },
  optionListContent: {
    paddingVertical: theme.spacing.xs,
  },
  optionButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  optionButtonPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  optionButtonDisabled: {
    opacity: 0.34,
  },
  optionButtonSelected: {
    backgroundColor: theme.color.primary,
  },
  optionText: {
    color: theme.color.text,
    fontSize: theme.typography.caption,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: theme.color.surface,
    fontWeight: '700',
  },
  optionTextDisabled: {
    color: theme.color.textMuted,
  },
});
