import * as React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListGymExercises, useCreateGymExercise, useDeleteGymExercise,
  getListGymExercisesQueryKey, GymExerciseCategory,
} from '@workspace/api-client-react';
import type { GymExercise, GymExerciseCategory as GymExerciseCategoryT } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../../lib/theme';
import { CATEGORIES, categoryColor } from '../../lib/gym-utils';
import { SwipeableRow } from '../../components/SwipeableRow';

const CATEGORY_KEYS = Object.values(GymExerciseCategory) as GymExerciseCategoryT[];

function ExerciseRow({ exercise, color, onDelete }: { exercise: GymExercise; color: ThemeColors; onDelete: (id: number) => void }) {
  return (
    <SwipeableRow onDelete={() => onDelete(exercise.id)} destructiveColor={color.destructive} borderRadius={10}>
      <View style={[styles.row, { backgroundColor: color.card }]}>
        <View style={[styles.catDot, { backgroundColor: categoryColor(exercise.category) }]} />
        <Text style={[styles.name, { color: color.foreground }]}>{exercise.name}</Text>
      </View>
    </SwipeableRow>
  );
}

export default function ExercisesTab() {
  const color = useThemeColors();
  const queryClient = useQueryClient();
  const { data: exercises = [] } = useListGymExercises();
  const createExercise = useCreateGymExercise();
  const deleteExercise = useDeleteGymExercise();
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<GymExerciseCategoryT>(CATEGORY_KEYS[0]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListGymExercisesQueryKey() });
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createExercise.mutate({ data: { name: trimmed, category } }, {
      onSuccess: () => { invalidate(); setName(''); },
    });
  }

  function handleDelete(id: number) {
    Alert.alert('Delete exercise?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExercise.mutate({ id }, { onSuccess: invalidate }) },
    ]);
  }

  const byCategory = React.useMemo(() => {
    const map = new Map<string, GymExercise[]>();
    for (const ex of exercises) {
      if (!map.has(ex.category)) map.set(ex.category, []);
      map.get(ex.category)!.push(ex);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [exercises]);

  const groups = CATEGORIES.filter(c => byCategory.has(c.value));

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.addBox, { borderColor: color.border, backgroundColor: color.muted }]}>
        <TextInput
          style={[styles.addInput, { color: color.foreground }]}
          value={name}
          onChangeText={setName}
          placeholder="New exercise name…"
          placeholderTextColor={color.mutedForeground}
          onSubmitEditing={handleAdd}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_KEYS}
          keyExtractor={c => c}
          contentContainerStyle={{ gap: 6 }}
          style={{ marginTop: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setCategory(item)}
              style={[
                styles.catChip,
                { borderColor: color.border },
                category === item && { backgroundColor: categoryColor(item), borderColor: categoryColor(item) },
              ]}
            >
              <Text style={[styles.catChipText, { color: category === item ? '#fff' : color.foreground }]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
        {name.trim().length > 0 && (
          <TouchableOpacity onPress={handleAdd} style={[styles.addButton, { backgroundColor: color.primary }]}>
            <Text style={{ color: color.primaryForeground, fontWeight: '600' }}>Add Exercise</Text>
          </TouchableOpacity>
        )}
      </View>

      {exercises.length === 0 ? (
        <Text style={[styles.empty, { color: color.mutedForeground }]}>No exercises yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groups.map(c => (
            <View key={c.value} style={[styles.group, { backgroundColor: color.card, borderColor: color.border }]}>
              <View style={[styles.groupHeader, { borderLeftColor: c.color }]}>
                <View style={[styles.catDot, { backgroundColor: c.color }]} />
                <Text style={[styles.groupTitle, { color: color.foreground }]}>{c.value}</Text>
                <Text style={[styles.groupCount, { color: color.mutedForeground }]}>{byCategory.get(c.value)!.length}</Text>
              </View>
              <View style={{ gap: 6, padding: 8 }}>
                {byCategory.get(c.value)!.map(ex => (
                  <ExerciseRow key={ex.id} exercise={ex} color={color} onDelete={handleDelete} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  addInput: { fontSize: 14, paddingVertical: 4 },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  catChipText: { fontSize: 11, fontWeight: '600' },
  addButton: { marginTop: 10, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  list: { gap: 12, paddingBottom: 20 },
  group: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 4 },
  groupTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  groupCount: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
});
