import * as React from "react"
import { Layout } from "@/components/layout/layout"
import {
  useGetCalendar, useListSessions, useGetSubprojectCalendarEvents,
  useGetTodoCalendarSummary, useListGymWorkouts, useListGymRuns,
  useListGymWorkoutEntries, useListGymExercises, useListGymWorkoutSets,
  useListTodoTasks, useListTodoLists, useCreateTodoTask, useDeleteTodoTask,
  useCompleteTodoTask, useUncompleteTodoTask,
  useGetTodoDayDetail, useToggleTodoDayDetailTask,
  getListTodoTasksQueryKey, getGetTodoDayDetailQueryKey,
} from "@workspace/api-client-react"
import type { SubprojectCalendarEvent, TodoCalendarSummaryItem } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, parseISO, addMonths, subMonths,
} from "date-fns"
import {
  CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2,
  Dumbbell, Footprints, CalendarPlus, Plus, Circle, Trash2, Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SessionDialog } from "@/components/session-dialog"
import { ConfettiBurst } from "@/components/confetti-burst"
import type { Session } from "@workspace/api-client-react"
import { categoryColor, formatDuration, formatPace, formatSpeed, todayStr } from "@workspace/shared"

type CalendarIconKey = "subprojectActive" | "subprojectCompleted" | "todoBadges" | "workout" | "run" | "prepared"

const CALENDAR_ICONS_STORAGE_KEY = "calendar-visible-icons"
const DEFAULT_VISIBLE_ICONS: Record<CalendarIconKey, boolean> = {
  subprojectActive: true, subprojectCompleted: true, todoBadges: true, workout: true, run: true, prepared: true,
}

function useVisibleCalendarIcons() {
  const [visible, setVisible] = React.useState<Record<CalendarIconKey, boolean>>(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBLE_ICONS
    try {
      const saved = window.localStorage.getItem(CALENDAR_ICONS_STORAGE_KEY)
      if (saved) return { ...DEFAULT_VISIBLE_ICONS, ...JSON.parse(saved) }
    } catch { /* ignore malformed storage */ }
    return DEFAULT_VISIBLE_ICONS
  })

  function toggle(key: CalendarIconKey) {
    setVisible(prev => {
      const next = { ...prev, [key]: !prev[key] }
      window.localStorage.setItem(CALENDAR_ICONS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return { visible, toggle }
}

function LegendItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 transition-opacity",
        active ? "opacity-100" : "opacity-35 hover:opacity-60",
      )}
      title={active ? "Click to hide on calendar" : "Click to show on calendar"}
    >
      {children}
    </button>
  )
}

// ── expandable to-do list panel ─────────────────────────────────────────────────

