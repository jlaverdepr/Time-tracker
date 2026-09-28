import * as React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  useGetCalendar, useGetTodoDaySummary, useListGymWorkouts, useListGymRuns,
  useListSessions, useListTodoLists, useListTodoEntries,
  useCreateTodoEntry, useUpdateTodoEntry, useDeleteTodoEntry,
  useListGymWorkoutEntries, useListGymExercises, useListGymWorkoutSets,
  getListTodoEntriesQueryKey, getGetTodoDaySummaryQueryKey,
} from '@workspace/api-client-react';
import type { TodoList, GymWorkout } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import { SwipeableRow } from '../components/SwipeableRow';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { categoryColor, formatDuration, formatPace, formatRunTime, formatSpeed, invalidateTodoQueries, toDateStr, todayStr } from '@workspace/shared';

function intensityColor(minutes: number, primary: string, muted: string): string {
  if (minutes === 0) return muted;
  const alpha = minutes < 60 ? 0.25 : minutes < 180 ? 0.45 : minutes < 300 ? 0.65 : minutes < 480 ? 0.85 : 1;
  return primary + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

// ── legend ────────────────────────────────────────────────────────────────

function LegendItem({ children }: { children: React.ReactNode }) {
  return <View style={styles.legendItem}>{children}</View>;
}

// Only listed when the visible month actually has a record of that
// activity type — matches the desktop app, which hides legend entries for
// activity that never occurred that month instead of listing every kind
// unconditionally.
function Legend({ color, presence }: { color: ThemeColors; presence: { workout: boolean; run: boolean; todo: boolean } }) {
  if (!presence.workout && !presence.run && !presence.todo) return null;
  return (
    <View style={styles.legendRow}>
      {presence.workout && (
        <LegendItem>
          <View style={[styles.legendIconCircle, { backgroundColor: '#f97316' }]}>
            <Ionicons name="barbell" size={9} color="#fff" />
          </View>
          <Text style={[styles.legendText, { color: color.mutedForeground }]}>Workout</Text>
        </LegendItem>
      )}
      {presence.run && (
        <LegendItem>
          <View style={[styles.legendIconCircle, { backgroundColor: '#0ea5e9' }]}>
            <Ionicons name="walk" size={9} color="#fff" />
          </View>
          <Text style={[styles.legendText, { color: color.mutedForeground }]}>Run</Text>
        </LegendItem>
      )}
      {presence.todo && (
        <LegendItem>
          <View style={[styles.legendIconCircle, { backgroundColor: '#8b5cf6' }]}>
            <Text style={styles.legendLetter}>T</Text>
          </View>
          <Text style={[styles.legendText, { color: color.mutedForeground }]}>To-do progress</Text>
        </LegendItem>
      )}
    </View>
  );
}

// ── expandable to-do day panel ───────────────────────────────────────────

function TodoDayPanel({ list, stats, date, color }: {
  list: TodoList
  stats: { totalTasks: number; completedTasks: number; percentage: number }
  date: string
  color: ThemeColors
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [newTaskText, setNewTaskText] = React.useState('');
  const queryClient = useQueryClient();

  // This day's entries for this list — the same rows the percentage is computed from.
  const { data: dayTasks, isLoading } = useListTodoEntries(
    { date, listId: list.id },
    { query: { enabled: expanded, queryKey: getListTodoEntriesQueryKey({ date, listId: list.id }) } },
  );

  const updateEntry = useUpdateTodoEntry();
  const createEntry = useCreateTodoEntry();
  const deleteEntry = useDeleteTodoEntry();

  function invalidate() {
    invalidateTodoQueries(queryClient);
  }

  // Same call for any day: completing a past entry removes the copies carried
  // from it; un-completing one carries it forward again.
  function handleToggle(entryId: number, nextDone: boolean) {
    updateEntry.mutate({ id: entryId, data: { status: nextDone ? 'done' : 'pending' } }, { onSuccess: invalidate });
  }

  function handleAddTask() {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    createEntry.mutate({ data: { listId: list.id, text: trimmed, date } }, {
      onSuccess: () => { invalidate(); setNewTaskText(''); },
    });
  }

  function handleDelete(entryId: number) {
    deleteEntry.mutate({ id: entryId }, { onSuccess: invalidate });
  }

  return (
    <View style={[styles.panel, { backgroundColor: color.card, borderColor: color.border }]}>
      <TouchableOpacity style={styles.panelHeader} onPress={() => setExpanded(v => !v)}>
        <View style={[styles.listBadge, { backgroundColor: list.color }]}>
          <Text style={styles.listBadgeText}>{list.letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.panelTitle, { color: color.foreground }]}>{list.name}</Text>
          {stats.totalTasks > 0 && (
            <View style={styles.panelProgressRow}>
              <View style={[styles.miniProgressTrack, { backgroundColor: color.muted }]}>
                <View style={[styles.miniProgressFill, { width: `${stats.percentage}%`, backgroundColor: list.color }]} />
              </View>
              <Text style={[styles.panelCount, { color: color.mutedForeground }]}>{stats.completedTasks}/{stats.totalTasks}</Text>
            </View>
          )}
        </View>
        {stats.totalTasks > 0 && (
          <Text style={[styles.panelPct, { color: list.color }]}>{stats.percentage}%</Text>
        )}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={color.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panelBody}>
          {isLoading ? (
            <Text style={[styles.panelEmpty, { color: color.mutedForeground }]}>Loading tasks...</Text>
          ) : !dayTasks || dayTasks.length === 0 ? (
            <Text style={[styles.panelEmpty, { color: color.mutedForeground }]}>No tasks for this day.</Text>
          ) : (
            dayTasks.map(task => {
              const done = task.status === 'done';
              return (
              <SwipeableRow key={task.id} onDelete={() => handleDelete(task.id)} destructiveColor={color.destructive}>
                <TouchableOpacity
                  style={[styles.dayTaskRow, { backgroundColor: color.card }]}
                  onPress={() => handleToggle(task.id, !done)}
                >
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={done ? '#10b981' : color.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.dayTaskText,
                      { color: color.foreground },
                      done && { color: color.mutedForeground, textDecorationLine: 'line-through' },
                    ]}
                    numberOfLines={1}
                  >
                    {task.text}
                  </Text>
                  {task.copiedFromDate && (
                    <Text style={{ fontSize: 10, color: color.mutedForeground }}>carried</Text>
                  )}
                </TouchableOpacity>
              </SwipeableRow>
              );
            })
          )}

          <View style={styles.addRow}>
            <Ionicons name="add" size={14} color={color.mutedForeground} />
            <TextInput
              style={[styles.addInput, { color: color.foreground }]}
              value={newTaskText}
              onChangeText={setNewTaskText}
              placeholder="Add a task…"
              placeholderTextColor={color.mutedForeground}
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ── expandable workout day panel ─────────────────────────────────────────

function WorkoutDayPanel({ workout, entries, exercisesById, setsByEntry, color }: {
  workout: GymWorkout
  entries: { id: number; exerciseId: number }[]
  exercisesById: Map<number, { name: string; category: string }>
  setsByEntry: Map<number, { isWarmup: boolean; reps?: number | null; weight?: number | null }[]>
  color: ThemeColors
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <View style={[styles.panel, { backgroundColor: color.card, borderColor: color.border }]}>
      <TouchableOpacity style={styles.panelHeader} onPress={() => setExpanded(v => !v)}>
        <View style={[styles.iconCircle, { backgroundColor: '#f97316' }]}>
          <Ionicons name="barbell" size={13} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.panelTitle, { color: color.foreground }]}>{workout.title ?? 'Workout'}</Text>
          <Text style={[styles.panelSub, { color: color.mutedForeground }]}>
            {entries.length} exercise{entries.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={color.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panelBody}>
          {entries.length === 0 ? (
            <Text style={[styles.panelEmpty, { color: color.mutedForeground }]}>No exercises logged</Text>
          ) : (
            entries.map((e, idx) => {
              const ex = exercisesById.get(e.exerciseId);
              const sets = (setsByEntry.get(e.id) ?? []).filter(s => !s.isWarmup && s.reps != null && s.weight != null);
              return (
                <View key={idx} style={{ gap: 2, marginBottom: 6 }}>
                  <View style={styles.exerciseNameRow}>
                    <View style={[styles.catDot, { backgroundColor: categoryColor(ex?.category ?? 'Minor') }]} />
                    <Text style={[styles.exerciseName, { color: color.foreground }]}>{ex?.name ?? 'Unknown exercise'}</Text>
                  </View>
                  {sets.length > 0 && (
                    <Text style={[styles.setsSummary, { color: color.mutedForeground }]}>
                      {sets.map(s => `${s.reps} x ${s.weight} kg`).join(', ')}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ── day detail modal ─────────────────────────────────────────────────────

function DayDetailModal({ date, onClose, color }: { date: string | null; onClose: () => void; color: ThemeColors }) {
  const { height: windowHeight } = useWindowDimensions();
  // Keep showing the last-opened day's content while the sheet plays its
  // closing animation — `date` goes null the instant the user closes it,
  // and bailing out on that immediately would unmount everything before
  // BottomSheetModal gets a chance to animate away.
  const [displayDate, setDisplayDate] = React.useState(date);
  React.useEffect(() => { if (date) setDisplayDate(date); }, [date]);

  const { data: sessions = [], isLoading: isLoadingSessions } = useListSessions(
    displayDate ? { startDate: displayDate, endDate: displayDate } : undefined,
    { query: { enabled: !!date, queryKey: ['day-sessions', displayDate] } },
  );
  const { data: todoLists = [] } = useListTodoLists();
  const daySummaryParams = { startDate: displayDate ?? '', endDate: displayDate ?? '' };
  const { data: todoSummary = [] } = useGetTodoDaySummary(
    daySummaryParams,
    { query: { enabled: !!date, queryKey: getGetTodoDaySummaryQueryKey(daySummaryParams) } },
  );
  const { data: gymWorkouts = [] } = useListGymWorkouts();
  const { data: gymRuns = [] } = useListGymRuns();
  const { data: gymEntries = [] } = useListGymWorkoutEntries();
  const { data: gymExercises = [] } = useListGymExercises();
  const { data: gymSets = [] } = useListGymWorkoutSets();

  const exercisesById = React.useMemo(() => {
    const map = new Map<number, { name: string; category: string }>();
    for (const ex of gymExercises) map.set(ex.id, { name: ex.name, category: ex.category });
    return map;
  }, [gymExercises]);

  const entriesByWorkout = React.useMemo(() => {
    const map = new Map<number, { id: number; exerciseId: number }[]>();
    for (const e of gymEntries) {
      if (!map.has(e.workoutId)) map.set(e.workoutId, []);
      map.get(e.workoutId)!.push(e);
    }
    return map;
  }, [gymEntries]);

  const setsByEntry = React.useMemo(() => {
    const map = new Map<number, { isWarmup: boolean; reps?: number | null; weight?: number | null }[]>();
    for (const s of gymSets) {
      if (!map.has(s.entryId)) map.set(s.entryId, []);
      map.get(s.entryId)!.push(s);
    }
    return map;
  }, [gymSets]);

  if (!displayDate) return null;
  const label = new Date(displayDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const isToday = displayDate === todayStr();
  const dayWorkouts = gymWorkouts.filter(w => w.date === displayDate);
  const dayRuns = gymRuns.filter(r => r.date === displayDate);

  return (
    <BottomSheetModal visible={!!date} onClose={onClose}>
        <View style={[styles.modalCard, { backgroundColor: color.card, maxHeight: windowHeight * 0.88 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: color.foreground }]}>{label}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={color.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: windowHeight * 0.88 - 90 }} contentContainerStyle={{ gap: 18 }}>

            {todoLists.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: color.mutedForeground }]}>TO-DO PROGRESS</Text>
                {todoLists.map(list => {
                  const summary = todoSummary.find(t => t.listId === list.id);
                  return (
                    <TodoDayPanel
                      key={list.id}
                      list={list}
                      stats={{
                        totalTasks: summary?.totalTasks ?? 0,
                        completedTasks: summary?.completedTasks ?? 0,
                        percentage: summary?.percentage ?? 0,
                      }}
                      date={displayDate}
                      color={color}
                    />
                  );
                })}
              </View>
            )}

            {(dayWorkouts.length > 0 || dayRuns.length > 0) && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: color.mutedForeground }]}>GYM</Text>
                {dayWorkouts.map(workout => (
                  <WorkoutDayPanel
                    key={`w-${workout.id}`}
                    workout={workout}
                    entries={entriesByWorkout.get(workout.id) ?? []}
                    exercisesById={exercisesById}
                    setsByEntry={setsByEntry}
                    color={color}
                  />
                ))}
                {dayRuns.map(run => {
                  const pace = run.distanceKm != null && run.durationSeconds != null ? formatPace(run.distanceKm, run.durationSeconds) : null;
                  const speed = run.distanceKm != null && run.durationSeconds != null ? formatSpeed(run.distanceKm, run.durationSeconds) : null;
                  return (
                    <View key={`r-${run.id}`} style={[styles.runRow, { backgroundColor: color.card, borderColor: color.border }]}>
                      <View style={[styles.iconCircle, { backgroundColor: '#0ea5e9' }]}>
                        <Ionicons name="walk" size={13} color="#fff" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <View style={styles.runHeader}>
                          <Text style={[styles.panelTitle, { color: color.foreground }]}>Run</Text>
                          {run.durationSeconds != null && <Text style={[styles.runStatMuted, { color: color.mutedForeground }]}>{formatRunTime(run.durationSeconds)}</Text>}
                        </View>
                        {(run.distanceKm != null || speed || pace) && (
                          <View style={styles.runStats}>
                            {run.distanceKm != null && <Text style={[styles.runStat, { color: '#0284c7' }]}>{run.distanceKm} km</Text>}
                            {speed && <Text style={[styles.runPill, { color: color.mutedForeground, backgroundColor: '#0ea5e91a' }]}>{speed}</Text>}
                            {pace && <Text style={[styles.runPill, { color: color.mutedForeground, backgroundColor: '#0ea5e91a' }]}>{pace}</Text>}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: color.mutedForeground }]}>SESSIONS</Text>
              {isLoadingSessions ? (
                <ActivityIndicator color={color.primary} style={{ marginVertical: 20 }} />
              ) : sessions.length === 0 ? (
                <Text style={[styles.panelEmpty, { color: color.mutedForeground }]}>No sessions recorded on this day.</Text>
              ) : (
                sessions.map(s => (
                  <View key={s.id} style={[styles.sessionRow, { borderColor: color.border }]}>
                    <View style={{ flex: 1 }}>
                      {s.projectName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.dot, { backgroundColor: s.projectColor ?? '#ccc' }]} />
                          <Text style={{ color: color.foreground, fontWeight: '600', fontSize: 13 }}>{s.projectName}</Text>
                        </View>
                      ) : (
                        <Text style={{ color: color.mutedForeground, fontSize: 13 }}>Unassigned</Text>
                      )}
                      {s.notes && <Text style={{ color: color.mutedForeground, fontSize: 12, marginTop: 2 }}>{s.notes}</Text>}
                    </View>
                    <Text style={{ color: color.primary, fontWeight: '700', fontSize: 13 }}>{formatDuration(s.durationMinutes)}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
    </BottomSheetModal>
  );
}

// ── main screen ───────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const color = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState(0);

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startDateStr = toDateStr(monthStart);
  const endDateStr = toDateStr(monthEnd);

  const { data: calendarData = [], isLoading } = useGetCalendar({ startDate: startDateStr, endDate: endDateStr });
  const { data: todoSummary = [] } = useGetTodoDaySummary({ startDate: startDateStr, endDate: endDateStr });
  const { data: todoLists = [] } = useListTodoLists();
  const { data: gymWorkouts = [] } = useListGymWorkouts();
  const { data: gymRuns = [] } = useListGymRuns();

  const minutesByDate = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const d of calendarData) map.set(d.date, d.totalMinutes);
    return map;
  }, [calendarData]);

  // A list's badge shows on a day exactly when it has entries (pending or done) that day.
  const todoByDate = React.useMemo(() => {
    const listsById = new Map(todoLists.map(l => [l.id, l]));
    const map = new Map<string, { letter: string; pct: number; color: string }[]>();
    for (const item of todoSummary) {
      const list = listsById.get(item.listId);
      if (!list) continue;
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push({ letter: list.letter, pct: item.percentage, color: list.color });
    }
    return map;
  }, [todoSummary, todoLists]);

  const gymDates = React.useMemo(() => new Set(gymWorkouts.map(w => w.date)), [gymWorkouts]);
  const runDates = React.useMemo(() => new Set(gymRuns.map(r => r.date)), [gymRuns]);

  // Same gating as the desktop legend: only advertise an icon's meaning if
  // it actually shows up somewhere in the visible month.
  const legendPresence = React.useMemo(() => ({
    workout: gymWorkouts.some(w => w.date >= startDateStr && w.date <= endDateStr),
    run: gymRuns.some(r => r.date >= startDateStr && r.date <= endDateStr),
    todo: todoSummary.some(t => t.totalTasks > 0),
  }), [gymWorkouts, gymRuns, todoSummary, startDateStr, endDateStr]);

  const days: (Date | null)[] = [];
  const startDayOfWeek = monthStart.getDay();
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));

  const today = todayStr();

  // Fill the available vertical space (like Apple Calendar's month view)
  // instead of fixed-aspect-ratio square cells that leave the bottom of the
  // screen empty. Rows are however tall they need to be to fill the space
  // between the header and the bottom of the screen, for however many weeks
  // this particular month spans (4-6).
  const numWeeks = Math.ceil((startDayOfWeek + monthEnd.getDate()) / 7);
  const WEEK_ROW_HEIGHT = 26;
  const gridAreaHeight = Math.max(
    numWeeks * 56,
    windowHeight - insets.top - 12 - headerHeight - WEEK_ROW_HEIGHT - insets.bottom - 12,
  );
  const cellHeight = gridAreaHeight / numWeeks;

  return (
    <View style={[styles.container, { backgroundColor: color.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header} onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
        <Text style={[styles.title, { color: color.foreground }]}>Calendar</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={color.foreground} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: color.foreground }]}>
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={color.foreground} />
          </TouchableOpacity>
        </View>
        <Legend color={color} presence={legendPresence} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={color.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={[styles.weekDay, { color: color.mutedForeground }]}>{d}</Text>
            ))}
          </View>
          <View style={[styles.grid, { height: gridAreaHeight }]}>
            {days.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={[styles.cell, { height: cellHeight }]} />;
              const dStr = toDateStr(day);
              const minutes = minutesByDate.get(dStr) ?? 0;
              const isToday = dStr === today;
              const todos = todoByDate.get(dStr) ?? [];
              const hasWorkout = gymDates.has(dStr);
              const hasRun = runDates.has(dStr);
              return (
                <TouchableOpacity
                  key={dStr}
                  style={[
                    styles.cell,
                    { height: cellHeight },
                    styles.dayCell,
                    { backgroundColor: intensityColor(minutes, color.primary, color.muted), borderColor: color.border },
                    isToday && { borderWidth: 2, borderColor: color.primary },
                  ]}
                  onPress={() => setSelectedDate(dStr)}
                >
                  <Text style={[styles.dayNum, { color: minutes > 100 ? '#fff' : color.foreground }]}>{day.getDate()}</Text>

                  <View style={styles.cellBadgeRow}>
                    {hasWorkout && (
                      <View style={[styles.cellIconBadge, { backgroundColor: '#f97316' }]}>
                        <Ionicons name="barbell" size={8} color="#fff" />
                      </View>
                    )}
                    {hasRun && (
                      <View style={[styles.cellIconBadge, { backgroundColor: '#0ea5e9' }]}>
                        <Ionicons name="walk" size={8} color="#fff" />
                      </View>
                    )}
                  </View>

                  <View style={styles.cellFooter}>
                    {minutes > 0 && (
                      <Text style={[styles.cellDuration, { color: minutes > 100 ? '#fff' : color.foreground }]}>
                        {formatDuration(minutes)}
                      </Text>
                    )}
                    {todos.length > 0 && (
                      <View style={styles.cellTodoRow}>
                        {todos.slice(0, 3).map((t, idx) => (
                          <View key={idx} style={[styles.cellTodoBadge, { backgroundColor: t.color }]}>
                            <View style={[styles.cellTodoFill, { height: `${100 - t.pct}%` }]} />
                            <Text style={styles.cellTodoLetter}>{t.letter}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <DayDetailModal date={selectedDate} onClose={() => setSelectedDate(null)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  header: { gap: 10, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 4 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  monthLabel: { fontSize: 16, fontWeight: '600', width: 160, textAlign: 'center' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendIconCircle: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  legendLetter: { fontSize: 8, fontWeight: '700', color: '#fff' },
  legendText: { fontSize: 11 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 3 },
  dayCell: { borderRadius: 10, borderWidth: 1, padding: 5, justifyContent: 'space-between' },
  dayNum: { fontSize: 13, fontWeight: '700' },
  cellBadgeRow: { flexDirection: 'row', gap: 2, position: 'absolute', top: 4, right: 4 },
  cellIconBadge: { width: 13, height: 13, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cellFooter: { alignItems: 'flex-end', gap: 4 },
  cellDuration: { fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // Placed right next to the day number (not tucked at the bottom with the
  // duration) so a list's presence and completion is the first thing you
  // notice about the day, not something you have to hunt for.
  cellTodoRow: { flexDirection: 'row', gap: 3 },
  // Fill overlay grows from the bottom as (100 - completion%), same idea as
  // the desktop's letter badge, so a glance at the grid tells you how close
  // a list is to done for that day, not just that it has tasks.
  cellTodoBadge: {
    width: 14, height: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  cellTodoFill: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  cellTodoLetter: { fontSize: 8, fontWeight: '700', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  panelEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 10 },

  panel: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  panelBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },
  panelTitle: { fontSize: 13, fontWeight: '600' },
  panelSub: { fontSize: 11, marginTop: 1 },
  panelProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  panelCount: { fontSize: 11, fontVariant: ['tabular-nums'] },
  panelPct: { fontSize: 13, fontWeight: '700' },
  miniProgressTrack: { flex: 1, height: 5, borderRadius: 2.5, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 2.5 },

  listBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  iconCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  dayTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  dayTaskText: { flex: 1, fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addInput: { flex: 1, fontSize: 13, paddingVertical: 6 },

  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  exerciseName: { fontSize: 13, fontWeight: '600' },
  setsSummary: { fontSize: 11, marginLeft: 12 },

  runRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  runHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  runStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  runStat: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  runStatMuted: { fontSize: 12, fontVariant: ['tabular-nums'] },
  runPill: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', fontVariant: ['tabular-nums'] },

  sessionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
