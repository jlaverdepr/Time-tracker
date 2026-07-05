import * as React from "react"
import { Layout } from "@/components/layout/layout"
import { useGetCalendar, useListSessions, getListSessionsQueryKey } from "@workspace/api-client-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, addMonths, subMonths } from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react"
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

  const { data: calendarData, isLoading } = useGetCalendar({
    startDate: startDateStr,
    endDate: endDateStr,
  }, { query: { queryKey: ['calendar', startDateStr, endDateStr] } })

  const { data: selectedDaySessions, isLoading: isLoadingSessions } = useListSessions(
    { startDate: selectedDate || undefined, endDate: selectedDate || undefined },
    { query: { enabled: !!selectedDate, queryKey: ['sessions', selectedDate] } }
  )

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Pad the start with empty slots
  const startDayOfWeek = monthStart.getDay()
  const emptyDays = Array(startDayOfWeek).fill(null)

  const getDayData = (date: Date) => {
    const dStr = format(date, "yyyy-MM-dd")
    return calendarData?.find(d => d.date === dStr)
  }

  const getIntensityClass = (minutes: number) => {
    if (minutes === 0) return "bg-card border border-border"
    if (minutes < 60) return "bg-primary/20 text-primary-foreground border-transparent"
    if (minutes < 180) return "bg-primary/40 text-primary-foreground border-transparent"
    if (minutes < 300) return "bg-primary/60 text-primary-foreground border-transparent"
    if (minutes < 480) return "bg-primary/80 text-primary-foreground border-transparent"
    return "bg-primary text-primary-foreground border-transparent shadow-sm"
  }

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

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
                {day}
              </div>
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
                const dayData = getDayData(day)
                const minutes = dayData?.totalMinutes || 0
                const intensityClass = getIntensityClass(minutes)
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(format(day, "yyyy-MM-dd"))}
                    className={cn(
                      "h-28 rounded-xl p-3 flex flex-col justify-between transition-all relative overflow-hidden group hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background",
                      intensityClass,
                      isToday(day) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      minutes === 0 && "hover:bg-muted"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                      minutes > 0 ? "text-primary-foreground opacity-90" : "text-muted-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    
                    {minutes > 0 && (
                      <div className="text-right w-full">
                        <div className="font-mono text-xs md:text-sm font-semibold text-primary-foreground">
                          {formatDuration(minutes)}
                        </div>
                        {dayData?.projectBreakdown && (
                          <div className="flex gap-1 mt-1 justify-end flex-wrap">
                            {dayData.projectBreakdown.map((p, idx) => (
                              <div 
                                key={idx} 
                                className="w-1.5 h-1.5 rounded-full bg-white opacity-80"
                                title={p.projectName || "Unassigned"}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
          <div className="p-6 border-b bg-muted/30">
            <SheetHeader>
              <SheetTitle>
                {selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM do, yyyy") : ""}
              </SheetTitle>
              <SheetDescription>
                Details of your work sessions for this day.
              </SheetDescription>
            </SheetHeader>
          </div>
          
          <ScrollArea className="flex-1 p-6">
            {isLoadingSessions ? (
              <div className="text-center text-muted-foreground">Loading sessions...</div>
            ) : !selectedDaySessions || selectedDaySessions.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/30" />
                <p>No sessions recorded on this day.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDaySessions.map(session => (
                  <div key={session.id} className="p-4 rounded-lg border bg-card shadow-sm flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {session.projectName ? (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: session.projectColor || "#ccc" }} />
                            <span className="font-semibold">{session.projectName}</span>
                          </div>
                        ) : (
                          <span className="font-semibold text-muted-foreground">Unassigned</span>
                        )}
                      </div>
                      <div className="font-mono font-bold text-primary">
                        {formatDuration(session.durationMinutes)}
                      </div>
                    </div>
                    
                    {(session.startTime || session.endTime) && (
                      <div className="text-xs font-mono text-muted-foreground bg-muted/50 inline-flex px-2 py-1 rounded w-fit">
                        {session.startTime || "???"} - {session.endTime || "???"}
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
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </Layout>
  )
}
