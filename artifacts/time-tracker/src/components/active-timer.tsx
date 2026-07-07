import * as React from "react"
import { Play, Pause, Square, Timer } from "lucide-react"
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
import { useListProjects, useListSubprojects } from "@workspace/api-client-react"
import { useTimer, formatElapsed } from "@/hooks/use-timer"

// ─── save-dialog schema ────────────────────────────────────────────────────────

const saveSchema = z.object({
  projectId: z.string().optional().nullable(),
  subprojectId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})
type SaveValues = z.infer<typeof saveSchema>

// ─── component ────────────────────────────────────────────────────────────────

export function ActiveTimer() {
  const { status, elapsed, saveOpen, isSaving, start, pause, resume, stop, discard, save } = useTimer()
  const { data: projects } = useListProjects()
  const { data: allSubprojects } = useListSubprojects()

  const form = useForm<SaveValues>({
    resolver: zodResolver(saveSchema),
    defaultValues: { projectId: null, subprojectId: null, notes: "" },
  })

  const selectedProjectId = form.watch("projectId")

  const availableSubprojects = React.useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "none" || !allSubprojects) return []
    return allSubprojects.filter(s => s.projectId === Number(selectedProjectId) && s.status === "active")
  }, [selectedProjectId, allSubprojects])

  React.useEffect(() => {
    form.setValue("subprojectId", null)
  }, [selectedProjectId, form])

  React.useEffect(() => {
    if (!saveOpen) form.reset({ projectId: null, subprojectId: null, notes: "" })
  }, [saveOpen, form])

  function handleDiscard() {
    discard()
    form.reset({ projectId: null, subprojectId: null, notes: "" })
  }

  function onSubmit(values: SaveValues) {
    save(values)
  }

  const isRunning = status === "running"
  const isPaused = status === "paused"
  const isActive = isRunning || isPaused

  return (
    <>
      {/* ── Sidebar widget ── */}
      <div className={`mx-4 mb-3 rounded-xl border p-3 transition-all duration-300 ${
        isRunning ? "border-primary/40 bg-primary/5" : isPaused ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/30"
      }`}>
        <div className="flex items-center gap-2 mb-2.5">
          <Timer className={`h-3.5 w-3.5 ${isRunning ? "text-primary" : isPaused ? "text-amber-500" : "text-muted-foreground"}`} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isPaused ? "Timer (Paused)" : "Timer"}
          </span>
          {isRunning && (
            <span className="ml-auto flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </div>

        <div className={`font-mono text-2xl font-bold tracking-tighter mb-3 transition-colors ${
          isRunning ? "text-primary" : isPaused ? "text-amber-600" : "text-muted-foreground/40"
        }`}>
          {formatElapsed(elapsed)}
        </div>

        {isActive ? (
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button size="sm" variant="outline" className="flex-1 gap-2 font-semibold" onClick={pause}>
                <Pause className="h-3.5 w-3.5 fill-current" />
                Pause
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1 gap-2 font-semibold" onClick={resume}>
                <Play className="h-3.5 w-3.5 fill-current" />
                Resume
              </Button>
            )}
            <Button size="sm" variant="destructive" className="flex-1 gap-2 font-semibold" onClick={stop}>
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full gap-2 font-semibold" variant="outline" onClick={start}>
            <Play className="h-3.5 w-3.5 fill-current" />
            Start Timer
          </Button>
        )}
      </div>

      {/* ── Save dialog ── */}
      <Dialog open={saveOpen} onOpenChange={o => !o && handleDiscard()}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Save Session</DialogTitle>
            <DialogDescription>
              Tracked&nbsp;
              <span className="font-mono font-semibold text-foreground">{formatElapsed(elapsed)}</span>.
              Add a project and notes before saving.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {projects?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {availableSubprojects.length > 0 && (
                <FormField control={form.control} name="subprojectId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subproject <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select subproject" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {availableSubprojects.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What did you work on?"
                      {...field}
                      value={field.value || ""}
                      autoFocus={availableSubprojects.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={handleDiscard}>Discard</Button>
                <Button type="submit" disabled={isSaving}>Save Session</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