function TodoDayPanel({ list, stats, date, isToday: dayIsToday }: {
  list: { id: number; name: string; color: string; letter: string }
  stats: { totalTasks: number; completedTasks: number; percentage: number }
  date: string
  isToday: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [newTaskText, setNewTaskText] = React.useState("")
  const queryClient = useQueryClient()
  const complete = stats.totalTasks > 0 && stats.percentage === 100

  const [celebrate, setCelebrate] = React.useState(false)
  const prevCompleteRef = React.useRef(complete)
  React.useEffect(() => {
    if (complete && !prevCompleteRef.current) setCelebrate(true)
    prevCompleteRef.current = complete
  }, [complete])

  const { data: dayTasks, isLoading } = useGetTodoDayDetail(
    { listId: list.id, date },
    { query: { enabled: expanded, queryKey: ["todo-day-detail", list.id, date] } }
  )

  const toggleDayTask = useToggleTodoDayDetailTask()
  const completeTask = useCompleteTodoTask()
  const uncompleteTask = useUncompleteTodoTask()
  const deleteTask = useDeleteTodoTask()
  const createTask = useCreateTodoTask()

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["todo-day-detail", list.id, date] })
    queryClient.invalidateQueries({ queryKey: getListTodoTasksQueryKey() })
    queryClient.invalidateQueries({ queryKey: ["todo-calendar"] })
  }

  function handleToggle(taskId: number, nextCompleted: boolean) {
    if (dayIsToday) {
      if (nextCompleted) completeTask.mutate({ id: taskId }, { onSuccess: invalidate })
      else uncompleteTask.mutate({ id: taskId }, { onSuccess: invalidate })
    } else {
      toggleDayTask.mutate({ data: { taskId, date, completed: nextCompleted } }, { onSuccess: invalidate })
    }
  }

  function handleDelete(e: React.MouseEvent, taskId: number) {
    e.stopPropagation()
    deleteTask.mutate({ id: taskId }, { onSuccess: invalidate })
  }

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskText.trim()) return
    createTask.mutate({ data: { listId: list.id, text: newTaskText.trim(), scheduledDate: date } }, {
      onSuccess: () => { invalidate(); setNewTaskText("") },
    })
  }

  return (
    <div className={cn("relative rounded-lg border bg-card overflow-hidden", complete && "border-amber-400/60")}>
      {celebrate && <ConfettiBurst onDone={() => setCelebrate(false)} />}
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn("w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left", complete && "bg-amber-400/10")}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 transition-all",
          complete && "ring-2 ring-amber-400 ring-offset-1 ring-offset-card",
        )} style={{ backgroundColor: list.color }}>
          {list.letter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{list.name}</p>
          {stats.totalTasks > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${stats.percentage}%`, backgroundColor: list.color }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {stats.completedTasks}/{stats.totalTasks}
              </span>
            </div>
          )}
        </div>
        {stats.totalTasks > 0 && (
          <span className="font-mono font-bold text-sm shrink-0" style={{ color: list.color }}>
            {stats.percentage}%
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading tasks...</p>
          ) : !dayTasks || dayTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No tasks for this day.</p>
          ) : (
            dayTasks.map(task => (
              <div key={task.taskId} className="flex items-center gap-1 group/task">
                <button
                  onClick={() => handleToggle(task.taskId, !task.completed)}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-left"
                >
                  {task.completed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                  <span className={cn("text-sm truncate", task.completed && "line-through text-muted-foreground")}>
                    {task.text}
                  </span>
                </button>
                <button
                  onClick={e => handleDelete(e, task.taskId)}
                  title="Delete task"
                  className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover/task:opacity-100 shrink-0"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))
          )}

          <form onSubmit={handleAddTask} className="flex items-center gap-1.5 pt-1">
            <Plus className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 ml-2" />
            <input
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              placeholder="Add a task…"
              className="flex-1 min-w-0 bg-transparent text-sm py-1.5 focus:outline-none placeholder:text-muted-foreground/40"
            />
          </form>
        </div>
      )}
    </div>
  )
}

// ── expandable workout panel ────────────────────────────────────────────────────

function WorkoutDayPanel({ workout, entries, exercisesById, setsByEntry }: {
  workout: { id: number; title?: string | null }
  entries: { id: number; exerciseId: number }[]
  exercisesById: Map<number, { name: string; category: string }>
  setsByEntry: Map<number, { isWarmup: boolean; reps?: number | null; weight?: number | null }[]>
}) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <Dumbbell className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{workout.title ?? "Workout"}</p>
          <p className="text-xs text-muted-foreground">{entries.length} exercise{entries.length === 1 ? "" : "s"}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No exercises logged</p>
          ) : (
            entries.map((e, idx) => {
              const ex = exercisesById.get(e.exerciseId)
              const sets = (setsByEntry.get(e.id) ?? []).filter(s => !s.isWarmup && s.reps != null && s.weight != null)
              return (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor(ex?.category ?? "Minor") }} />
                    <span className="text-sm font-medium">{ex?.name ?? "Unknown exercise"}</span>
                  </div>
                  {sets.length > 0 && (
                    <p className="text-xs text-muted-foreground ml-3">
                      {sets.map(s => `${s.reps} x ${s.weight} kg`).join(", ")}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [sessionToEdit, setSessionToEdit] = React.useState<Session | null>(null)
  const { visible: visibleIcons, toggle: toggleVisibleIcon } = useVisibleCalendarIcons()
  const today = todayStr()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDateStr = format(monthStart, "yyyy-MM-dd")
  const endDateStr = format(monthEnd, "yyyy-MM-dd")

  const { data: calendarData, isLoading } = useGetCalendar(
    { startDate: startDateStr, endDate: endDateStr },
    { query: { queryKey: ["calendar", startDateStr, endDateStr] } }
  )

  const { data: subprojectEvents } = useGetSubprojectCalendarEvents(
    { startDate: startDateStr, endDate: endDateStr },
    { query: { queryKey: ["subproject-events", startDateStr, endDateStr] } }
  )

  const { data: todoSummary } = useGetTodoCalendarSummary(
    { startDate: startDateStr, endDate: endDateStr },
    { query: { queryKey: ["todo-calendar", startDateStr, endDateStr] } }
  )

  const { data: gymWorkouts } = useListGymWorkouts()
  const { data: gymRuns } = useListGymRuns()
  const { data: gymEntries } = useListGymWorkoutEntries()
  const { data: gymExercises } = useListGymExercises()
  const { data: gymSets } = useListGymWorkoutSets()
  const { data: futureTasks } = useListTodoTasks({ includeFuture: true })
  const { data: todoLists = [] } = useListTodoLists()

  const { data: selectedDaySessions, isLoading: isLoadingSessions } = useListSessions(
    { startDate: selectedDate || undefined, endDate: selectedDate || undefined },
    { query: { enabled: !!selectedDate, queryKey: ["sessions", selectedDate] } }
  )

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = monthStart.getDay()
  const emptyDays = Array(startDayOfWeek).fill(null)

  // index calendar data by date
  const dayDataByDate = React.useMemo(() => {
    const map = new Map<string, { date: string; totalMinutes: number }>()
    for (const d of calendarData ?? []) map.set(d.date, d)
    return map
  }, [calendarData])

  // index subproject events by date
  const subEventsByDate = React.useMemo(() => {
    const map = new Map<string, SubprojectCalendarEvent[]>()
    for (const ev of subprojectEvents ?? []) {
      if (!map.has(ev.date)) map.set(ev.date, [])
      map.get(ev.date)!.push(ev)
    }
    return map
  }, [subprojectEvents])

  // index todo summary by date → list letter
  const todoByDate = React.useMemo(() => {
    const map = new Map<string, TodoCalendarSummaryItem[]>()
    for (const item of todoSummary ?? []) {
      if (!map.has(item.date)) map.set(item.date, [])
      map.get(item.date)!.push(item)
    }
    return map
  }, [todoSummary])

  // set of dates that have a logged gym workout
  const gymDatesSet = React.useMemo(() => {
    return new Set((gymWorkouts ?? []).map(w => w.date))
  }, [gymWorkouts])

  // set of dates that have a logged run
  const runDatesSet = React.useMemo(() => {
    return new Set((gymRuns ?? []).map(r => r.date))
  }, [gymRuns])

  // set of future dates that have a "prepared" task
  const preparedDatesSet = React.useMemo(() => {
    const set = new Set<string>()
    for (const t of futureTasks ?? []) {
      if (t.scheduledDate && t.scheduledDate > today) set.add(t.scheduledDate)
    }
    return set
  }, [futureTasks, today])

  // which legend/icon types actually have a record in the visible month —
  // keeps the legend from listing activity types that never occurred here
  const legendPresence = React.useMemo(() => {
    const inMonth = (date: string) => date >= startDateStr && date <= endDateStr
    return {
      subprojectActive: (subprojectEvents ?? []).some(e => e.eventType === "active"),
      subprojectCompleted: (subprojectEvents ?? []).some(e => e.eventType === "completed"),
      todoBadges: (todoSummary ?? []).some(t => t.totalTasks > 0),
      workout: (gymWorkouts ?? []).some(w => inMonth(w.date)),
      run: (gymRuns ?? []).some(r => inMonth(r.date)),
      prepared: [...preparedDatesSet].some(inMonth),
    }
  }, [subprojectEvents, todoSummary, gymWorkouts, gymRuns, preparedDatesSet, startDateStr, endDateStr])

  // subproject + todo events for the selected day
  const selectedDaySubEvents = selectedDate ? (subEventsByDate.get(selectedDate) ?? []) : []
  const selectedDayTodos = selectedDate ? (todoByDate.get(selectedDate) ?? []) : []

  // gym workouts + runs for the selected day
  const selectedDayWorkouts = selectedDate ? (gymWorkouts ?? []).filter(w => w.date === selectedDate) : []
  const selectedDayRuns = selectedDate ? (gymRuns ?? []).filter(r => r.date === selectedDate) : []

  const exercisesById = React.useMemo(() => {
    const map = new Map<number, { name: string; category: string }>()
    for (const ex of gymExercises ?? []) map.set(ex.id, { name: ex.name, category: ex.category })
    return map
  }, [gymExercises])

  const entriesByWorkout = React.useMemo(() => {
    const map = new Map<number, { id: number; exerciseId: number }[]>()
    for (const e of gymEntries ?? []) {
      if (!map.has(e.workoutId)) map.set(e.workoutId, [])
      map.get(e.workoutId)!.push(e)
    }
    return map
  }, [gymEntries])

  const setsByEntry = React.useMemo(() => {
    const map = new Map<number, { isWarmup: boolean; reps?: number | null; weight?: number | null }[]>()
    for (const s of gymSets ?? []) {
      if (!map.has(s.entryId)) map.set(s.entryId, [])
      map.get(s.entryId)!.push(s)
    }
    return map
  }, [gymSets])

  const getIntensityClass = (minutes: number) => {
    if (minutes === 0) return "bg-card border border-border"
    if (minutes < 60) return "bg-primary/20 border-transparent"
    if (minutes < 180) return "bg-primary/40 border-transparent"
    if (minutes < 300) return "bg-primary/60 border-transparent"
    if (minutes < 480) return "bg-primary/80 border-transparent"
    return "bg-primary border-transparent shadow-sm"
  }

  const getTextClass = (minutes: number) =>
    minutes > 0 ? "text-primary-foreground" : "text-muted-foreground"

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground">Your work mapped out over time.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold w-32 text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* legend — click an item to show/hide it on the calendar. Only listed
            when this month actually has a record of that activity type. */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {legendPresence.subprojectActive && (
            <LegendItem active={visibleIcons.subprojectActive} onClick={() => toggleVisibleIcon("subprojectActive")}>
              <div className="w-2 h-2 rounded-full bg-primary/70" />
              <span>Active subproject day</span>
            </LegendItem>
          )}
          {legendPresence.subprojectCompleted && (
            <LegendItem active={visibleIcons.subprojectCompleted} onClick={() => toggleVisibleIcon("subprojectCompleted")}>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Subproject completed</span>
            </LegendItem>
          )}
          {legendPresence.todoBadges && (
            <LegendItem active={visibleIcons.todoBadges} onClick={() => toggleVisibleIcon("todoBadges")}>
              <div className="w-4 h-4 rounded text-[9px] font-bold bg-violet-500 text-white flex items-center justify-center">T</div>
              <span>To-do list completion</span>
            </LegendItem>
          )}
          {legendPresence.workout && (
            <LegendItem active={visibleIcons.workout} onClick={() => toggleVisibleIcon("workout")}>
              <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                <Dumbbell className="h-2.5 w-2.5 text-white" />
              </div>
              <span>Workout logged</span>
            </LegendItem>
          )}
          {legendPresence.run && (
            <LegendItem active={visibleIcons.run} onClick={() => toggleVisibleIcon("run")}>
              <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center shadow-sm">
                <Footprints className="h-2.5 w-2.5 text-white" />
              </div>
              <span>Run logged</span>
            </LegendItem>
          )}
          {legendPresence.prepared && (
            <LegendItem active={visibleIcons.prepared} onClick={() => toggleVisibleIcon("prepared")}>
              <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shadow-sm">
                <CalendarPlus className="h-2.5 w-2.5 text-white" />
              </div>
              <span>Task prepared in advance</span>
            </LegendItem>
          )}
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-sm font-semibold text-muted-foreground pb-2">{d}</div>
            ))}
          </div>

          {isLoading ? (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              Loading calendar...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {emptyDays.map((_, i) => (
                <div key={`empty-${i}`} className="h-28 rounded-xl opacity-0 pointer-events-none" />
              ))}

              {days.map(day => {
                const dStr = format(day, "yyyy-MM-dd")
                const dayData = dayDataByDate.get(dStr)
                const minutes = dayData?.totalMinutes ?? 0
                const subEvents = subEventsByDate.get(dStr) ?? []
                const completedSubEvents = subEvents.filter(e => e.eventType === "completed")
                const activeSubEvents = subEvents.filter(e => e.eventType === "active")
                const todosForDay = todoByDate.get(dStr) ?? []
                // Only show lists that have tasks
                const todoListsWithTasks = todosForDay.filter(t => t.totalTasks > 0)
                const hasPrepared = preparedDatesSet.has(dStr)

                return (
                  <button
                    key={dStr}
                    onClick={() => setSelectedDate(dStr)}
                    className={cn(
                      "h-28 rounded-xl p-2 flex flex-col justify-between transition-all relative overflow-hidden group hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background",
                      getIntensityClass(minutes),
                      isToday(day) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      minutes === 0 && "hover:bg-muted"
                    )}
                  >
                    {/* day number */}
                    <span className={cn(
                      "text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full self-start",
                      getTextClass(minutes)
                    )}>
                      {format(day, "d")}
                    </span>

                    {/* workout indicator */}
                    {visibleIcons.workout && gymDatesSet.has(dStr) && (
                      <div
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-md z-10"
                        title="Workout logged"
                      >
                        <Dumbbell className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}

                    {/* run indicator */}
                    {visibleIcons.run && runDatesSet.has(dStr) && (
                      <div
                        className={cn(
                          "absolute top-1.5 w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center shadow-md z-10",
                          visibleIcons.workout && gymDatesSet.has(dStr) ? "right-9" : "right-1.5",
                        )}
                        title="Run logged"
                      >
                        <Footprints className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}

                    {/* prepared task indicator */}
                    {visibleIcons.prepared && hasPrepared && (
                      <div
                        className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-md z-10"
                        title="Task prepared in advance"
                      >
                        <CalendarPlus className="h-3 w-3 text-white" />
                      </div>
                    )}

                    <div className="w-full space-y-1">
                      {/* duration */}
                      {minutes > 0 && (
                        <div className="text-right">
                          <div className={cn("font-mono text-xs font-semibold", getTextClass(minutes))}>
                            {formatDuration(minutes)}
                          </div>
                        </div>
                      )}

                      {/* subproject event dots */}
                      {((visibleIcons.subprojectCompleted && completedSubEvents.length > 0) || (visibleIcons.subprojectActive && activeSubEvents.length > 0)) && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {visibleIcons.subprojectCompleted && completedSubEvents.slice(0, 3).map((ev, idx) => (
                            <div key={`c-${idx}`}
                              className="flex items-center justify-center w-4 h-4 rounded-full bg-white/90 shadow-sm"
                              title={`✓ ${ev.subprojectName}`}>
                              <CheckCircle2 className="h-3 w-3" style={{ color: ev.subprojectColor ?? ev.projectColor }} />
                            </div>
                          ))}
                          {visibleIcons.subprojectActive && activeSubEvents.slice(0, 4).map((ev, idx) => (
                            <div key={`a-${idx}`}
                              className="w-2 h-2 rounded-full border border-white/50 shadow-sm"
                              style={{ backgroundColor: ev.subprojectColor ?? ev.projectColor }}
                              title={ev.subprojectName} />
                          ))}
                        </div>
                      )}

                      {/* todo list letter badges */}
                      {visibleIcons.todoBadges && todoListsWithTasks.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {todoListsWithTasks.slice(0, 4).map((item) => {
                            const pct = item.percentage
                            const listComplete = pct === 100
                            return (
                              <div
                                key={item.listId}
                                className={cn(
                                  "relative flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold text-white shadow-sm overflow-hidden",
                                  listComplete && "ring-2 ring-amber-400",
                                )}
                                style={{ backgroundColor: item.listColor }}
                                title={`${item.listName}: ${pct}%${listComplete ? " — all done!" : ""}`}
                              >
                                {/* fill indicator */}
                                <div
                                  className="absolute bottom-0 left-0 right-0 opacity-30 bg-black"
                                  style={{ height: `${100 - pct}%` }}
                                />
                                <span className="relative z-10">{item.letter}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Day detail sheet ── */}
      <Sheet open={!!selectedDate} onOpenChange={open => !open && setSelectedDate(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
          <div className="p-6 border-b bg-muted/30">
            <SheetHeader>
              <SheetTitle>
                {selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM do, yyyy") : ""}
              </SheetTitle>
              <SheetDescription>Work sessions and task activity. Click a panel to expand it.</SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">

              {/* todo lists — every list shows up here, with an inline "add a
                  task" box at the bottom of its expanded view, whether or not
                  it has any tasks active yet on this day */}
              {selectedDate && todoLists.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    To-Do Progress
                  </h3>
                  <div className="space-y-2">
                    {todoLists.map(list => {
                      const summary = selectedDayTodos.find(t => t.listId === list.id)
                      return (
                        <TodoDayPanel
                          key={list.id}
                          list={list}
                          stats={{
                            totalTasks: summary?.totalTasks ?? 0,
                            completedTasks: summary?.completedTasks ?? 0,
                            percentage: summary?.percentage ?? 0,
                          }}
                          date={selectedDate}
                          isToday={selectedDate === today}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* gym workouts + runs */}
              {(selectedDayWorkouts.length > 0 || selectedDayRuns.length > 0) && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Gym
                  </h3>
                  <div className="space-y-2">
                    {selectedDayWorkouts.map(workout => (
                      <WorkoutDayPanel
                        key={`w-${workout.id}`}
                        workout={workout}
                        entries={entriesByWorkout.get(workout.id) ?? []}
                        exercisesById={exercisesById}
                        setsByEntry={setsByEntry}
                      />
                    ))}
                    {selectedDayRuns.map(run => {
                      const pace = run.distanceKm != null && run.durationMinutes != null
                        ? formatPace(run.distanceKm, run.durationMinutes)
                        : null
                      const speed = run.distanceKm != null && run.durationMinutes != null
                        ? formatSpeed(run.distanceKm, run.durationMinutes)
                        : null
                      return (
                        <div key={`r-${run.id}`} className="p-3 rounded-lg border bg-card flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-sky-500 flex items-center justify-center shrink-0">
                            <Footprints className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Run</p>
                          </div>
                          {run.distanceKm != null && (
                            <span className="text-sm font-medium tabular-nums text-sky-600">{run.distanceKm} km</span>
                          )}
                          {run.durationMinutes != null && (
                            <span className="text-xs text-muted-foreground tabular-nums">{run.durationMinutes} min</span>
                          )}
                          {speed && (
                            <span className="text-xs text-muted-foreground tabular-nums bg-sky-500/10 px-1.5 py-0.5 rounded">{speed}</span>
                          )}
                          {pace && (
                            <span className="text-xs text-muted-foreground tabular-nums bg-sky-500/10 px-1.5 py-0.5 rounded">{pace}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* subproject completions */}
              {selectedDaySubEvents.filter(e => e.eventType === "completed").length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Subprojects Completed
                  </h3>
                  <div className="space-y-2">
                    {selectedDaySubEvents.filter(e => e.eventType === "completed").map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-50/50 border-emerald-100">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ev.subprojectColor ?? ev.projectColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ev.subprojectName}</p>
                          <p className="text-xs text-muted-foreground">{ev.projectName}</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* active subprojects */}
              {selectedDaySubEvents.filter(e => e.eventType === "active").length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Subprojects Worked On
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDaySubEvents.filter(e => e.eventType === "active").map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-card text-xs font-medium">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ev.subprojectColor ?? ev.projectColor }} />
                        {ev.subprojectName}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* work sessions */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Sessions
                </h3>
                {isLoadingSessions ? (
                  <div className="text-center text-muted-foreground text-sm">Loading sessions...</div>
                ) : !selectedDaySessions || selectedDaySessions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-3">
                    <CalendarIcon className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm">No sessions recorded on this day.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDaySessions.map(session => (
                      <div key={session.id} className="p-4 rounded-lg border bg-card shadow-sm flex flex-col gap-2 group">
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            {session.projectName ? (
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: session.projectColor ?? "#ccc" }} />
                                <span className="font-semibold text-sm">{session.projectName}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-sm text-muted-foreground">Unassigned</span>
                            )}
                            {session.subprojectName && (
                              <p className="text-xs text-muted-foreground ml-4">↳ {session.subprojectName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono font-bold text-primary text-sm">{formatDuration(session.durationMinutes)}</div>
                            <button
                              onClick={() => setSessionToEdit(session)}
                              title="Edit session"
                              className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {(session.startTime || session.endTime) && (
                          <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded w-fit">
                            {session.startTime || "???"} – {session.endTime || "???"}
                          </div>
                        )}
                        {session.notes && (
                          <p className="text-sm text-card-foreground bg-secondary/30 p-3 rounded-md border border-secondary">
                            {session.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <SessionDialog
        session={sessionToEdit}
        open={!!sessionToEdit}
        onOpenChange={(open) => !open && setSessionToEdit(null)}
      />
    </Layout>
  )
}
