import * as React from "react"
import { format } from "date-fns"
import { Layout } from "@/components/layout/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useGetStats, useGetRecentSessions } from "@workspace/api-client-react"
import { Clock, CalendarDays, Calendar as CalendarIcon, History } from "lucide-react"

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetStats()
  const { data: recentSessions, isLoading: isSessionsLoading } = useGetRecentSessions({ limit: 10 })

  return (
    <Layout>
      <div className="flex flex-col gap-8 p-8 max-w-5xl mx-auto w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Overview</h1>
          <p className="text-muted-foreground">Here's how your time is looking.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

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
