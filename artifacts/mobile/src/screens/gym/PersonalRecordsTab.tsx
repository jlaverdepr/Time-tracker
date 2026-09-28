import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useListGymExercises, useListGymWorkoutEntries, useListGymWorkoutSets, useListGymWorkouts,
} from '@workspace/api-client-react';
import type { GymExercise } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../../lib/theme';
import { categoryColor } from '@workspace/shared';

type Mode = 'weight' | 'volume';

type Record = {
  exercise: GymExercise
  weight: number
  reps: number | null
  volume: number | null
  date: string
};

function RecordCard({ record, mode, color }: { record: Record; mode: Mode; color: ThemeColors }) {
  const cColor = categoryColor(record.exercise.category);
  return (
    <View style={[styles.card, { backgroundColor: color.card, borderTopColor: cColor }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <View style={[styles.dot, { backgroundColor: cColor }]} />
        <Text style={[styles.exerciseName, { color: color.foreground }]} numberOfLines={1}>{record.exercise.name}</Text>
        <Ionicons name="trophy" size={16} color={cColor} />
      </View>
      {mode === 'weight' ? (
        <Text style={[styles.big, { color: cColor }]}>
          {record.weight} <Text style={styles.bigUnit}>kg{record.reps != null ? ` x ${record.reps}` : ''}</Text>
        </Text>
      ) : (
        <Text style={[styles.big, { color: cColor }]}>
          {record.volume} <Text style={styles.bigUnit}>kg vol</Text>
        </Text>
      )}
      <Text style={[styles.date, { color: color.mutedForeground }]}>
        {new Date(record.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
    </View>
  );
}

export default function PersonalRecordsTab() {
  const color = useThemeColors();
  const [mode, setMode] = React.useState<Mode>('weight');
  const { data: exercises = [] } = useListGymExercises();
  const { data: entries = [] } = useListGymWorkoutEntries();
  const { data: sets = [] } = useListGymWorkoutSets();
  const { data: workouts = [] } = useListGymWorkouts();

  const { weightRecords, volumeRecords } = React.useMemo(() => {
    const workoutById = new Map(workouts.map(w => [w.id, w]));
    const entryById = new Map(entries.map(e => [e.id, e]));
    const bestWeight = new Map<number, Record>();
    const bestVolume = new Map<number, Record>();

    for (const set of sets) {
      if (set.weight == null) continue;
      const entry = entryById.get(set.entryId);
      if (!entry) continue;
      const exercise = exercises.find(ex => ex.id === entry.exerciseId);
      if (!exercise) continue;
      const workout = workoutById.get(entry.workoutId);
      const date = workout?.date ?? '';

      const currentWeight = bestWeight.get(exercise.id);
      if (!currentWeight || set.weight > currentWeight.weight) {
        bestWeight.set(exercise.id, { exercise, weight: set.weight, reps: set.reps ?? null, volume: null, date });
      }
      if (set.reps != null) {
        const volume = set.weight * set.reps;
        const currentVolume = bestVolume.get(exercise.id);
        if (!currentVolume || volume > (currentVolume.volume ?? 0)) {
          bestVolume.set(exercise.id, { exercise, weight: set.weight, reps: set.reps, volume, date });
        }
      }
    }

    const byName = (a: Record, b: Record) => a.exercise.name.localeCompare(b.exercise.name);
    return {
      weightRecords: [...bestWeight.values()].sort(byName),
      volumeRecords: [...bestVolume.values()].sort(byName),
    };
  }, [exercises, entries, sets, workouts]);

  const records = mode === 'weight' ? weightRecords : volumeRecords;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.toggle, { borderColor: color.border, backgroundColor: color.muted }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'weight' && { backgroundColor: color.card }]}
          onPress={() => setMode('weight')}
        >
          <Text style={{ color: mode === 'weight' ? color.foreground : color.mutedForeground, fontWeight: '600', fontSize: 13 }}>Best Weight</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'volume' && { backgroundColor: color.card }]}
          onPress={() => setMode('volume')}
        >
          <Text style={{ color: mode === 'volume' ? color.foreground : color.mutedForeground, fontWeight: '600', fontSize: 13 }}>Best Volume</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={r => String(r.exercise.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <RecordCard record={item} mode={mode} color={color} />
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: color.mutedForeground }]}>No records yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 3, alignSelf: 'flex-start', marginBottom: 12 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  card: { borderRadius: 14, padding: 12, borderTopWidth: 3, borderWidth: 1, borderColor: 'transparent' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  exerciseName: { fontSize: 13, fontWeight: '600', flex: 1 },
  big: { fontSize: 20, fontWeight: '700' },
  bigUnit: { fontSize: 12, fontWeight: '400' },
  date: { fontSize: 11, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
});
