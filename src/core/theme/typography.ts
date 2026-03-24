import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  displayLarge: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  displayMedium: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  stat: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  statLarge: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -2,
  },
  statSmall: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
};
