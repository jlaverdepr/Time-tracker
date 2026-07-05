import * as React from "react"
import { Layout } from "@/components/layout/layout"
import {
  useGetCalendar, useListSessions, useGetSubprojectCalendarEvents,
  useGetTodoCalendarSummary,
} from "@workspace/api-client-react"
import type { SubprojectCalendarEvent, TodoCalendarSummaryItem } from "@workspace/api-client-react"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, parseISO, addMonths, subMonths,
} from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)

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

  // subproject + todo events for the selected day
  const selectedDaySubEvents = selectedDate ? (subEventsByDate.get(selectedDate) ?? []) : []
  const selectedDayTodos = selectedDate ? (todoByDate.get(selectedDate) ?? []) : []

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

        {/* legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary/70" />
            <span>Active subproject day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>Subproject completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded text-[9px] font-bold bg-violet-500 text-white flex items-center justify-center">T</div>
            <span>To-do list completion</span>
          </div>
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
                      {(activeSubEvents.length > 0 || completedSubEvents.length > 0) && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {completedSubEvents.slice(0, 3).map((ev, idx) => (
                            <div key={`c-${idx}`}
                              className="flex items-center justify-center w-4 h-4 rounded-full bg-white/90 shadow-sm"
                              title={`✓ ${ev.subprojectName}`}>
                              <CheckCircle2 className="h-3 w-3" style={{ color: ev.subprojectColor ?? ev.projectColor }} />
                            </div>
                          ))}
                          {activeSubEvents.slice(0, 4).map((ev, idx) => (
                            <div key={`a-${idx}`}
                              className="w-2 h-2 rounded-full border border-white/50 shadow-sm"
                              style={{ backgroundColor: ev.subprojectColor ?? ev.projectColor }}
                              title={ev.subprojectName} />
                          ))}
                        </div>
                      )}

                      {/* todo list letter badges */}
                      {todoListsWithTasks.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {todoListsWithTasks.slice(0, 4).map((item) => {
                            const pct = item.percentage
                            return (
                              <div
                                key={item.listId}
                                className="relative flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold text-white shadow-sm overflow-hidden"
                                style={{ backgroundColor: item.listColor }}
                                title={`${item.listName}: ${pct}%`}
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
              <SheetDescription>Work sessions and task activity.</SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">

              {/* todo list summaries */}
              {selectedDayTodos.filter(t => t.totalTasks > 0).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    To-Do Progress
                  </h3>
                  <div className="space-y-2">
                    {selectedDayTodos.filter(t => t.totalTasks > 0).map(item => (
                      <div key={item.listId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: item.listColor }}>
                          {item.letter}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.listName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${item.percentage}%`, backgroundColor: item.listColor }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {item.completedTasks}/{item.totalTasks}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-sm shrink-0" style={{ color: item.listColor }}>
                          {item.percentage}%
                        </span>
                      </div>
                    ))}
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
                      <div key={session.id} className="p-4 rounded-lg border bg-card shadow-sm flex flex-col gap-2">
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
                          <div className="font-mono font-bold text-primary text-sm">{formatDuration(session.durationMinutes)}</div>
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
    </Layout>
  )
}
