import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../lib/theme';
import LogWorkoutTab from './gym/LogWorkoutTab';
import ExercisesTab from './gym/ExercisesTab';
import PersonalRecordsTab from './gym/PersonalRecordsTab';
import WeightTrackerTab from './gym/WeightTrackerTab';

type SubTab = 'log' | 'exercises' | 'records' | 'weight';

const TABS: { key: SubTab; label: string }[] = [
  { key: 'log', label: 'Log Workout' },
  { key: 'exercises', label: 'Exercises' },
  { key: 'records', label: 'Records' },
  { key: 'weight', label: 'Weight' },
];

export default function GymTrackScreen() {
  const color = useThemeColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = React.useState<SubTab>('log');

  return (
    <View style={[styles.container, { backgroundColor: color.background, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: color.foreground }]}>Gym Track</Text>

      <View style={[styles.tabBar, { borderColor: color.border }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { borderBottomColor: color.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, { color: tab === t.key ? color.primary : color.mutedForeground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {tab === 'log' && <LogWorkoutTab />}
        {tab === 'exercises' && <ExercisesTab />}
        {tab === 'records' && <PersonalRecordsTab />}
        {tab === 'weight' && <WeightTrackerTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 12 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 10, marginRight: 4 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  content: { flex: 1 },
});
