import * as React from "react"
import { format } from "date-fns"
import {
  useCreateSession,
  getGetStatsQueryKey,
  getListSessionsQueryKey,
  getGetRecentSessionsQueryKey,
  getGetCalendarQueryKey,
  getGetSubprojectCalendarEventsQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"

export type TimerStatus = "idle" | "running" | "paused"

export type TimerSaveValues = {
  projectId?: string | null
  subprojectId?: string | null
  notes?: string | null
}

interface TimerContextValue {
  status: TimerStatus
  elapsed: number
  saveOpen: boolean
  isSaving: boolean
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  discard: () => void
  save: (values: TimerSaveValues) => void
}

const TimerContext = React.createContext<TimerContextValue | null>(null)

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

function toHHMM(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Timer state lives here, above the per-page <Layout> wrapping, because each
// page independently renders its own <Layout><ActiveTimer /></Layout> — React
// unmounts/remounts that whole subtree on every navigation, which used to
// reset any timer state kept as local component state inside ActiveTimer.
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<TimerStatus>("idle")
  const [elapsed, setElapsed] = React.useState(0)
  const [saveOpen, setSaveOpen] = React.useState(false)

  const accumulatedRef = React.useRef(0)
  const segmentStartRef = React.useRef<Date | null>(null)
  const sessionStartRef = React.useRef<Date | null>(null)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const createSession = useCreateSession()

  function tick() {
    if (!segmentStartRef.current) return
    setElapsed(accumulatedRef.current + Math.floor((Date.now() - segmentStartRef.current.getTime()) / 1000))
  }

  React.useEffect(() => {
    if (status === "running") {
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function reset() {
    accumulatedRef.current = 0
    segmentStartRef.current = null
    sessionStartRef.current = null
    setElapsed(0)
    setStatus("idle")
    setSaveOpen(false)
  }

  function start() {
    accumulatedRef.current = 0
    segmentStartRef.current = new Date()
    sessionStartRef.current = segmentStartRef.current
    setElapsed(0)
    setStatus("running")
  }

  function pause() {
    if (status !== "running" || !segmentStartRef.current) return
    accumulatedRef.current += Math.floor((Date.now() - segmentStartRef.current.getTime()) / 1000)
    segmentStartRef.current = null
    setElapsed(accumulatedRef.current)
    setStatus("paused")
  }

  function resume() {
    if (status !== "paused") return
    segmentStartRef.current = new Date()
    setStatus("running")
  }

  function stop() {
    let finalElapsed = accumulatedRef.current
    if (status === "running" && segmentStartRef.current) {
      finalElapsed += Math.floor((Date.now() - segmentStartRef.current.getTime()) / 1000)
    }
    accumulatedRef.current = finalElapsed
    segmentStartRef.current = null
    setElapsed(finalElapsed)
    setStatus("idle")
    if (finalElapsed < 1) {
      reset()
      return
    }
    setSaveOpen(true)
  }

  function discard() {
    reset()
  }

  function save(values: TimerSaveValues) {
    const sessionStart = sessionStartRef.current
    if (!sessionStart) return
    const finalElapsed = accumulatedRef.current
    const durationMinutes = Math.max(1, Math.round(finalElapsed / 60))
    const stoppedAt = new Date(sessionStart.getTime() + finalElapsed * 1000)

    createSession.mutate(
      {
        data: {
          projectId: values.projectId && values.projectId !== "none" ? Number(values.projectId) : null,
          subprojectId: values.subprojectId && values.subprojectId !== "none" ? Number(values.subprojectId) : null,
          date: format(sessionStart, "yyyy-MM-dd"),
          startTime: toHHMM(sessionStart),
          endTime: toHHMM(stoppedAt),
          durationMinutes,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Session logged", description: `${formatElapsed(finalElapsed)} recorded.` })
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetRecentSessionsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetSubprojectCalendarEventsQueryKey() })
          reset()
        },
        onError: () => {
          toast({ title: "Error saving session", variant: "destructive" })
        },
      }
    )
  }

  return (
    <TimerContext.Provider value={{ status, elapsed, saveOpen, isSaving: createSession.isPending, start, pause, resume, stop, discard, save }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const ctx = React.useContext(TimerContext)
  if (!ctx) throw new Error("useTimer must be used within a TimerProvider")
  return ctx
}

export function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}
