import * as React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Switch, Pressable, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListTodoLists, useCreateTodoList, useDeleteTodoList,
  useListTodoTasks, useCreateTodoTask, useDeleteTodoTask,
  useCompleteTodoTask, useUncompleteTodoTask,
  getListTodoListsQueryKey, getListTodoTasksQueryKey,
} from '@workspace/api-client-react';
import type { TodoList, TodoTask } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import { SwipeableRow } from '../components/SwipeableRow';
import { BottomSheetModal } from '../components/BottomSheetModal';

const PRESET_COLORS = [
  '#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#0ea5e9', '#22c55e', '#f97316', '#64748b',
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function isTaskComplete(task: TodoTask, resetDaily: boolean): boolean {
  if (!task.completedAt) return false;
  if (resetDaily) return task.completedDate === getToday();
  return true;
}

function completionRate(tasks: TodoTask[], resetDaily: boolean): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => isTaskComplete(t, resetDaily)).length;
  return Math.round((done / tasks.length) * 100);
}

function TaskRow({ task, resetDaily, color, onToggle, onDelete }: {
  task: TodoTask
  resetDaily: boolean
  color: ThemeColors
  onToggle: (task: TodoTask, done: boolean) => void
  onDelete: (id: number) => void
}) {
  const done = isTaskComplete(task, resetDaily);
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
  tasks: TodoTask[]
  color: ThemeColors
  onDeleteList: (id: number) => void
}) {
  const [expanded, setExpanded] = React.useState(true);
  const [newTaskText, setNewTaskText] = React.useState('');
  const queryClient = useQueryClient();

  const createTask = useCreateTodoTask();
  const deleteTask = useDeleteTodoTask();
  const completeTask = useCompleteTodoTask();
  const uncompleteTask = useUncompleteTodoTask();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListTodoTasksQueryKey() });
  }

  function handleToggle(task: TodoTask, done: boolean) {
    if (done) completeTask.mutate({ id: task.id }, { onSuccess: invalidate });
    else uncompleteTask.mutate({ id: task.id }, { onSuccess: invalidate });
  }

  function handleDeleteTask(id: number) {
    deleteTask.mutate({ id }, { onSuccess: invalidate });
  }

  function handleAddTask() {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    createTask.mutate({ data: { listId: list.id, text: trimmed } }, {
      onSuccess: () => { invalidate(); setNewTaskText(''); },
    });
  }

  const pct = completionRate(tasks, list.resetDaily);
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeTasks = sorted.filter(t => !isTaskComplete(t, list.resetDaily));
  const doneTasks = sorted.filter(t => isTaskComplete(t, list.resetDaily));

  return (
    <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(v => !v)}>
        <View style={[styles.badge, { backgroundColor: list.color }]}>
          <Text style={styles.badgeText}>{list.letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: color.foreground }]}>{list.name}</Text>
          <Text style={[styles.cardSub, { color: color.mutedForeground }]}>
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
            {list.resetDaily ? ' · daily' : ''}
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
            <TaskRow key={task.id} task={task} resetDaily={list.resetDaily} color={color}
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
                <TaskRow key={task.id} task={task} resetDaily={list.resetDaily} color={color}
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
  const [selectedColor, setSelectedColor] = React.useState(PRESET_COLORS[0]);
  const [resetDaily, setResetDaily] = React.useState(false);

  function reset() {
    setName(''); setLetter('A'); setSelectedColor(PRESET_COLORS[0]); setResetDaily(false);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate({
      data: { name: trimmed, color: selectedColor, letter: letter.toUpperCase() || 'A', resetDaily },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTodoListsQueryKey() });
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
            {PRESET_COLORS.map(c => (
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
          <View style={styles.switchRow}>
            <Text style={{ color: color.foreground }}>Reset daily (recurring checklist)</Text>
            <Switch value={resetDaily} onValueChange={setResetDaily} />
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
  const { data: allTasks = [] } = useListTodoTasks();
  const deleteList = useDeleteTodoList();
  const [addListOpen, setAddListOpen] = React.useState(false);

  const tasksByList = React.useMemo(() => {
    const map = new Map<number, TodoTask[]>();
    for (const t of allTasks) {
      if (!map.has(t.listId)) map.set(t.listId, []);
      map.get(t.listId)!.push(t);
    }
    return map;
  }, [allTasks]);

  function handleDeleteList(id: number) {
    deleteList.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTodoListsQueryKey() }),
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
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10 },
});
