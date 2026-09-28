import * as React from "react"
import { format, parseISO } from "date-fns"
import { Layout } from "@/components/layout/layout"
import {
  useListGymExercises, useCreateGymExercise, useUpdateGymExercise, useDeleteGymExercise,
  useListGymWorkouts, useCreateGymWorkout, useUpdateGymWorkout, useDeleteGymWorkout,
  useListGymWorkoutEntries, useCreateGymWorkoutEntry, useDeleteGymWorkoutEntry,
  useListGymWorkoutSets, useCreateGymWorkoutSet, useUpdateGymWorkoutSet, useDeleteGymWorkoutSet,
  useListGymRuns, useCreateGymRun, useUpdateGymRun, useDeleteGymRun,
  useListGymBodyWeightLogs, useCreateGymBodyWeightLog, useUpdateGymBodyWeightLog, useDeleteGymBodyWeightLog,
  useListGymWorkoutTemplates, useCreateGymWorkoutTemplate, useDeleteGymWorkoutTemplate,
  getListGymExercisesQueryKey, getListGymWorkoutsQueryKey, getListGymWorkoutEntriesQueryKey, getListGymWorkoutSetsQueryKey,
  getListGymRunsQueryKey, getListGymBodyWeightLogsQueryKey, getListGymWorkoutTemplatesQueryKey,
} from "@workspace/api-client-react"
import type {
  GymExercise, GymExerciseCategory, GymWorkout, GymWorkoutEntry, GymWorkoutSet, GymRun, GymBodyWeightLog, GymWorkoutTemplate,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Plus, Trash2, Pencil, Check, X, Dumbbell, ListChecks, Trophy, Footprints, Save, LineChart as LineChartIcon } from "lucide-react"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { cn } from "@/lib/utils"
import { CATEGORIES, categoryColor, formatPace, formatRunTime, formatSpeed, orderCategoriesForTitle, sanitizeNumericInput, todayStr } from "@workspace/shared"

// ── constants ─────────────────────────────────────────────────────────────────

// ── exercises tab ──────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  onUpdate,
  onDelete,
}: {
  exercise: GymExercise
  onUpdate: (id: number, data: { name?: string; category?: GymExerciseCategory }) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState(exercise.name)
  const editRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  function handleSubmitEdit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== exercise.name) onUpdate(exercise.id, { name: trimmed })
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg group hover:bg-muted/30 transition-colors">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(exercise.category) }} />
      {editing ? (
        <div className="flex-1 flex items-center gap-1.5">
          <Input
            ref={editRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleSubmitEdit()
              if (e.key === "Escape") setEditing(false)
            }}
            className="h-7 text-sm px-1.5"
          />
          <button className="shrink-0" onClick={handleSubmitEdit}>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          </button>
          <button className="shrink-0" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <span
          className="flex-1 text-sm select-none min-w-0 truncate"
          onDoubleClick={() => { setEditValue(exercise.name); setEditing(true) }}
        >
          {exercise.name}
        </span>
      )}
      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity shrink-0">
          <button onClick={() => { setEditValue(exercise.name); setEditing(true) }}
            className="p-1 rounded hover:bg-muted transition-colors">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={() => onDelete(exercise.id)}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

function ExercisesTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: exercises = [], isLoading } = useListGymExercises()
  const createExercise = useCreateGymExercise()
  const updateExercise = useUpdateGymExercise()
  const deleteExercise = useDeleteGymExercise()

  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState<GymExerciseCategory>("Upper Body")
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListGymExercisesQueryKey() })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createExercise.mutate({ data: { name: name.trim(), category } }, {
      onSuccess: () => { invalidate(); setName(""); toast({ title: "Exercise added" }) },
    })
  }

  function handleUpdate(id: number, data: { name?: string; category?: GymExerciseCategory }) {
    updateExercise.mutate({ id, data }, { onSuccess: () => invalidate() })
  }

  function handleDelete() {
    if (!deleteId) return
    deleteExercise.mutate({ id: deleteId }, {
      onSuccess: () => { invalidate(); setDeleteId(null); toast({ title: "Exercise deleted" }) },
    })
  }

  const byCategory = React.useMemo(() => {
    const map = new Map<string, GymExercise[]>()
    for (const ex of exercises) {
      if (!map.has(ex.category)) map.set(ex.category, [])
      map.get(ex.category)!.push(ex)
    }
    return map
  }, [exercises])

  return (
    <div className="flex flex-col gap-4">
      {/* add exercise */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border rounded-2xl bg-card shadow-sm">
        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Add an exercise…"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/40 min-w-0"
        />
        <Select value={category} onValueChange={v => setCategory(v as GymExerciseCategory)}>
          <SelectTrigger className="h-8 w-[150px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                  {c.value}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {name.trim() && (
          <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-md bg-primary text-primary-foreground shrink-0">
            Add
          </button>
        )}
      </form>

      {/* grouped list */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading exercises...</div>
      ) : exercises.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-24 flex flex-col items-center gap-4 text-muted-foreground">
          <ListChecks className="h-12 w-12 opacity-20" />
          <div className="text-center">
            <p className="font-semibold text-foreground">No exercises yet</p>
            <p className="text-sm">Add your first exercise above.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.filter(c => byCategory.has(c.value)).map(c => (
            <div key={c.value} className="bg-card border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="font-semibold text-sm flex-1">{c.value}</span>
                <span className="text-xs text-muted-foreground">{byCategory.get(c.value)!.length}</span>
              </div>
              <div className="p-2">
                {byCategory.get(c.value)!.map(ex => (
                  <ExerciseRow key={ex.id} exercise={ex} onUpdate={handleUpdate} onDelete={setDeleteId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exercise?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove it from the list and from any logged workouts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleDelete() }} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── log workout tab ─────────────────────────────────────────────────────────────

const MAX_SETS = 5

function SetInput({
  set,
  index,
  onUpdate,
  onToggleFailure,
  onDelete,
  onTabNext,
  focusRequest,
}: {
  set: GymWorkoutSet
  index: number
  onUpdate: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onToggleFailure: (id: number, next: boolean) => void
  onDelete: (id: number) => void
  onTabNext: (id: number) => boolean
  focusRequest: { id: number } | null
}) {
  const hasBoth = set.reps != null && set.weight != null
  const [editing, setEditing] = React.useState(!hasBoth)
  const [repsText, setRepsText] = React.useState(set.reps != null ? String(set.reps) : "")
  const [weightText, setWeightText] = React.useState(set.weight != null ? String(set.weight) : "")
  const repsInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setRepsText(set.reps != null ? String(set.reps) : "")
    setWeightText(set.weight != null ? String(set.weight) : "")
    if (set.reps != null && set.weight != null) setEditing(false)
  }, [set.reps, set.weight])

  // A sibling set's Tab handler asked this set to become the next stop:
  // open it for editing and focus its reps field once it's on the page.
  // Keyed on the focusRequest object identity (not just the id) so asking
  // for the same set twice in a row still re-triggers the focus.
  React.useEffect(() => {
    if (focusRequest?.id === set.id) setEditing(true)
  }, [focusRequest, set.id])

  React.useEffect(() => {
    if (focusRequest?.id === set.id && editing) {
      repsInputRef.current?.focus()
      repsInputRef.current?.select()
    }
  }, [focusRequest, set.id, editing])

  function commit() {
    const repsTrim = repsText.trim()
    const weightTrim = weightText.trim()
    const repsVal = repsTrim === "" ? null : Number(repsTrim)
    const weightVal = weightTrim === "" ? null : Number(weightTrim)
    if (repsVal !== null && Number.isNaN(repsVal)) return
    if (weightVal !== null && Number.isNaN(weightVal)) return
    if (repsVal !== (set.reps ?? null) || weightVal !== (set.weight ?? null)) {
      onUpdate(set.id, { reps: repsVal, weight: weightVal })
    }
    if (repsVal != null && weightVal != null) setEditing(false)
  }

  function handleWeightKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); return }
    if (e.key === "Tab" && !e.shiftKey) {
      // Only take over Tab when there's somewhere for it to go (another set,
      // or room to add one) — otherwise let the browser tab out normally.
      if (onTabNext(set.id)) e.preventDefault()
      commit()
    }
  }

  const inputClass = cn(
    "h-7 text-center text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30",
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  )

  return (
    <div className="flex flex-col items-center gap-0.5 group/slot relative">
      <span className="text-[10px] leading-none text-muted-foreground">Set {index}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={repsInputRef}
            type="text" inputMode="numeric"
            value={repsText}
            onChange={e => setRepsText(sanitizeNumericInput(e.target.value, false))}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            placeholder="reps"
            className={cn(inputClass, "w-10 pointer-coarse:h-9 pointer-coarse:w-12")}
          />
          <span className="text-[10px] leading-none text-muted-foreground shrink-0">x</span>
          <input
            type="text" inputMode="decimal"
            value={weightText}
            onChange={e => setWeightText(sanitizeNumericInput(e.target.value, true))}
            onBlur={commit}
            onKeyDown={handleWeightKeyDown}
            placeholder="kg"
            className={cn(inputClass, "w-14 pointer-coarse:h-9 pointer-coarse:w-16")}
          />
        </div>
      ) : (
        <div
          className={cn(
            "h-7 pointer-coarse:h-9 px-2 flex items-center justify-center text-xs pointer-coarse:text-sm font-medium rounded-md border bg-background whitespace-nowrap",
            set.failure && "border-red-500 text-red-600",
          )}
        >
          {set.reps} x {set.weight} kg
        </div>
      )}
      {/* Mouse: small badges on the set's corner, shown on hover. Touch: a finger-sized row under the set. */}
      <div className="absolute -top-1 -right-1 flex items-center gap-0.5 opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-coarse:static pointer-coarse:opacity-100 pointer-coarse:gap-2 pointer-coarse:mt-1">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} title="Edit"
            className="h-4 w-4 pointer-coarse:h-7 pointer-coarse:w-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20">
            <Pencil className="h-2.5 w-2.5 pointer-coarse:h-3.5 pointer-coarse:w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggleFailure(set.id, !set.failure)}
          title={set.failure ? "Unmark failure" : "Mark as failure"}
          className={cn(
            "h-4 w-4 pointer-coarse:h-7 pointer-coarse:w-7 rounded-full flex items-center justify-center text-[9px] pointer-coarse:text-xs font-bold",
            set.failure ? "bg-red-600 text-white opacity-100" : "bg-red-100 text-red-600 hover:bg-red-200",
          )}
        >
          F
        </button>
        <button
          type="button"
          onClick={() => onDelete(set.id)}
          title="Delete set"
          className="h-4 w-4 pointer-coarse:h-7 pointer-coarse:w-7 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-2.5 w-2.5 pointer-coarse:h-3.5 pointer-coarse:w-3.5" />
        </button>
      </div>
    </div>
  )
}

function SetGroup({
  sets,
  isWarmup,
  entryId,
  onCreateSet,
  onUpdateSet,
  onToggleFailure,
  onDeleteSet,
}: {
  sets: GymWorkoutSet[]
  isWarmup: boolean
  entryId: number
  onCreateSet: (entryId: number, isWarmup: boolean, nextIndex: number) => void
  onUpdateSet: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onToggleFailure: (id: number, next: boolean) => void
  onDeleteSet: (id: number) => void
}) {
  const sorted = [...sets].sort((a, b) => a.setIndex - b.setIndex)
  const canAddMore = sorted.length < MAX_SETS

  const [focusRequest, setFocusRequest] = React.useState<{ id: number } | null>(null)
  const prevIdsRef = React.useRef<Set<number>>(new Set(sorted.map(s => s.id)))
  const pendingNewSetRef = React.useRef(false)

  // Once the newly-created set (from a Tab-past-the-last-set request) shows
  // up in the sets list, hand focus to it — it's the one with an id we
  // haven't seen before.
  React.useEffect(() => {
    const currentIds = new Set(sorted.map(s => s.id))
    if (pendingNewSetRef.current) {
      const newSet = sorted.find(s => !prevIdsRef.current.has(s.id))
      if (newSet) {
        setFocusRequest({ id: newSet.id })
        pendingNewSetRef.current = false
      }
    }
    prevIdsRef.current = currentIds
  }, [sets])

  function handleTabNext(fromId: number): boolean {
    const idx = sorted.findIndex(s => s.id === fromId)
    if (idx === -1) return false
    if (idx < sorted.length - 1) {
      setFocusRequest({ id: sorted[idx + 1].id })
      return true
    }
    if (canAddMore) {
      pendingNewSetRef.current = true
      onCreateSet(entryId, isWarmup, sorted.length + 1)
      return true
    }
    return false
  }

  return (
    <div className="flex flex-wrap items-start md:items-end gap-1.5 pointer-coarse:gap-2.5 justify-start md:justify-end">
      {sorted.map((s, i) => (
        <SetInput
          key={s.id} set={s} index={i + 1}
          onUpdate={onUpdateSet} onToggleFailure={onToggleFailure} onDelete={onDeleteSet}
          onTabNext={handleTabNext} focusRequest={focusRequest}
        />
      ))}
      {canAddMore && (
        <button
          type="button"
          onClick={() => onCreateSet(entryId, isWarmup, sorted.length + 1)}
          className="h-7 pointer-coarse:h-9 mt-3 md:mt-0 px-2 rounded-md border border-dashed text-[10px] pointer-coarse:text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors flex items-center gap-1 shrink-0"
        >
          <Plus className="h-3 w-3" />
          Add Set
        </button>
      )}
    </div>
  )
}

