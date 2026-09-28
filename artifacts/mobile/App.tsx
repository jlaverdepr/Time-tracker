import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ConnectionProvider, useConnection, DEFAULT_API_URL } from './src/lib/connection';
import { colors } from './src/lib/theme';
import { ThemePreferenceProvider, useEffectiveScheme } from './src/lib/theme-preference';
import ConnectScreen from './src/screens/ConnectScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TodosScreen from './src/screens/TodosScreen';
import MoreMenuScreen from './src/screens/MoreMenuScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import GymTrackScreen from './src/screens/GymTrackScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const queryClient = new QueryClient();
const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

// 'grid-outline' mirrors the desktop sidebar's lucide "LayoutDashboard" icon
// (a 2x2 grid) — keep these in sync so the Dashboard tab reads the same on
// both platforms.
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'grid-outline',
  Calendar: 'calendar-outline',
  'To-Dos': 'checkbox-outline',
  'Gym Track': 'barbell-outline',
  More: 'menu-outline',
};

// Sessions and Projects (and any future additions) live behind the "More"
// tab instead of crowding the bottom bar — the same overflow pattern iOS's
// own UITabBarController uses when there are too many top-level tabs.
function MoreStackNavigator() {
  const scheme = useEffectiveScheme();
  const color = scheme === 'dark' ? colors.dark : colors.light;

  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: color.card },
        headerTintColor: color.foreground,
      }}
    >
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More', headerShown: false }} />
      <MoreStack.Screen name="Sessions" component={SessionsScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="Projects" component={ProjectsScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </MoreStack.Navigator>
  );
}

function AppTabs() {
  const scheme = useEffectiveScheme();
  const color = scheme === 'dark' ? colors.dark : colors.light;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.border },
        tabBarIcon: ({ color: iconColor, size }) => (
          <Ionicons name={TAB_ICONS[route.name] ?? 'ellipse-outline'} size={size} color={iconColor} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="To-Dos" component={TodosScreen} />
      <Tab.Screen name="Gym Track" component={GymTrackScreen} />
      <Tab.Screen name="More" component={MoreStackNavigator} />
    </Tab.Navigator>
  );
}

// Dev convenience only: paste your cloud deployment's API_AUTH_TOKEN (see
// DEPLOY.md) here to skip the manual "Connect" tap while iterating.
// Production/real usage always goes through ConnectScreen. Leave blank to
// always show ConnectScreen.
const DEV_TOKEN = '';

function Root() {
  const { url, isLoading, connect } = useConnection();
  const scheme = useEffectiveScheme();

  React.useEffect(() => {
    if (__DEV__ && !isLoading && !url && DEV_TOKEN) connect(DEFAULT_API_URL, DEV_TOKEN);
  }, [url, isLoading, connect]);

  if (isLoading) return null;
  if (!url) return <ConnectScreen />;

  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppTabs />
    </NavigationContainer>
  );
}

// "auto" only ever followed the OS setting — with a manual light/dark
// override in Settings, the status bar has to follow that override
// instead. Kept as its own always-mounted component (rather than inline
// in Root) so it still renders during the loading/connect screens too.
function ThemedStatusBar() {
  const scheme = useEffectiveScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemePreferenceProvider>
        <ThemedStatusBar />
        <ConnectionProvider>
          <Root />
        </ConnectionProvider>
      </ThemePreferenceProvider>
    </QueryClientProvider>
  );
}
