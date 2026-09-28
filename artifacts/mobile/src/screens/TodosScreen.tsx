import * as React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Pressable, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListTodoLists, useCreateTodoList, useDeleteTodoList,
  useListTodoEntries, useCreateTodoEntry, useUpdateTodoEntry, useDeleteTodoEntry,
} from '@workspace/api-client-react';
import type { TodoList, TodoEntry, TodoCarryMode } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import { SwipeableRow } from '../components/SwipeableRow';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { TODO_LIST_COLORS, dayProgress, isEntryDone, invalidateTodoQueries, todayStr } from '@workspace/shared';

const CARRY_MODES: { value: TodoCarryMode; label: string; short: string }[] = [
  { value: 'carry', label: 'Carry over', short: 'carry' },
  { value: 'repeat', label: 'Repeat daily', short: 'daily' },
  { value: 'none', label: 'Single day', short: 'one day' },
];

function TaskRow({ task, color, onToggle, onDelete }: {
  task: TodoEntry
  color: ThemeColors
  onToggle: (task: TodoEntry, done: boolean) => void
  onDelete: (id: number) => void
}) {
  const done = isEntryDone(task);
  return (
    <SwipeableRow onDelete={() => onDelete(task.id)} destructiveColor={color.destructive}>
      <View style={[styles.taskRow, { backgroundColor: color.card }]}>
        <TouchableOpacity style={styles.taskRowMain} onPress={() => onToggle(task, !done)}>
          <Ionicons
            name={done ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={done ? '#10b981' : color.mutedForeground}
          />
          <Text
            style={[
              styles.taskText,
              { color: done ? color.mutedForeground : color.foreground },
              done && styles.taskTextDone,
            ]}
            numberOfLines={2}
          >
            {task.text}
          </Text>
        </TouchableOpacity>
      </View>
    </SwipeableRow>
  );
}

function ListCard({ list, tasks, color, onDeleteList }: {
  list: TodoList
  tasks: TodoEntry[]
  color: ThemeColors
  onDeleteList: (id: number) => void
}) {
  const [expanded, setExpanded] = React.useState(true);
  const [newTaskText, setNewTaskText] = React.useState('');
  const queryClient = useQueryClient();

  const createEntry = useCreateTodoEntry();
  const deleteEntry = useDeleteTodoEntry();
  const updateEntry = useUpdateTodoEntry();

  function invalidate() {
    invalidateTodoQueries(queryClient);
  }

  function handleToggle(task: TodoEntry, done: boolean) {
    updateEntry.mutate({ id: task.id, data: { status: done ? 'done' : 'pending' } }, { onSuccess: invalidate });
  }

  function handleDeleteTask(id: number) {
    deleteEntry.mutate({ id }, { onSuccess: invalidate });
  }

  function handleAddTask() {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    createEntry.mutate({ data: { listId: list.id, text: trimmed } }, {
      onSuccess: () => { invalidate(); setNewTaskText(''); },
    });
  }

  // Today's entries only; earlier-day completed entries are just still on display.
  const { done: doneToday, total: totalToday, percentage: pct } = dayProgress(tasks, todayStr());
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeTasks = sorted.filter(t => !isEntryDone(t));
  const doneTasks = sorted.filter(isEntryDone);

  return (
    <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(v => !v)}>
        <View style={[styles.badge, { backgroundColor: list.color }]}>
          <Text style={styles.badgeText}>{list.letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: color.foreground }]}>{list.name}</Text>
          <Text style={[styles.cardSub, { color: color.mutedForeground }]}>
            {doneToday}/{totalToday} today · {CARRY_MODES.find(m => m.value === list.carryMode)?.short}
          </Text>
        </View>
        <Text style={[styles.pct, { color: list.color }]}>{pct}%</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={color.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          {sorted.length === 0 && (
            <Text style={[styles.empty, { color: color.mutedForeground }]}>No tasks yet.</Text>
          )}
          {activeTasks.map(task => (
            <TaskRow key={task.id} task={task} color={color}
              onToggle={handleToggle} onDelete={handleDeleteTask} />
          ))}
          {doneTasks.length > 0 && (
            <>
              <View style={styles.doneDivider}>
                <View style={[styles.doneDividerLine, { backgroundColor: color.border }]} />
                <Text style={[styles.doneDividerText, { color: color.mutedForeground }]}>Done</Text>
                <View style={[styles.doneDividerLine, { backgroundColor: color.border }]} />
              </View>
              {doneTasks.map(task => (
                <TaskRow key={task.id} task={task} color={color}
                  onToggle={handleToggle} onDelete={handleDeleteTask} />
              ))}
            </>
          )}

          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, { color: color.foreground }]}
              value={newTaskText}
              onChangeText={setNewTaskText}
              placeholder="Add a task…"
              placeholderTextColor={color.mutedForeground}
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
            />
            {newTaskText.trim().length > 0 && (
              <TouchableOpacity onPress={handleAddTask} hitSlop={8}>
                <Ionicons name="add-circle" size={22} color={color.primary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => onDeleteList(list.id)} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
            <Text style={[styles.deleteListText, { color: color.destructive }]}>Delete list</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function AddListModal({ visible, onClose, color }: { visible: boolean; onClose: () => void; color: ThemeColors }) {
  const queryClient = useQueryClient();
  const createList = useCreateTodoList();
  const [name, setName] = React.useState('');
  const [letter, setLetter] = React.useState('A');
  const [selectedColor, setSelectedColor] = React.useState(TODO_LIST_COLORS[0]);
  const [carryMode, setCarryMode] = React.useState<TodoCarryMode>('carry');

  function reset() {
    setName(''); setLetter('A'); setSelectedColor(TODO_LIST_COLORS[0]); setCarryMode('carry');
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate({
      data: { name: trimmed, color: selectedColor, letter: letter.toUpperCase() || 'A', carryMode },
    }, {
      onSuccess: () => {
        invalidateTodoQueries(queryClient);
        reset();
        onClose();
      },
    });
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
        <View style={[styles.modalCard, { backgroundColor: color.card }]}>
          <Text style={[styles.modalTitle, { color: color.foreground }]}>New List</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: color.border, color: color.foreground }]}
            value={name}
            onChangeText={setName}
            placeholder="List name"
            placeholderTextColor={color.mutedForeground}
          />
          <TextInput
            style={[styles.modalInput, { borderColor: color.border, color: color.foreground, width: 60 }]}
            value={letter}
            onChangeText={t => setLetter(t.slice(0, 1))}
            placeholder="A"
            placeholderTextColor={color.mutedForeground}
            autoCapitalize="characters"
            maxLength={1}
          />
          <View style={styles.colorRow}>
            {TODO_LIST_COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  selectedColor === c && { borderWidth: 3, borderColor: color.foreground },
                ]}
              />
            ))}
          </View>
          <Text style={{ color: color.mutedForeground, fontSize: 12 }}>When a new day starts</Text>
          <View style={styles.colorRow}>
            {CARRY_MODES.map(m => (
              <TouchableOpacity
                key={m.value}
                onPress={() => setCarryMode(m.value)}
                style={[
                  styles.modeChip,
                  { borderColor: color.border },
                  carryMode === m.value && { backgroundColor: color.primary, borderColor: color.primary },
                ]}
              >
                <Text style={{ color: carryMode === m.value ? color.primaryForeground : color.foreground, fontSize: 13, fontWeight: '600' }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.modalButton}>
              <Text style={{ color: color.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} style={[styles.modalButton, { backgroundColor: color.primary, borderRadius: 8 }]}>
              <Text style={{ color: color.primaryForeground, fontWeight: '600' }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
    </BottomSheetModal>
  );
}

export default function TodosScreen() {
  const color = useThemeColors();
  const queryClient = useQueryClient();
  const { data: lists = [], isLoading: listsLoading } = useListTodoLists();
  // Today's entries, plus earlier days' completed ones for lists that keep them visible
  const { data: allTasks = [] } = useListTodoEntries({ includeEarlierDone: true });
  const deleteList = useDeleteTodoList();
  const [addListOpen, setAddListOpen] = React.useState(false);

  const tasksByList = React.useMemo(() => {
    const map = new Map<number, TodoEntry[]>();
    for (const t of allTasks) {
      if (!map.has(t.listId)) map.set(t.listId, []);
      map.get(t.listId)!.push(t);
    }
    return map;
  }, [allTasks]);

  function handleDeleteList(id: number) {
    deleteList.mutate({ id }, {
      onSuccess: () => invalidateTodoQueries(queryClient),
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: color.foreground }]}>To-Dos</Text>
        <TouchableOpacity onPress={() => setAddListOpen(true)}>
          <Ionicons name="add-circle-outline" size={28} color={color.primary} />
        </TouchableOpacity>
      </View>

      {listsLoading ? (
        <ActivityIndicator size="large" color={color.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {lists.length === 0 && (
            <Text style={[styles.empty, { color: color.mutedForeground }]}>
              No lists yet. Tap + to create one.
            </Text>
          )}
          {lists.map(list => (
            <ListCard
              key={list.id}
              list={list}
              tasks={tasksByList.get(list.id) ?? []}
              color={color}
              onDeleteList={handleDeleteList}
            />
          ))}
        </ScrollView>
      )}

      <AddListModal visible={addListOpen} onClose={() => setAddListOpen(false)} color={color} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '700' },
  content: { padding: 20, paddingTop: 8, gap: 12 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  badge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 2 },
  pct: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 4 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  taskRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskText: { flex: 1, fontSize: 14 },
  taskTextDone: { textDecorationLine: 'line-through' },
  doneDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  doneDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  doneDividerText: { fontSize: 11, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  addInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  deleteListText: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10 },
});