function WorkoutEntryRow({
  entry,
  exercise,
  sets,
  onDelete,
  onCreateSet,
  onUpdateSet,
  onToggleFailure,
  onDeleteSet,
}: {
  entry: GymWorkoutEntry
  exercise: GymExercise | undefined
  sets: GymWorkoutSet[]
  onDelete: (id: number) => void
  onCreateSet: (entryId: number, isWarmup: boolean, nextIndex: number) => void
  onUpdateSet: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onToggleFailure: (id: number, next: boolean) => void
  onDeleteSet: (id: number) => void
}) {
  const [warmupOpen, setWarmupOpen] = React.useState(false)
  const mainSets = sets.filter(s => !s.isWarmup)
  const warmupSets = sets.filter(s => s.isWarmup)
  const hasWarmupData = warmupSets.length > 0
  const filledWarmupSets = [...warmupSets]
    .sort((a, b) => a.setIndex - b.setIndex)
    .filter(s => s.reps != null && s.weight != null)

  function handleAddOrEditWarmup() {
    if (warmupSets.length === 0) onCreateSet(entry.id, true, 1)
    setWarmupOpen(true)
  }

  return (
    <div className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-xl border bg-card group">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(exercise?.category ?? "Minor") }} />

      <div className="flex-1 md:flex-none md:w-44 min-w-0 md:shrink-0 flex flex-col justify-center gap-0.5">
        <div className="text-sm font-medium md:truncate">{exercise?.name ?? "Unknown exercise"}</div>
        {!warmupOpen && (
          <button
            onClick={handleAddOrEditWarmup}
            className="text-[10px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 text-left"
          >
            {hasWarmupData ? "Edit Warmup" : "Add Warmup"}
          </button>
        )}
      </div>

      <div className="order-last md:order-none w-full md:w-auto md:flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <SetGroup sets={mainSets} isWarmup={false} entryId={entry.id}
          onCreateSet={onCreateSet} onUpdateSet={onUpdateSet} onToggleFailure={onToggleFailure} onDeleteSet={onDeleteSet} />
        {warmupOpen ? (
          <div className="flex flex-wrap items-end gap-2 justify-start md:justify-end">
            <span className="text-[10px] text-muted-foreground shrink-0 pb-1.5">Warmup</span>
            <SetGroup sets={warmupSets} isWarmup={true} entryId={entry.id}
              onCreateSet={onCreateSet} onUpdateSet={onUpdateSet} onToggleFailure={onToggleFailure} onDeleteSet={onDeleteSet} />
            <button onClick={() => setWarmupOpen(false)} className="shrink-0 pb-1.5" title="Done editing warmup">
              <Check className="h-4 w-4 text-emerald-600" />
            </button>
          </div>
        ) : filledWarmupSets.length > 0 ? (
          <div className="text-xs text-muted-foreground md:text-right">
            Warmup: {filledWarmupSets.map(s => `${s.reps} x ${s.weight} kg`).join(", ")}
          </div>
        ) : null}
      </div>

      <button onClick={() => onDelete(entry.id)}
        className="p-1 pointer-coarse:p-2 md:order-last rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 shrink-0">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}

const WORKOUT_TITLE_PRESETS = ["Chest", "Legs", "Back"] as const

function WorkoutDetailsDialog({
  open,
  onOpenChange,
  workout,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: GymWorkout
  onSave: (id: number, data: { title: string | null; date: string }) => void
}) {
  const presets: readonly string[] = WORKOUT_TITLE_PRESETS
  const isPreset = workout.title != null && presets.includes(workout.title)
  const [selected, setSelected] = React.useState<string>(isPreset ? workout.title! : workout.title ? "Other" : "Chest")
  const [customTitle, setCustomTitle] = React.useState<string>(!isPreset && workout.title ? workout.title : "")
  const [date, setDate] = React.useState(workout.date)

  React.useEffect(() => {
    if (!open) return
    const preset = workout.title != null && presets.includes(workout.title)
    setSelected(preset ? workout.title! : workout.title ? "Other" : "Chest")
    setCustomTitle(!preset && workout.title ? workout.title : "")
    setDate(workout.date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workout.title, workout.date])

  function handleSave() {
    const title = selected === "Other" ? customTitle.trim() : selected
    onSave(workout.id, { title: title || null, date })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>Workout details</DialogTitle>
          <DialogDescription>Give this workout a title and set its date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKOUT_TITLE_PRESETS.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {selected === "Other" && (
            <Input
              autoFocus
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="Custom title…"
            />
          )}
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={selected === "Other" && !customTitle.trim()}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WorkoutCard({
  workout,
  entries,
  exercisesById,
  setsByEntry,
  onDeleteEntry,
  onCreateSet,
  onUpdateSet,
  onToggleFailure,
  onDeleteSet,
  onDeleteWorkout,
  onUpdateWorkout,
  onAddExercise,
  onSaveAsTemplate,
}: {
  workout: GymWorkout
  entries: GymWorkoutEntry[]
  exercisesById: Map<number, GymExercise>
  setsByEntry: Map<number, GymWorkoutSet[]>
  onDeleteEntry: (id: number) => void
  onCreateSet: (entryId: number, isWarmup: boolean, nextIndex: number) => void
  onUpdateSet: (id: number, data: { reps?: number | null; weight?: number | null }) => void
  onToggleFailure: (id: number, next: boolean) => void
  onDeleteSet: (id: number) => void
  onDeleteWorkout: (id: number) => void
  onUpdateWorkout: (id: number, data: { title: string | null; date: string }) => void
  onAddExercise: (workoutId: number) => void
  onSaveAsTemplate: (workout: GymWorkout, entries: GymWorkoutEntry[]) => void
}) {
  const [editingDetails, setEditingDetails] = React.useState(false)
  const dateLabel = format(parseISO(workout.date), "EEEE, MMM d")

  const volume = React.useMemo(() => {
    let total = 0
    for (const entry of entries) {
      for (const s of setsByEntry.get(entry.id) ?? []) {
        if (s.isWarmup || s.reps == null || s.weight == null) continue
        total += s.reps * s.weight
      }
    }
    return total
  }, [entries, setsByEntry])

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b flex items-center gap-2.5 group/hdr">
        <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          {workout.title ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base truncate">{workout.title}</span>
                <button onClick={() => setEditingDetails(true)}
                  className="p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/hdr:opacity-100 pointer-coarse:opacity-100 shrink-0" title="Edit details">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
              <div className="md:hidden text-[11px] text-muted-foreground tabular-nums">
                {entries.length} exercise{entries.length === 1 ? "" : "s"}{volume > 0 && ` · ${volume.toLocaleString("en-US")} kg total`}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{dateLabel}</span>
              <button onClick={() => setEditingDetails(true)}
                className="p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/hdr:opacity-100 pointer-coarse:opacity-100 shrink-0" title="Edit details">
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
        {volume > 0 && (
          <span className="hidden md:inline text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
            {volume.toLocaleString('en-US')} kg total
          </span>
        )}
        <span className="hidden md:inline text-xs text-muted-foreground shrink-0">{entries.length} exercise{entries.length === 1 ? "" : "s"}</span>
        <button onClick={() => onDeleteWorkout(workout.id)}
          className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover/hdr:opacity-100 pointer-coarse:opacity-100 shrink-0" title="Delete workout">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-4">No exercises logged yet</p>
        ) : (
          entries.map(entry => (
            <WorkoutEntryRow
              key={entry.id}
              entry={entry}
              exercise={exercisesById.get(entry.exerciseId)}
              sets={setsByEntry.get(entry.id) ?? []}
              onDelete={onDeleteEntry}
              onCreateSet={onCreateSet}
              onUpdateSet={onUpdateSet}
              onToggleFailure={onToggleFailure}
              onDeleteSet={onDeleteSet}
            />
          ))
        )}
        <div className="flex items-center gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={() => onAddExercise(workout.id)} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add Exercise
          </Button>
          {entries.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onSaveAsTemplate(workout, entries)} className="gap-2 text-muted-foreground">
              <Save className="h-3.5 w-3.5" />
              Save as Template
            </Button>
          )}
        </div>
      </div>

      <WorkoutDetailsDialog open={editingDetails} onOpenChange={setEditingDetails} workout={workout} onSave={onUpdateWorkout} />
    </div>
  )
}

