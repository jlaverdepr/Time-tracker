import * as React from "react"
import { format } from "date-fns"
import { Play, Square, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  useCreateSession,
  useListProjects,
  getGetStatsQueryKey,
  getListSessionsQueryKey,
  getGetRecentSessionsQueryKey,
  getGetCalendarQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

/** Formats a Date as "HH:MM" for the time inputs */
function toHHMM(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── save-dialog schema ────────────────────────────────────────────────────────

const saveSchema = z.object({
  projectId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})
type SaveValues = z.infer<typeof saveSchema>

// ─── component ────────────────────────────────────────────────────────────────

export function ActiveTimer() {
  const [isRunning, setIsRunning] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0) // seconds
  const [startedAt, setStartedAt] = React.useState<Date | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: projects } = useListProjects()
  const createSession = useCreateSession()

  const form = useForm<SaveValues>({
    resolver: zodResolver(saveSchema),
    defaultValues: { projectId: null, notes: "" },
  })

  // tick every second while running — derive elapsed from wall clock so
  // browser tab throttling cannot cause the timer to under-count
  React.useEffect(() => {
    if (isRunning && startedAt) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, startedAt])

  function handleStart() {
    setElapsed(0)
    setStartedAt(new Date())
    setIsRunning(true)
  }

  function handleStop() {
    setIsRunning(false)
    if (elapsed < 1) {
      // nothing meaningful to save
      setStartedAt(null)
      return
    }
    setSaveOpen(true)
  }

  function handleDiscard() {
    setSaveOpen(false)
    setElapsed(0)
    setStartedAt(null)
    form.reset()
  }

  function onSubmit(values: SaveValues) {
    if (!startedAt) return
    const stoppedAt = new Date(startedAt.getTime() + elapsed * 1000)
    const durationMinutes = Math.max(1, Math.round(elapsed / 60))

    createSession.mutate(
      {
        data: {
          projectId:
            values.projectId && values.projectId !== "none"
              ? Number(values.projectId)
              : null,
          date: format(startedAt, "yyyy-MM-dd"),
          startTime: toHHMM(startedAt),
          endTime: toHHMM(stoppedAt),
          durationMinutes,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Session logged",
            description: `${formatElapsed(elapsed)} recorded.`,
          })
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() })
          queryClient.invalidateQueries({
            queryKey: getGetRecentSessionsQueryKey(),
          })
          queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey() })
          handleDiscard()
        },
        onError: () => {
          toast({
            title: "Error saving session",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <>
      {/* ── Sidebar widget ── */}
      <div
        className={`mx-4 mb-3 rounded-xl border p-3 transition-all duration-300 ${
          isRunning
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-muted/30"
        }`}
      >
        {/* header row */}
        <div className="flex items-center gap-2 mb-2.5">
          <Timer className={`h-3.5 w-3.5 ${isRunning ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Timer
          </span>
          {isRunning && (
            <span className="ml-auto flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </div>

        {/* elapsed display */}
        <div
          className={`font-mono text-2xl font-bold tracking-tighter mb-3 transition-colors ${
            isRunning ? "text-primary" : "text-muted-foreground/40"
          }`}
        >
          {formatElapsed(elapsed)}
        </div>

        {/* action button */}
        {isRunning ? (
          <Button
            size="sm"
            variant="destructive"
            className="w-full gap-2 font-semibold"
            onClick={handleStop}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop & Save
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full gap-2 font-semibold"
            variant="outline"
            onClick={handleStart}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start Timer
          </Button>
        )}
      </div>

      {/* ── Save dialog ── */}
      <Dialog open={saveOpen} onOpenChange={(o) => !o && handleDiscard()}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Save Session</DialogTitle>
            <DialogDescription>
              Tracked&nbsp;
              <span className="font-mono font-semibold text-foreground">
                {formatElapsed(elapsed)}
              </span>
              . Add a project and notes before saving.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Project</SelectItem>
                        {projects?.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="What did you work on?"
                        {...field}
                        value={field.value || ""}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
                <Button type="submit" disabled={createSession.isPending}>
                  Save Session
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
