import { useEffectiveScheme } from './theme-preference';

// Mirrors the desktop app's theme (artifacts/time-tracker/src/index.css),
// converted from HSL CSS variables to hex. Keep these two in sync if the
// desktop theme changes.

export type ThemeColors = {
  background: string;
  foreground: string;
  border: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
};

export const colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#fbfaf9',
    foreground: '#1f292e',
    border: '#e8e6e3',
    card: '#ffffff',
    cardForeground: '#1f292e',
    primary: '#0d7373',
    primaryForeground: '#ffffff',
    secondary: '#eeece8',
    secondaryForeground: '#1f292e',
    muted: '#f1f0ee',
    mutedForeground: '#67777e',
    accent: '#f49d25',
    accentForeground: '#ffffff',
    destructive: '#ef4343',
    destructiveForeground: '#ffffff',
  },
  dark: {
    background: '#0e161b',
    foreground: '#f7f5f3',
    border: '#253137',
    card: '#131c20',
    cardForeground: '#f7f5f3',
    primary: '#14b8b8',
    primaryForeground: '#0e161b',
    secondary: '#253137',
    secondaryForeground: '#f7f5f3',
    muted: '#1f292e',
    mutedForeground: '#9da9af',
    accent: '#f49d25',
    accentForeground: '#ffffff',
    destructive: '#7c1d1d',
    destructiveForeground: '#ffffff',
  },
};

// The desktop app's --font-sans stack resolves to the system font on iOS.
export const fontFamily = undefined; // undefined = React Native's default (San Francisco on iOS)

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

export function useThemeColors(): ThemeColors {
  const scheme = useEffectiveScheme();
  return scheme === 'dark' ? colors.dark : colors.light;
}