// ── runs ─────────────────────────────────────────────────────────────────────────

type RunFormData = { date: string; distanceKm: number | null; durationSeconds: number | null }

function RunFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: RunFormData
  onSubmit: (data: RunFormData) => void
  title: string
}) {
  const [date, setDate] = React.useState(initial.date)
  const [distance, setDistance] = React.useState(initial.distanceKm != null ? String(initial.distanceKm) : "")
  const [minutes, setMinutes] = React.useState("")
  const [seconds, setSeconds] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setDate(initial.date)
    setDistance(initial.distanceKm != null ? String(initial.distanceKm) : "")
    setMinutes(initial.durationSeconds != null ? String(Math.floor(initial.durationSeconds / 60)) : "")
    setSeconds(initial.durationSeconds != null ? String(initial.durationSeconds % 60) : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.date, initial.distanceKm, initial.durationSeconds])

  function handleSubmit() {
    const noTime = minutes.trim() === "" && seconds.trim() === ""
    onSubmit({
      date,
      distanceKm: distance.trim() === "" ? null : Number(distance),
      durationSeconds: noTime ? null : Number(minutes || 0) * 60 + Number(seconds || 0),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Distance and time for this run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Distance (km)</label>
              <Input
                type="text" inputMode="decimal"
                value={distance}
                onChange={e => setDistance(sanitizeNumericInput(e.target.value, true))}
                placeholder="5.2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Time (min : sec)</label>
              <div className="flex items-center gap-1">
                <Input
                  type="text" inputMode="numeric" aria-label="Minutes"
                  value={minutes}
                  onChange={e => setMinutes(sanitizeNumericInput(e.target.value, false))}
                  placeholder="32"
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  type="text" inputMode="numeric" aria-label="Seconds"
                  value={seconds}
                  onChange={e => {
                    const v = sanitizeNumericInput(e.target.value, false).slice(0, 2)
                    setSeconds(v !== "" && Number(v) > 59 ? "59" : v)
                  }}
                  placeholder="00"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RunCard({
  run,
  onDelete,
  onUpdate,
}: {
  run: GymRun
  onDelete: (id: number) => void
  onUpdate: (id: number, data: RunFormData) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const dateLabel = format(parseISO(run.date), "EEEE, MMM d")
  const pace = run.distanceKm != null && run.durationSeconds != null
    ? formatPace(run.distanceKm, run.durationSeconds)
    : null
  const speed = run.distanceKm != null && run.durationSeconds != null
    ? formatSpeed(run.distanceKm, run.durationSeconds)
    : null

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden group">
      <div className="px-4 py-3 flex flex-wrap md:flex-nowrap items-center gap-x-2.5 gap-y-2">
        <div className="h-6 w-6 rounded-full bg-sky-500 flex items-center justify-center shrink-0">
          <Footprints className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{dateLabel}</span>
          <button onClick={() => setEditing(true)}
            className="p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 shrink-0" title="Edit run">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
        <div className="order-last md:order-none w-full md:w-auto pl-8 md:pl-0 flex flex-wrap items-center gap-2.5">
          {run.distanceKm != null && (
            <span className="text-sm font-medium tabular-nums text-sky-600 whitespace-nowrap">{run.distanceKm} km</span>
          )}
          {run.durationSeconds != null && (
            <span className="text-sm text-muted-foreground tabular-nums">{formatRunTime(run.durationSeconds)}</span>
          )}
          {speed && (
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap bg-sky-500/10 px-1.5 py-0.5 rounded">{speed}</span>
          )}
          {pace && (
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap bg-sky-500/10 px-1.5 py-0.5 rounded">{pace}</span>
          )}
        </div>
        <button onClick={() => onDelete(run.id)}
          className="p-1 pointer-coarse:p-2 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 shrink-0" title="Delete run">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <RunFormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Run details"
        initial={{ date: run.date, distanceKm: run.distanceKm ?? null, durationSeconds: run.durationSeconds ?? null }}
        onSubmit={data => onUpdate(run.id, data)}
      />
    </div>
  )
}

type LogItem =
  | { type: "workout"; date: string; createdAt: string; data: GymWorkout }
  | { type: "run"; date: string; createdAt: string; data: GymRun }

function LogWorkoutTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: workouts = [], isLoading: workoutsLoading } = useListGymWorkouts()
  const { data: runs = [], isLoading: runsLoading } = useListGymRuns()
  const { data: exercises = [] } = useListGymExercises()
  const { data: allEntries = [] } = useListGymWorkoutEntries()
  const { data: allSets = [] } = useListGymWorkoutSets()
  const { data: templates = [] } = useListGymWorkoutTemplates()

  const createWorkout = useCreateGymWorkout()
  const updateWorkout = useUpdateGymWorkout()
  const deleteWorkout = useDeleteGymWorkout()
  const createEntry = useCreateGymWorkoutEntry()
  const deleteEntry = useDeleteGymWorkoutEntry()
  const createSet = useCreateGymWorkoutSet()
  const updateSet = useUpdateGymWorkoutSet()
  const deleteSet = useDeleteGymWorkoutSet()
  const createRun = useCreateGymRun()
  const updateRun = useUpdateGymRun()
  const deleteRun = useDeleteGymRun()
  const createTemplate = useCreateGymWorkoutTemplate()
  const deleteTemplate = useDeleteGymWorkoutTemplate()

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickerWorkoutId, setPickerWorkoutId] = React.useState<number | null>(null)
  const [pickerExerciseId, setPickerExerciseId] = React.useState<string>("")
  const [deleteWorkoutId, setDeleteWorkoutId] = React.useState<number | null>(null)
  const [addWorkoutOpen, setAddWorkoutOpen] = React.useState(false)
  const [newWorkoutTitle, setNewWorkoutTitle] = React.useState<string>("Chest")
  const [newWorkoutCustomTitle, setNewWorkoutCustomTitle] = React.useState("")
  const [newWorkoutDate, setNewWorkoutDate] = React.useState(todayStr())
  const [addRunOpen, setAddRunOpen] = React.useState(false)
  const [saveTemplateFor, setSaveTemplateFor] = React.useState<{ workout: GymWorkout; entries: GymWorkoutEntry[] } | null>(null)
  const [templateName, setTemplateName] = React.useState("")

  function invalidateWorkouts() {
    queryClient.invalidateQueries({ queryKey: getListGymWorkoutsQueryKey() })
  }
  function invalidateEntries() {
    queryClient.invalidateQueries({ queryKey: getListGymWorkoutEntriesQueryKey() })
  }
  function invalidateSets() {
    queryClient.invalidateQueries({ queryKey: getListGymWorkoutSetsQueryKey() })
  }
  function invalidateRuns() {
    queryClient.invalidateQueries({ queryKey: getListGymRunsQueryKey() })
  }
  function invalidateTemplates() {
    queryClient.invalidateQueries({ queryKey: getListGymWorkoutTemplatesQueryKey() })
  }

  const exercisesById = React.useMemo(() => {
    const map = new Map<number, GymExercise>()
    for (const ex of exercises) map.set(ex.id, ex)
    return map
  }, [exercises])

  const entriesByWorkout = React.useMemo(() => {
    const map = new Map<number, GymWorkoutEntry[]>()
    for (const e of allEntries) {
      if (!map.has(e.workoutId)) map.set(e.workoutId, [])
      map.get(e.workoutId)!.push(e)
    }
    return map
  }, [allEntries])

  const setsByEntry = React.useMemo(() => {
    const map = new Map<number, GymWorkoutSet[]>()
    for (const s of allSets) {
      if (!map.has(s.entryId)) map.set(s.entryId, [])
      map.get(s.entryId)!.push(s)
    }
    return map
  }, [allSets])

  const logItems = React.useMemo<LogItem[]>(() => {
    const items: LogItem[] = [
      ...workouts.map((w): LogItem => ({ type: "workout", date: w.date, createdAt: w.createdAt, data: w })),
      ...runs.map((r): LogItem => ({ type: "run", date: r.date, createdAt: r.createdAt, data: r })),
    ]
    return items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [workouts, runs])

  const byCategory = React.useMemo(() => {
    const map = new Map<string, GymExercise[]>()
    for (const ex of exercises) {
      if (!map.has(ex.category)) map.set(ex.category, [])
      map.get(ex.category)!.push(ex)
    }
    return map
  }, [exercises])

  function openPicker(workoutId: number) {
    setPickerWorkoutId(workoutId)
    setPickerExerciseId("")
    setPickerOpen(true)
  }

  const pickerWorkout = workouts.find(w => w.id === pickerWorkoutId)
  const pickerCategories = orderCategoriesForTitle(pickerWorkout?.title)

  function handleConfirmExercise() {
    if (!pickerExerciseId || !pickerWorkoutId) return
    createEntry.mutate({ data: { workoutId: pickerWorkoutId, exerciseId: Number(pickerExerciseId) } }, {
      onSuccess: () => {
        invalidateEntries(); invalidateSets(); setPickerOpen(false); toast({ title: "Exercise added" })
      },
    })
  }

  function handleDeleteEntry(id: number) {
    deleteEntry.mutate({ id }, { onSuccess: () => { invalidateEntries(); invalidateSets() } })
  }

  function handleCreateSet(entryId: number, isWarmup: boolean, nextIndex: number) {
    createSet.mutate({ data: { entryId, isWarmup, setIndex: nextIndex } }, { onSuccess: () => invalidateSets() })
  }

  function handleUpdateSet(id: number, data: { reps?: number | null; weight?: number | null }) {
    updateSet.mutate({ id, data }, { onSuccess: () => invalidateSets() })
  }

  function handleToggleFailure(id: number, next: boolean) {
    updateSet.mutate({ id, data: { failure: next } }, { onSuccess: () => invalidateSets() })
  }

  function handleDeleteSet(id: number) {
    deleteSet.mutate({ id }, { onSuccess: () => invalidateSets() })
  }

  function handleUpdateWorkout(id: number, data: { title: string | null; date: string }) {
    updateWorkout.mutate({ id, data }, { onSuccess: () => invalidateWorkouts() })
  }

  function handleDeleteWorkout() {
    if (!deleteWorkoutId) return
    deleteWorkout.mutate({ id: deleteWorkoutId }, {
      onSuccess: () => { invalidateWorkouts(); invalidateEntries(); invalidateSets(); setDeleteWorkoutId(null); toast({ title: "Workout deleted" }) },
    })
  }

  function openAddWorkout() {
    setNewWorkoutTitle("Chest")
    setNewWorkoutCustomTitle("")
    setNewWorkoutDate(todayStr())
    setAddWorkoutOpen(true)
  }

  const newWorkoutEffectiveTitle = newWorkoutTitle === "Other" ? newWorkoutCustomTitle.trim() : newWorkoutTitle

  const { suggestedTemplates, otherTemplates } = React.useMemo(() => {
    const norm = newWorkoutEffectiveTitle.toLowerCase()
    if (!norm) return { suggestedTemplates: [] as GymWorkoutTemplate[], otherTemplates: templates }
    const suggested: GymWorkoutTemplate[] = []
    const others: GymWorkoutTemplate[] = []
    for (const t of templates) {
      const tn = t.name.toLowerCase()
      if (tn.includes(norm) || norm.includes(tn)) suggested.push(t)
      else others.push(t)
    }
    return { suggestedTemplates: suggested, otherTemplates: others }
  }, [templates, newWorkoutEffectiveTitle])

  function handleBlankWorkout(title: string) {
    createWorkout.mutate({ data: { date: newWorkoutDate, title: title || undefined } }, {
      onSuccess: () => { invalidateWorkouts(); setAddWorkoutOpen(false); toast({ title: "Workout added" }) },
    })
  }

  function handleWorkoutFromTemplate(template: GymWorkoutTemplate) {
    createWorkout.mutate({ data: { date: newWorkoutDate, title: template.name } }, {
      onSuccess: (workout) => {
        invalidateWorkouts()
        const ids = template.exerciseIds
        function next(i: number) {
          if (i >= ids.length) { setAddWorkoutOpen(false); toast({ title: "Workout added" }); return }
          createEntry.mutate({ data: { workoutId: workout.id, exerciseId: ids[i] } }, {
            onSuccess: () => { invalidateEntries(); invalidateSets(); next(i + 1) },
          })
        }
        next(0)
      },
    })
  }

  function handleDeleteTemplate(id: number) {
    deleteTemplate.mutate({ id }, { onSuccess: () => invalidateTemplates() })
  }

  function openSaveTemplate(workout: GymWorkout, entries: GymWorkoutEntry[]) {
    setTemplateName(workout.title ?? "")
    setSaveTemplateFor({ workout, entries })
  }

  function handleSaveTemplate() {
    if (!saveTemplateFor || !templateName.trim()) return
    const exerciseIds = [...new Set(saveTemplateFor.entries.map(e => e.exerciseId))]
    createTemplate.mutate({ data: { name: templateName.trim(), exerciseIds } }, {
      onSuccess: () => { invalidateTemplates(); setSaveTemplateFor(null); toast({ title: "Template saved" }) },
    })
  }

  function handleAddRun(data: RunFormData) {
    createRun.mutate({
      data: { date: data.date, distanceKm: data.distanceKm ?? undefined, durationSeconds: data.durationSeconds ?? undefined },
    }, { onSuccess: () => { invalidateRuns(); toast({ title: "Run logged" }) } })
  }

  function handleUpdateRun(id: number, data: RunFormData) {
    updateRun.mutate({ id, data }, { onSuccess: () => invalidateRuns() })
  }

  function handleDeleteRun(id: number) {
    deleteRun.mutate({ id }, { onSuccess: () => invalidateRuns() })
  }

  const isLoading = workoutsLoading || runsLoading

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="hidden sm:block text-sm text-muted-foreground">Log a workout or a run.</p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setAddRunOpen(true)} className="gap-2 flex-1 sm:flex-none">
            <Footprints className="h-4 w-4" />
            Add Run
          </Button>
          <Button onClick={openAddWorkout} className="gap-2 flex-1 sm:flex-none">
            <Plus className="h-4 w-4" />
            Add Workout
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading log...</div>
      ) : logItems.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-24 flex flex-col items-center gap-4 text-muted-foreground">
          <Dumbbell className="h-12 w-12 opacity-20" />
          <div className="text-center">
            <p className="font-semibold text-foreground">Nothing logged yet</p>
            <p className="text-sm">Tap "Add Workout" or "Add Run" to log your first one.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {logItems.map(item => item.type === "workout" ? (
            <WorkoutCard
              key={`w-${item.data.id}`}
              workout={item.data}
              entries={entriesByWorkout.get(item.data.id) ?? []}
              exercisesById={exercisesById}
              setsByEntry={setsByEntry}
              onDeleteEntry={handleDeleteEntry}
              onCreateSet={handleCreateSet}
              onUpdateSet={handleUpdateSet}
              onToggleFailure={handleToggleFailure}
              onDeleteSet={handleDeleteSet}
              onDeleteWorkout={setDeleteWorkoutId}
              onUpdateWorkout={handleUpdateWorkout}
              onAddExercise={openPicker}
              onSaveAsTemplate={openSaveTemplate}
            />
          ) : (
            <RunCard
              key={`r-${item.data.id}`}
              run={item.data}
              onDelete={handleDeleteRun}
              onUpdate={handleUpdateRun}
            />
          ))}
        </div>
      )}

      {/* ── exercise picker dialog ── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Add an exercise</DialogTitle>
            <DialogDescription>Pick an exercise to add to this workout.</DialogDescription>
          </DialogHeader>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add exercises in the Exercises tab first.</p>
          ) : (
            <Select value={pickerExerciseId} onValueChange={setPickerExerciseId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select an exercise…" />
              </SelectTrigger>
              <SelectContent>
                {pickerCategories.filter(c => byCategory.has(c.value)).map(c => (
                  <SelectGroup key={c.value}>
                    <SelectLabel>{c.value}</SelectLabel>
                    {byCategory.get(c.value)!.map(ex => (
                      <SelectItem key={ex.id} value={String(ex.id)}>{ex.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmExercise} disabled={!pickerExerciseId || createEntry.isPending}>
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── new workout dialog (blank or from template) ── */}
      <Dialog open={addWorkoutOpen} onOpenChange={setAddWorkoutOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>New workout</DialogTitle>
            <DialogDescription>Pick a title and date, then start blank or from a matching template.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              type="date"
              aria-label="Workout date"
              value={newWorkoutDate}
              onChange={e => setNewWorkoutDate(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Select value={newWorkoutTitle} onValueChange={setNewWorkoutTitle}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_TITLE_PRESETS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {newWorkoutTitle === "Other" && (
                <Input
                  autoFocus
                  value={newWorkoutCustomTitle}
                  onChange={e => setNewWorkoutCustomTitle(e.target.value)}
                  placeholder="Custom title…"
                  className="flex-1"
                />
              )}
            </div>

            <Button variant="outline" onClick={() => handleBlankWorkout(newWorkoutEffectiveTitle)} className="justify-start"
              disabled={!newWorkoutDate || (newWorkoutTitle === "Other" && !newWorkoutCustomTitle.trim())}>
              Blank {newWorkoutEffectiveTitle || ""} workout
            </Button>

            {suggestedTemplates.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggested for {newWorkoutEffectiveTitle}
                </p>
                {suggestedTemplates.map(t => (
                  <div key={t.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleWorkoutFromTemplate(t)}
                      disabled={!newWorkoutDate}
                      className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                    >
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.exerciseIds.length} exercise{t.exerciseIds.length === 1 ? "" : "s"}</span>
                    </button>
                    <button onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 shrink-0">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {otherTemplates.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {suggestedTemplates.length > 0 ? "Other templates" : "Templates"}
                </p>
                {otherTemplates.map(t => (
                  <div key={t.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleWorkoutFromTemplate(t)}
                      disabled={!newWorkoutDate}
                      className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border hover:bg-muted/40 transition-colors text-left"
                    >
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.exerciseIds.length} exercise{t.exerciseIds.length === 1 ? "" : "s"}</span>
                    </button>
                    <button onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 shrink-0">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── save as template dialog ── */}
      <Dialog open={!!saveTemplateFor} onOpenChange={o => !o && setSaveTemplateFor(null)}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>Reuse this workout's exercises next time.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="E.g. Chest day"
            onKeyDown={e => { if (e.key === "Enter") handleSaveTemplate() }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setSaveTemplateFor(null)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── new run dialog ── */}
      <RunFormDialog
        open={addRunOpen}
        onOpenChange={setAddRunOpen}
        title="Log a run"
        initial={{ date: todayStr(), distanceKm: null, durationSeconds: null }}
        onSubmit={handleAddRun}
      />

      {/* ── delete workout confirm ── */}
      <AlertDialog open={!!deleteWorkoutId} onOpenChange={o => !o && setDeleteWorkoutId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workout and everything logged in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleDeleteWorkout() }} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── weight tracker tab ───────────────────────────────────────────────────────────

function WeightTrackerChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  if (data.length < 2) return null
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const point = payload[0].payload as { date: string; value: number }
              return (
                <div className="bg-popover border rounded-md px-2 py-1 text-xs shadow-md">
                  {point.value} kg — {format(parseISO(point.date), "MMM d, yyyy")}
                </div>
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function WeightLogRow({ log, onUpdate, onDelete }: {
  log: GymBodyWeightLog
  onUpdate: (id: number, data: { date?: string; weightKg?: number }) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [date, setDate] = React.useState(log.date)
  const [weightText, setWeightText] = React.useState(String(log.weightKg))

  React.useEffect(() => {
    setDate(log.date)
    setWeightText(String(log.weightKg))
  }, [log.date, log.weightKg])

  function commit() {
    const trimmed = weightText.trim()
    const weightVal = trimmed === "" ? NaN : Number(trimmed)
    if (Number.isNaN(weightVal)) return
    if (date !== log.date || weightVal !== log.weightKg) {
      onUpdate(log.id, { date, weightKg: weightVal })
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 flex-1" />
        <Input
          type="text" inputMode="decimal"
          value={weightText}
          onChange={e => setWeightText(sanitizeNumericInput(e.target.value, true))}
          className="h-8 w-20"
        />
        <Button size="sm" variant="ghost" onClick={commit}><Check className="h-4 w-4 text-emerald-600" /></Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card group">
      <span className="text-sm font-medium flex-1">{format(parseISO(log.date), "EEE, MMM d, yyyy")}</span>
      <span className="text-sm font-semibold tabular-nums">{log.weightKg} kg</span>
      <button onClick={() => setEditing(true)} title="Edit"
        className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button onClick={() => onDelete(log.id)} title="Delete"
        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}

function WeightTrackerTab() {
  const { data: logs = [], isLoading } = useListGymBodyWeightLogs()
  const queryClient = useQueryClient()
  const createLog = useCreateGymBodyWeightLog()
  const updateLog = useUpdateGymBodyWeightLog()
  const deleteLog = useDeleteGymBodyWeightLog()

  const [date, setDate] = React.useState(todayStr())
  const [weightText, setWeightText] = React.useState("")

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListGymBodyWeightLogsQueryKey() })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = weightText.trim()
    if (trimmed === "") return
    const weightVal = Number(trimmed)
    if (Number.isNaN(weightVal)) return
    createLog.mutate({ data: { date, weightKg: weightVal } }, {
      onSuccess: () => { invalidate(); setWeightText("") },
    })
  }

  function handleUpdate(id: number, data: { date?: string; weightKg?: number }) {
    updateLog.mutate({ id, data }, { onSuccess: invalidate })
  }

  function handleDelete(id: number) {
    deleteLog.mutate({ id }, { onSuccess: invalidate })
  }

  const sortedAsc = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const sortedDesc = [...sortedAsc].reverse()
  const chartData = sortedAsc.map(l => ({ date: l.date, value: l.weightKg }))
  const latest = sortedDesc[0]
  const first = sortedAsc[0]
  const change = latest && first && latest.id !== first.id ? latest.weightKg - first.weightKg : null

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-12">Loading weight logs...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/20">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-auto" />
        <Input
          type="text" inputMode="decimal"
          value={weightText}
          onChange={e => setWeightText(sanitizeNumericInput(e.target.value, true))}
          placeholder="Weight (kg)"
          className="h-9 flex-1"
        />
        <Button type="submit" size="sm" disabled={weightText.trim() === ""} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Log
        </Button>
      </form>

      {logs.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-24 flex flex-col items-center gap-4 text-muted-foreground">
          <LineChartIcon className="h-12 w-12 opacity-20" />
          <div className="text-center">
            <p className="font-semibold text-foreground">No weight logs yet</p>
            <p className="text-sm">Log your weight above to start tracking it over time.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-card border rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-baseline gap-4">
              {latest && (
                <div>
                  <span className="text-3xl font-bold tabular-nums">{latest.weightKg}</span>
                  <span className="text-sm text-muted-foreground ml-1">kg current</span>
                </div>
              )}
              {change != null && first && (
                <span className={cn(
                  "text-sm font-medium tabular-nums",
                  change < 0 ? "text-emerald-600" : change > 0 ? "text-amber-600" : "text-muted-foreground",
                )}>
                  {change > 0 ? "+" : ""}{change.toFixed(1)} kg since {format(parseISO(first.date), "MMM d")}
                </span>
              )}
            </div>
            <WeightTrackerChart data={chartData} color="#6366f1" />
          </div>

          <div className="flex flex-col gap-1.5">
            {sortedDesc.map(log => (
              <WeightLogRow key={log.id} log={log} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── personal records tab ────────────────────────────────────────────────────────

type PersonalRecordMode = "weight" | "volume"

type PersonalRecord = {
  exercise: GymExercise
  weight: number
  reps: number | null
  volume: number | null
  date: string
}

type ProgressPoint = { date: string; value: number }

function ExerciseProgressChart({ data, color, unit }: { data: ProgressPoint[]; color: string; unit: string }) {
  if (data.length < 2) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <LineChartIcon className="h-2.5 w-2.5" />
        <span>Progress over time</span>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const point = payload[0].payload as ProgressPoint
                return (
                  <div className="bg-popover border rounded-md px-2 py-1 text-xs shadow-md">
                    {point.value} {unit} — {format(parseISO(point.date), "MMM d")}
                  </div>
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PersonalRecordCard({ record, history, mode }: { record: PersonalRecord; history: ProgressPoint[]; mode: PersonalRecordMode }) {
  const color = categoryColor(record.exercise.category)
  return (
    <div
      className="bg-card border rounded-2xl shadow-sm p-4 flex flex-col gap-3"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium flex-1 truncate">{record.exercise.name}</span>
        <Trophy className="h-4 w-4 shrink-0" style={{ color }} />
      </div>
      {mode === "weight" ? (
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{record.weight}</span>
          <span className="text-sm text-muted-foreground">kg</span>
          {record.reps != null && (
            <span className="text-sm text-muted-foreground ml-1">x {record.reps} reps</span>
          )}
        </div>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{record.volume}</span>
          <span className="text-sm text-muted-foreground">kg volume</span>
          <span className="text-sm text-muted-foreground ml-1">({record.reps} x {record.weight} kg)</span>
        </div>
      )}
      <span className="text-xs text-muted-foreground">{format(parseISO(record.date), "MMM d, yyyy")}</span>
      <ExerciseProgressChart data={history} color={color} unit={mode === "weight" ? "kg" : "kg volume"} />
    </div>
  )
}

function ExerciseProgressPanel({ exercises, historyByExercise, mode }: {
  exercises: GymExercise[]
  historyByExercise: Map<number, ProgressPoint[]>
  mode: PersonalRecordMode
}) {
  const exercisesWithHistory = React.useMemo(() => (
    exercises
      .filter(ex => (historyByExercise.get(ex.id) ?? []).length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [exercises, historyByExercise])

  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (exercisesWithHistory.length === 0) { setSelectedId(null); return }
    if (selectedId == null || !exercisesWithHistory.some(ex => ex.id === selectedId)) {
      setSelectedId(exercisesWithHistory[0].id)
    }
  }, [exercisesWithHistory, selectedId])

  if (exercisesWithHistory.length === 0) return null

  const selected = exercisesWithHistory.find(ex => ex.id === selectedId) ?? exercisesWithHistory[0]
  const data = historyByExercise.get(selected.id) ?? []
  const color = categoryColor(selected.category)
  const unit = mode === "weight" ? "kg" : "kg volume"

  return (
    <div className="bg-card border rounded-2xl shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-muted-foreground" />
          Exercise Progress
        </h3>
        <Select value={String(selected.id)} onValueChange={v => setSelectedId(Number(v))}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exercisesWithHistory.map(ex => (
              <SelectItem key={ex.id} value={String(ex.id)}>{ex.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {data.length < 2 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          Log this exercise on at least two different days to see a trend.
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), "MMM d")} tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 10 }} width={36} domain={["auto", "auto"]} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const point = payload[0].payload as ProgressPoint
                  return (
                    <div className="bg-popover border rounded-md px-2 py-1 text-xs shadow-md">
                      {point.value} {unit} — {format(parseISO(point.date), "MMM d, yyyy")}
                    </div>
                  )
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function PersonalRecordsTab() {
  const [mode, setMode] = React.useState<PersonalRecordMode>("weight")
  const { data: exercises = [], isLoading: exercisesLoading } = useListGymExercises()
  const { data: entries = [] } = useListGymWorkoutEntries()
  const { data: sets = [] } = useListGymWorkoutSets()
  const { data: workouts = [] } = useListGymWorkouts()

  const { weightRecords, volumeRecords } = React.useMemo(() => {
    const workoutById = new Map(workouts.map(w => [w.id, w]))
    const entryById = new Map(entries.map(e => [e.id, e]))
    const bestWeight = new Map<number, PersonalRecord>()
    const bestVolume = new Map<number, PersonalRecord>()

    for (const set of sets) {
      if (set.weight == null) continue
      const entry = entryById.get(set.entryId)
      if (!entry) continue
      const exercise = exercises.find(ex => ex.id === entry.exerciseId)
      if (!exercise) continue
      const workout = workoutById.get(entry.workoutId)
      const date = workout?.date ?? ""

      const currentWeight = bestWeight.get(exercise.id)
      if (!currentWeight || set.weight > currentWeight.weight) {
        bestWeight.set(exercise.id, { exercise, weight: set.weight, reps: set.reps ?? null, volume: null, date })
      }

      if (set.reps != null) {
        const volume = set.weight * set.reps
        const currentVolume = bestVolume.get(exercise.id)
        if (!currentVolume || volume > (currentVolume.volume ?? 0)) {
          bestVolume.set(exercise.id, { exercise, weight: set.weight, reps: set.reps, volume, date })
        }
      }
    }

    const byName = (a: PersonalRecord, b: PersonalRecord) => a.exercise.name.localeCompare(b.exercise.name)
    return {
      weightRecords: [...bestWeight.values()].sort(byName),
      volumeRecords: [...bestVolume.values()].sort(byName),
    }
  }, [exercises, entries, sets, workouts])

  const records = mode === "weight" ? weightRecords : volumeRecords

  const historyByExercise = React.useMemo(() => {
    const workoutById = new Map(workouts.map(w => [w.id, w]))
    const entryById = new Map(entries.map(e => [e.id, e]))
    const maxByExerciseDate = new Map<string, number>()

    for (const set of sets) {
      if (set.weight == null) continue
      if (mode === "volume" && set.reps == null) continue
      const entry = entryById.get(set.entryId)
      if (!entry) continue
      const workout = workoutById.get(entry.workoutId)
      if (!workout) continue
      const value = mode === "weight" ? set.weight : set.weight * set.reps!
      const key = `${entry.exerciseId}|${workout.date}`
      const current = maxByExerciseDate.get(key)
      if (current === undefined || value > current) maxByExerciseDate.set(key, value)
    }

    const map = new Map<number, ProgressPoint[]>()
    for (const [key, value] of maxByExerciseDate) {
      const [exerciseIdStr, date] = key.split("|")
      const exerciseId = Number(exerciseIdStr)
      if (!map.has(exerciseId)) map.set(exerciseId, [])
      map.get(exerciseId)!.push({ date, value })
    }
    for (const points of map.values()) points.sort((a, b) => a.date.localeCompare(b.date))
    return map
  }, [entries, sets, workouts, mode])

  if (exercisesLoading) {
    return <div className="text-center text-muted-foreground py-12">Loading records...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 self-start rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setMode("weight")}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            mode === "weight" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Best Weight
        </button>
        <button
          onClick={() => setMode("volume")}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            mode === "volume" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Best Volume
        </button>
      </div>

      <ExerciseProgressPanel exercises={exercises} historyByExercise={historyByExercise} mode={mode} />

      {records.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-24 flex flex-col items-center gap-4 text-muted-foreground">
          <Trophy className="h-12 w-12 opacity-20" />
          <div className="text-center">
            <p className="font-semibold text-foreground">No records yet</p>
            <p className="text-sm">
              {mode === "weight"
                ? "Log some weights in a workout to see your personal bests here."
                : "Log reps and weight together in a workout to see your best volume sets here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map(record => (
            <PersonalRecordCard
              key={record.exercise.id}
              record={record}
              history={historyByExercise.get(record.exercise.id) ?? []}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function GymTrack() {
  return (
    <Layout>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gym Track</h1>
          <p className="text-muted-foreground">Track your exercises and log your workouts.</p>
        </div>

        <Tabs defaultValue="log">
          <TabsList className="w-full md:w-auto grid grid-cols-4 md:inline-flex">
            <TabsTrigger value="log"><span className="md:hidden">Log</span><span className="hidden md:inline">Log Workout</span></TabsTrigger>
            <TabsTrigger value="exercises">Exercises</TabsTrigger>
            <TabsTrigger value="records"><span className="md:hidden">Records</span><span className="hidden md:inline">Personal Records</span></TabsTrigger>
            <TabsTrigger value="weight"><span className="md:hidden">Weight</span><span className="hidden md:inline">Weight Tracker</span></TabsTrigger>
          </TabsList>
          <TabsContent value="log">
            <LogWorkoutTab />
          </TabsContent>
          <TabsContent value="exercises">
            <ExercisesTab />
          </TabsContent>
          <TabsContent value="records">
            <PersonalRecordsTab />
          </TabsContent>
          <TabsContent value="weight">
            <WeightTrackerTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
