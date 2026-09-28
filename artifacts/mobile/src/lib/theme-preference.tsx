import * as React from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
};

const ThemePreferenceContext = React.createContext<ThemePreferenceContextValue>({
  preference: 'system',
  setPreference: () => {},
});

// The desktop app has a manual light/dark toggle in its sidebar (next-themes,
// defaulting to "system"); the mobile app only ever followed the OS setting
// with no way to override it. This mirrors that toggle — persisted so it
// survives a relaunch — and is the single source of truth every screen's
// colors and the navigation chrome (tab bar, headers, status bar) read from,
// instead of each place calling react-native's useColorScheme() separately.
export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>('system');

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved);
    });
  }, []);

  const setPreference = React.useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const value = React.useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return React.useContext(ThemePreferenceContext);
}

export function useEffectiveScheme(): Scheme {
  const { preference } = React.useContext(ThemePreferenceContext);
  const systemScheme = useColorScheme();
  if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return preference;
}
