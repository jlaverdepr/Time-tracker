import * as React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, SectionList,
  Alert, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListGymWorkouts, useCreateGymWorkout, useUpdateGymWorkout, useDeleteGymWorkout,
  useListGymWorkoutEntries, useCreateGymWorkoutEntry, useDeleteGymWorkoutEntry,
  useListGymWorkoutSets, useCreateGymWorkoutSet, useUpdateGymWorkoutSet, useDeleteGymWorkoutSet,
  useListGymExercises,
  getListGymWorkoutsQueryKey, getListGymWorkoutEntriesQueryKey, getListGymWorkoutSetsQueryKey,
} from '@workspace/api-client-react';
import type { GymWorkout, GymWorkoutEntry, GymWorkoutSet, GymExercise } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../../lib/theme';
import { SwipeableRow } from '../../components/SwipeableRow';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { categoryColor, orderCategoriesForTitle, sanitizeNumericInput, todayStr } from '@workspace/shared';

const WORKOUT_TITLE_PRESETS = ['Chest', 'Legs', 'Back'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function SetChip({ set, color, onUpdate, onDelete }: {
  set: GymWorkoutSet
  color: ThemeColors
  onUpdate: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onDelete: (id: number) => void
}) {
  const hasBoth = set.reps != null && set.weight != null;
  const [editing, setEditing] = React.useState(!hasBoth);
  const [reps, setReps] = React.useState(set.reps != null ? String(set.reps) : '');
  const [weight, setWeight] = React.useState(set.weight != null ? String(set.weight) : '');

  function commit() {
    const repsVal = reps.trim() === '' ? null : Number(reps.trim());
    const weightVal = weight.trim() === '' ? null : Number(weight.trim());
    if (repsVal !== null && Number.isNaN(repsVal)) return;
    if (weightVal !== null && Number.isNaN(weightVal)) return;
    onUpdate(set.id, { reps: repsVal, weight: weightVal });
    if (repsVal != null && weightVal != null) setEditing(false);
  }

  if (editing) {
    return (
      <View style={[styles.setChip, { borderColor: color.border }]}>
        <TextInput
          style={[styles.setInput, { color: color.foreground, borderColor: color.border }]}
          value={reps} onChangeText={t => setReps(sanitizeNumericInput(t, false))}
          placeholder="reps" placeholderTextColor={color.mutedForeground}
          keyboardType="number-pad" onBlur={commit}
        />
        <Text style={{ color: color.mutedForeground, fontSize: 11 }}>x</Text>
        <TextInput
          style={[styles.setInput, { color: color.foreground, borderColor: color.border, width: 50 }]}
          value={weight} onChangeText={t => setWeight(sanitizeNumericInput(t, true))}
          placeholder="kg" placeholderTextColor={color.mutedForeground}
          keyboardType="decimal-pad" onBlur={commit}
        />
        <TouchableOpacity onPress={() => onDelete(set.id)} hitSlop={6}>
          <Ionicons name="close-circle" size={16} color={color.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[styles.setChip, { borderColor: color.border }]} onPress={() => setEditing(true)} onLongPress={() => onDelete(set.id)}>
      <Text style={{ color: color.foreground, fontSize: 12, fontWeight: '600' }}>{set.reps} x {set.weight}kg</Text>
    </TouchableOpacity>
  );
}

function EntryRow({ entry, exercise, sets, color, onDelete, onCreateSet, onUpdateSet, onDeleteSet }: {
  entry: GymWorkoutEntry
  exercise: GymExercise | undefined
  sets: GymWorkoutSet[]
  color: ThemeColors
  onDelete: (id: number) => void
  onCreateSet: (entryId: number, isWarmup: boolean, nextIndex: number) => void
  onUpdateSet: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onDeleteSet: (id: number) => void
}) {
  const [warmupOpen, setWarmupOpen] = React.useState(false);
  const mainSets = [...sets.filter(s => !s.isWarmup)].sort((a, b) => a.setIndex - b.setIndex);
  const warmupSets = [...sets.filter(s => s.isWarmup)].sort((a, b) => a.setIndex - b.setIndex);
  const filledWarmupSets = warmupSets.filter(s => s.reps != null && s.weight != null);

  function handleAddOrEditWarmup() {
    if (warmupSets.length === 0) onCreateSet(entry.id, true, 1);
    setWarmupOpen(true);
  }

  return (
    <SwipeableRow onDelete={() => onDelete(entry.id)} destructiveColor={color.destructive}>
      <View style={[styles.entryRow, { backgroundColor: color.card }]}>
        <View style={styles.entryHeader}>
          <View style={[styles.catDot, { backgroundColor: categoryColor(exercise?.category ?? 'Minor') }]} />
          <Text style={[styles.exerciseName, { color: color.foreground }]} numberOfLines={1}>{exercise?.name ?? 'Unknown'}</Text>
          {!warmupOpen && (
            <TouchableOpacity onPress={handleAddOrEditWarmup} hitSlop={6}>
              <Text style={[styles.warmupLink, { color: color.mutedForeground }]}>
                {filledWarmupSets.length > 0 ? 'Edit Warmup' : 'Add Warmup'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.setsRow}>
          {mainSets.map(s => (
            <SetChip key={s.id} set={s} color={color} onUpdate={onUpdateSet} onDelete={onDeleteSet} />
          ))}
          {mainSets.length < 5 && (
            <TouchableOpacity style={[styles.addSetBtn, { borderColor: color.border }]} onPress={() => onCreateSet(entry.id, false, mainSets.length + 1)}>
              <Ionicons name="add" size={14} color={color.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {warmupOpen ? (
          <View style={styles.warmupEditRow}>
            <Text style={[styles.warmupLabel, { color: color.mutedForeground }]}>Warmup</Text>
            {warmupSets.map(s => (
              <SetChip key={s.id} set={s} color={color} onUpdate={onUpdateSet} onDelete={onDeleteSet} />
            ))}
            {warmupSets.length < 5 && (
              <TouchableOpacity style={[styles.addSetBtn, { borderColor: color.border }]} onPress={() => onCreateSet(entry.id, true, warmupSets.length + 1)}>
                <Ionicons name="add" size={14} color={color.mutedForeground} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setWarmupOpen(false)} hitSlop={6}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            </TouchableOpacity>
          </View>
        ) : filledWarmupSets.length > 0 ? (
          <Text style={[styles.warmupSummary, { color: color.mutedForeground }]}>
            Warmup: {filledWarmupSets.map(s => `${s.reps} x ${s.weight} kg`).join(', ')}
          </Text>
        ) : null}
      </View>
    </SwipeableRow>
  );
}

function ExercisePickerModal({ visible, onClose, exercises, onSelect, color, workoutTitle }: {
  visible: boolean; onClose: () => void; exercises: GymExercise[]; onSelect: (id: number) => void; color: ThemeColors
  workoutTitle?: string | null
}) {
  const [query, setQuery] = React.useState('');
  const { height: windowHeight } = useWindowDimensions();

  React.useEffect(() => { if (!visible) setQuery(''); }, [visible]);

  const orderedCategories = React.useMemo(() => orderCategoriesForTitle(workoutTitle), [workoutTitle]);

  const sections = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? exercises.filter(e => e.name.toLowerCase().includes(q)) : exercises;
    const byCategory = new Map<string, GymExercise[]>();
    for (const ex of filtered) {
      if (!byCategory.has(ex.category)) byCategory.set(ex.category, []);
      byCategory.get(ex.category)!.push(ex);
    }
    for (const list of byCategory.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return orderedCategories
      .filter(c => byCategory.has(c.value))
      .map(c => ({ title: c.value, color: c.color, data: byCategory.get(c.value)! }));
  }, [exercises, query, orderedCategories]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={[styles.modalCard, { backgroundColor: color.card, maxHeight: windowHeight * 0.75 }]}>
        <Text style={[styles.modalTitle, { color: color.foreground }]}>Add Exercise</Text>
        <View style={[styles.searchBox, { borderColor: color.border }]}>
          <Ionicons name="search" size={14} color={color.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: color.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises…"
            placeholderTextColor={color.mutedForeground}
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={e => String(e.id)}
          style={{ maxHeight: windowHeight * 0.75 - 140 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { borderLeftColor: section.color, backgroundColor: color.card }]}>
              <Text style={[styles.sectionHeaderText, { color: color.mutedForeground }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pickerRow} onPress={() => { onSelect(item.id); onClose(); }}>
              <View style={[styles.catDot, { backgroundColor: categoryColor(item.category) }]} />
              <Text style={{ color: color.foreground, fontSize: 14 }}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ color: color.mutedForeground, textAlign: 'center', padding: 20 }}>
              {exercises.length === 0 ? 'No exercises yet — add some in the Exercises tab.' : 'No matching exercises.'}
            </Text>
          }
        />
        <TouchableOpacity onPress={onClose} style={styles.modalButton}>
          <Text style={{ color: color.mutedForeground }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

function WorkoutDetailsModal({ visible, workout, onClose, onSave, color }: {
  visible: boolean
  workout: GymWorkout | null
  onClose: () => void
  onSave: (id: number, data: { title: string | null; date: string }) => void
  color: ThemeColors
}) {
  const presets: readonly string[] = WORKOUT_TITLE_PRESETS;
  const [selected, setSelected] = React.useState<string>('Chest');
  const [customTitle, setCustomTitle] = React.useState('');
  const [date, setDate] = React.useState('');
  const { height: windowHeight } = useWindowDimensions();

  React.useEffect(() => {
    if (!visible || !workout) return;
    const isPreset = workout.title != null && presets.includes(workout.title);
    setSelected(isPreset ? workout.title! : workout.title ? 'Other' : 'Chest');
    setCustomTitle(!isPreset && workout.title ? workout.title : '');
    setDate(workout.date);
  }, [visible, workout]);

  if (!workout) return null;

  const dateValid = DATE_RE.test(date);
  const effectiveTitle = selected === 'Other' ? customTitle.trim() : selected;

  function handleSave() {
    if (!workout || !dateValid) return;
    onSave(workout.id, { title: effectiveTitle || null, date });
    onClose();
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
        <View style={[styles.modalCard, { backgroundColor: color.card, maxHeight: windowHeight * 0.75 }]}>
          <Text style={[styles.modalTitle, { color: color.foreground }]}>Workout details</Text>

          <View style={styles.presetRow}>
            {[...WORKOUT_TITLE_PRESETS, 'Other'].map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setSelected(t)}
                style={[
                  styles.presetChip,
                  { borderColor: color.border },
                  selected === t && { backgroundColor: color.primary, borderColor: color.primary },
                ]}
              >
                <Text style={{ color: selected === t ? color.primaryForeground : color.foreground, fontSize: 13, fontWeight: '600' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selected === 'Other' && (
            <TextInput
              style={[styles.modalInput, { borderColor: color.border, color: color.foreground }]}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="Custom title…"
              placeholderTextColor={color.mutedForeground}
              autoFocus
            />
          )}

          <Text style={[styles.fieldLabel, { color: color.mutedForeground }]}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: dateValid ? color.border : color.destructive, color: color.foreground }]}
            value={date}
            onChangeText={setDate}
            placeholder="2026-07-21"
            placeholderTextColor={color.mutedForeground}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={onClose} style={styles.modalButton}>
              <Text style={{ color: color.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!dateValid || (selected === 'Other' && !customTitle.trim())}
              style={[styles.modalButton, { backgroundColor: color.primary, borderRadius: 8, opacity: !dateValid || (selected === 'Other' && !customTitle.trim()) ? 0.5 : 1 }]}
            >
              <Text style={{ color: color.primaryForeground, fontWeight: '600' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
    </BottomSheetModal>
  );
}

function WorkoutCard({ workout, entries, exercisesById, setsByEntry, color, onDeleteWorkout, onEditWorkout, onDeleteEntry, onAddExercise, onCreateSet, onUpdateSet, onDeleteSet }: {
  workout: GymWorkout
  entries: GymWorkoutEntry[]
  exercisesById: Map<number, GymExercise>
  setsByEntry: Map<number, GymWorkoutSet[]>
  color: ThemeColors
  onDeleteWorkout: (id: number) => void
  onEditWorkout: (workout: GymWorkout) => void
  onDeleteEntry: (id: number) => void
  onAddExercise: (workoutId: number) => void
  onCreateSet: (entryId: number, isWarmup: boolean, nextIndex: number) => void
  onUpdateSet: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onDeleteSet: (id: number) => void
}) {
  const dateLabel = new Date(workout.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <SwipeableRow onDelete={() => onDeleteWorkout(workout.id)} destructiveColor={color.destructive} borderRadius={16}>
      <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: color.foreground }]}>{workout.title || dateLabel}</Text>
            {workout.title && <Text style={[styles.cardDate, { color: color.mutedForeground }]}>{dateLabel}</Text>}
          </View>
          <TouchableOpacity onPress={() => onEditWorkout(workout)} hitSlop={8}>
            <Ionicons name="pencil" size={16} color={color.mutedForeground} />
          </TouchableOpacity>
        </View>
        {entries.length === 0 ? (
          <Text style={[styles.empty, { color: color.mutedForeground }]}>No exercises logged yet</Text>
        ) : (
          entries.map(entry => (
            <EntryRow
              key={entry.id} entry={entry} exercise={exercisesById.get(entry.exerciseId)}
              sets={setsByEntry.get(entry.id) ?? []} color={color}
              onDelete={onDeleteEntry} onCreateSet={onCreateSet} onUpdateSet={onUpdateSet} onDeleteSet={onDeleteSet}
            />
          ))
        )}
        <TouchableOpacity style={[styles.addExerciseBtn, { borderColor: color.border }]} onPress={() => onAddExercise(workout.id)}>
          <Ionicons name="add" size={16} color={color.primary} />
          <Text style={{ color: color.primary, fontSize: 13, fontWeight: '600' }}>Add Exercise</Text>
        </TouchableOpacity>
      </View>
    </SwipeableRow>
  );
}

export default function LogWorkoutTab() {
  const color = useThemeColors();
  const queryClient = useQueryClient();
  const { data: workouts = [] } = useListGymWorkouts();
  const { data: allEntries = [] } = useListGymWorkoutEntries();
  const { data: allSets = [] } = useListGymWorkoutSets();
  const { data: exercises = [] } = useListGymExercises();

  const createWorkout = useCreateGymWorkout();
  const updateWorkout = useUpdateGymWorkout();
  const deleteWorkout = useDeleteGymWorkout();
  const createEntry = useCreateGymWorkoutEntry();
  const deleteEntry = useDeleteGymWorkoutEntry();
  const createSet = useCreateGymWorkoutSet();
  const updateSet = useUpdateGymWorkoutSet();
  const deleteSet = useDeleteGymWorkoutSet();

  const [pickerWorkoutId, setPickerWorkoutId] = React.useState<number | null>(null);
  const [editingWorkout, setEditingWorkout] = React.useState<GymWorkout | null>(null);

  function invalidateWorkouts() { queryClient.invalidateQueries({ queryKey: getListGymWorkoutsQueryKey() }); }
  function invalidateEntries() { queryClient.invalidateQueries({ queryKey: getListGymWorkoutEntriesQueryKey() }); }
  function invalidateSets() { queryClient.invalidateQueries({ queryKey: getListGymWorkoutSetsQueryKey() }); }

  function handleAddWorkout() {
    createWorkout.mutate({ data: { date: todayStr() } }, { onSuccess: invalidateWorkouts });
  }

  function handleDeleteWorkout(id: number) {
    Alert.alert('Delete workout?', 'This deletes all its exercises and sets too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteWorkout.mutate({ id }, { onSuccess: invalidateWorkouts }) },
    ]);
  }

  function handleUpdateWorkout(id: number, data: { title: string | null; date: string }) {
    updateWorkout.mutate({ id, data }, { onSuccess: invalidateWorkouts });
  }

  function handleSelectExercise(exerciseId: number) {
    if (pickerWorkoutId == null) return;
    createEntry.mutate({ data: { workoutId: pickerWorkoutId, exerciseId } }, { onSuccess: invalidateEntries });
  }

  function handleDeleteEntry(id: number) {
    deleteEntry.mutate({ id }, { onSuccess: () => { invalidateEntries(); invalidateSets(); } });
  }

  function handleCreateSet(entryId: number, isWarmup: boolean, nextIndex: number) {
    createSet.mutate({ data: { entryId, isWarmup, setIndex: nextIndex } }, { onSuccess: invalidateSets });
  }

  function handleUpdateSet(id: number, data: { reps?: number | null; weight?: number | null }) {
    updateSet.mutate({ id, data }, { onSuccess: invalidateSets });
  }

  function handleDeleteSet(id: number) {
    deleteSet.mutate({ id }, { onSuccess: invalidateSets });
  }

  const exercisesById = React.useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);
  const entriesByWorkout = React.useMemo(() => {
    const map = new Map<number, GymWorkoutEntry[]>();
    for (const e of allEntries) {
      if (!map.has(e.workoutId)) map.set(e.workoutId, []);
      map.get(e.workoutId)!.push(e);
    }
    return map;
  }, [allEntries]);
  const setsByEntry = React.useMemo(() => {
    const map = new Map<number, GymWorkoutSet[]>();
    for (const s of allSets) {
      if (!map.has(s.entryId)) map.set(s.entryId, []);
      map.get(s.entryId)!.push(s);
    }
    return map;
  }, [allSets]);

  const sortedWorkouts = [...workouts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={[styles.newWorkoutBtn, { backgroundColor: color.primary }]} onPress={handleAddWorkout}>
        <Ionicons name="add" size={16} color={color.primaryForeground} />
        <Text style={{ color: color.primaryForeground, fontWeight: '600', fontSize: 13 }}>Add Workout</Text>
      </TouchableOpacity>

      <FlatList
        data={sortedWorkouts}
        keyExtractor={w => String(w.id)}
        contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <WorkoutCard
            workout={item}
            entries={entriesByWorkout.get(item.id) ?? []}
            exercisesById={exercisesById}
            setsByEntry={setsByEntry}
            color={color}
            onDeleteWorkout={handleDeleteWorkout}
            onEditWorkout={setEditingWorkout}
            onDeleteEntry={handleDeleteEntry}
            onAddExercise={setPickerWorkoutId}
            onCreateSet={handleCreateSet}
            onUpdateSet={handleUpdateSet}
            onDeleteSet={handleDeleteSet}
          />
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: color.mutedForeground, marginTop: 20 }]}>No workouts logged yet.</Text>}
      />

      <ExercisePickerModal
        visible={pickerWorkoutId != null}
        onClose={() => setPickerWorkoutId(null)}
        exercises={exercises}
        onSelect={handleSelectExercise}
        color={color}
        workoutTitle={workouts.find(w => w.id === pickerWorkoutId)?.title}
      />

      <WorkoutDetailsModal
        visible={editingWorkout != null}
        workout={editingWorkout}
        onClose={() => setEditingWorkout(null)}
        onSave={handleUpdateWorkout}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  newWorkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDate: { fontSize: 12 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  entryRow: { gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)' },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  exerciseName: { fontSize: 13, fontWeight: '600', flex: 1 },
  warmupLink: { fontSize: 10, textDecorationLine: 'underline' },
  warmupEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  warmupLabel: { fontSize: 10, marginRight: 2 },
  warmupSummary: { fontSize: 11, textAlign: 'right' },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  setChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  setInput: { fontSize: 12, width: 38, padding: 0, textAlign: 'center' },
  addSetBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 8, marginTop: 4 },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  sectionHeader: { paddingVertical: 6, paddingHorizontal: 8, borderLeftWidth: 3 },
  sectionHeaderText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  modalButton: { paddingVertical: 12, alignItems: 'center', paddingHorizontal: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  fieldLabel: { fontSize: 12, marginTop: 4 },
  modalInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});
