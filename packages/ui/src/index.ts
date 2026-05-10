export const uiTokens = {
  color: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F7F7F8',
    text: '#111111',
    textMuted: '#6E6E73',
    border: '#E5E5EA',
    primary: '#2F6F5E',
    primaryPressed: '#245747',
    accent: '#EAF3F0',
    danger: '#D70015',
    overlay: 'rgba(0, 0, 0, 0.08)',
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
    sm: 6,
    md: 8,
  },
  typography: {
    title: 30,
    heading: 22,
    body: 16,
    caption: 13,
  },
} as const;

export type UiTokens = typeof uiTokens;
