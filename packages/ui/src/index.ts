export const uiTokens = {
  color: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF3F1',
    text: '#17211B',
    textMuted: '#627168',
    border: '#D8E0DC',
    primary: '#236C5C',
    primaryPressed: '#195246',
    accent: '#D9824B',
    danger: '#B23A48',
    overlay: 'rgba(23, 33, 27, 0.08)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
  },
  typography: {
    title: 32,
    heading: 22,
    body: 16,
    caption: 13,
  },
} as const;

export type UiTokens = typeof uiTokens;
