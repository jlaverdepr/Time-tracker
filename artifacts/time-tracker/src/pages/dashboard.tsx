import * as React from "react"
import { format, startOfWeek, endOfWeek } from "date-fns"
import { Layout } from "@/components/layout/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  useGetStats, useGetRecentSessions, useListTodoLists, useListTodoTasks, useListGymWorkouts,
} from "@workspace/api-client-react"
import type { TodoTask } from "@workspace/api-client-react"
import { Clock, CalendarDays, Calendar as CalendarIcon, History, ListChecks, Dumbbell } from "lucide-react"

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function isTaskCompleteToday(task: TodoTask, resetDaily: boolean): boolean {
  if (!task.completedAt) return false
  if (resetDaily) return task.completedDate === format(new Date(), "yyyy-MM-dd")
  return true
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetStats()
  const { data: recentSessions, isLoading: isSessionsLoading } = useGetRecentSessions({ limit: 10 })
  const { data: lists = [] } = useListTodoLists()
  const { data: allTasks = [] } = useListTodoTasks()
  const { data: gymWorkouts = [] } = useListGymWorkouts()

  const workoutsThisWeek = React.useMemo(() => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
    return gymWorkouts.filter(w => w.date >= weekStart && w.date <= weekEnd).length
  }, [gymWorkouts])

  // Per-list task counts
  const listStats = React.useMemo(() => lists.map(list => {
    const tasks = allTasks.filter(t => t.listId === list.id)
    const total = tasks.length
    const done = tasks.filter(t => isTaskCompleteToday(t, list.resetDaily)).length
    const pct = total === 0 ? 0 : Math.round((done / total) * 100)
    return { list, total, done, pct }
  }), [lists, allTasks])

  const overallTotal = listStats.reduce((s, l) => s + l.total, 0)
  const overallDone = listStats.reduce((s, l) => s + l.done, 0)
  const overallPct = overallTotal === 0 ? 0 : Math.round((overallDone / overallTotal) * 100)

  return (
    <Layout>
      <div className="flex flex-col gap-8 p-8 max-w-5xl mx-auto w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Overview</h1>
          <p className="text-muted-foreground">Here's how your time and tasks are looking.</p>
        </div>

        {/* time stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {isStatsLoading ? "..." : formatDuration(stats?.todayMinutes || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.todaySessions} session(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {isStatsLoading ? "..." : formatDuration(stats?.weekMinutes || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.weekSessions} session(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {isStatsLoading ? "..." : formatDuration(stats?.monthMinutes || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.monthSessions} session(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Workouts This Week</CardTitle>
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{workoutsThisWeek}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {workoutsThisWeek === 1 ? "workout" : "workouts"} logged
              </p>
            </CardContent>
          </Card>
        </div>

        {/* tasks completion */}
        {lists.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Task Completion</h2>
              <span className="ml-auto text-sm text-muted-foreground">
                {overallDone}/{overallTotal} tasks done
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* overall card */}
              <Card className="md:col-span-2">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">Overall</span>
                        <span className="font-mono font-bold text-lg">{overallPct}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${overallPct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {listStats.map(({ list, pct }) => (
                          <div key={list.id} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: list.color }} />
                            <span className="text-muted-foreground">{list.name}</span>
                            <span className="font-mono font-semibold" style={{ color: list.color }}>{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* per-list cards */}
              {listStats.map(({ list, total, done, pct }) => (
                <Card key={list.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: list.color }} />
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-sm"
                          style={{ backgroundColor: list.color }}>
                          {list.letter}
                        </div>
                        <CardTitle className="text-sm font-semibold">{list.name}</CardTitle>
                        {list.resetDaily && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">daily</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-sm" style={{ color: list.color }}>{pct}%</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center gap-3">
                      <ProgressBar pct={pct} color={list.color} />
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{done}/{total}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* recent sessions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Recent Sessions</h2>
          </div>

          <Card>
            <div className="divide-y divide-border">
              {isSessionsLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading...</div>
              ) : !recentSessions || recentSessions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No recent sessions found. Log some time!</div>
              ) : (
                recentSessions.map((session) => (
                  <div key={session.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {session.projectName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: session.projectColor || "#ccc" }} />
                            <span className="font-medium text-sm">{session.projectName}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-sm text-muted-foreground">Unassigned</span>
                        )}
                        <span className="text-muted-foreground text-xs px-2 py-0.5 rounded-full bg-secondary">
                          {format(new Date(session.date), "MMM d")}
                        </span>
                      </div>
                      {session.subprojectName && (
                        <p className="text-xs text-muted-foreground ml-4">↳ {session.subprojectName}</p>
                      )}
                      {session.notes && (
                        <p className="text-sm text-muted-foreground truncate max-w-md">{session.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="font-mono font-medium">{formatDuration(session.durationMinutes)}</div>
                      {session.startTime && session.endTime && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {session.startTime} - {session.endTime}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
