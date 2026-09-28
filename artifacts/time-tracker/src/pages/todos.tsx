import * as React from "react"
import { format } from "date-fns"
import { Layout } from "@/components/layout/layout"
import {
  useListTodoLists, useCreateTodoList, useUpdateTodoList, useDeleteTodoList,
  useListTodoTasks, useCreateTodoTask, useUpdateTodoTask, useDeleteTodoTask,
  useCompleteTodoTask, useUncompleteTodoTask, useClearCompletedTodoTasks,
  useListProjects, useListSubprojects,
  getListTodoListsQueryKey, getListTodoTasksQueryKey,
} from "@workspace/api-client-react"
import type { TodoList, TodoTask, Project, Subproject } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Plus, Trash2, CheckCircle2, Circle, ListChecks, Pencil, Check, X, Bell, BellOff, Eraser, GripVertical, PartyPopper } from "lucide-react"
import { ConfettiBurst } from "@/components/confetti-burst"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// ── constants ─────────────────────────────────────────────────────────────────

function getToday() { return format(new Date(), "yyyy-MM-dd") }

const PRESET_COLORS = [
  "#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#0ea5e9", "#22c55e", "#f97316", "#64748b",
]

const listSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1),
  letter: z.string().length(1, "One character only").toUpperCase(),
  resetDaily: z.boolean(),
  autoClearCompleted: z.boolean(),
})
type ListFormValues = z.infer<typeof listSchema>

// ── helpers ───────────────────────────────────────────────────────────────────

function isTaskComplete(task: TodoTask, resetDaily: boolean): boolean {
  if (!task.completedAt) return false
  if (resetDaily) return task.completedDate === getToday()
  return true
}

function completionRate(tasks: TodoTask[], resetDaily: boolean): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter(t => isTaskComplete(t, resetDaily)).length
  return Math.round((done / tasks.length) * 100)
}

// ── progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, color, size = 28 }: { pct: number; color: string; size?: number }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted/30" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

// ── task item ─────────────────────────────────────────────────────────────────

function TaskItem({
  task,
  listId,
  resetDaily,
  projects,
  subprojectsByProject,
  onComplete,
  onUncomplete,
  onDelete,
  onUpdate,
  draggable,
  onDragStart,
  onDragOverRow,
  onDropRow,
  onDragEndTask,
}: {
  task: TodoTask
  listId: number
  resetDaily: boolean
  projects: Project[]
  subprojectsByProject: Map<number, Subproject[]>
  onComplete: (id: number) => void
  onUncomplete: (id: number) => void
  onDelete: (id: number) => void
  onUpdate: (id: number, data: { text?: string; projectId?: number | null; subprojectId?: number | null; reminderTime?: string | null }) => void
  draggable?: boolean
  onDragStart?: (taskId: number, listId: number) => void
  onDragOverRow?: (taskId: number, insertAfter: boolean) => void
  onDropRow?: () => void
  onDragEndTask?: () => void
}) {
  const done = isTaskComplete(task, resetDaily)
  const [editing, setEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState(task.text)
  const [editingReminder, setEditingReminder] = React.useState(false)
  const [reminderValue, setReminderValue] = React.useState(task.reminderTime ?? "")
  const editRef = React.useRef<HTMLInputElement>(null)
  const rowRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  function handleSubmitEdit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== task.text) onUpdate(task.id, { text: trimmed })
    setEditing(false)
  }

  function handleSubmitReminder() {
    const trimmed = reminderValue.trim()
    onUpdate(task.id, { reminderTime: trimmed || null })
    setEditingReminder(false)
  }

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const pid = e.target.value ? Number(e.target.value) : null
    onUpdate(task.id, { projectId: pid, subprojectId: null })
  }

  function handleSubprojectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sid = e.target.value ? Number(e.target.value) : null
    onUpdate(task.id, { subprojectId: sid })
  }

  const assignedProject = task.projectId != null ? projects.find(p => p.id === task.projectId) : null
  const subsForProject = task.projectId != null ? (subprojectsByProject.get(task.projectId) ?? []) : []

  return (
    <div
      ref={rowRef}
      onDragOver={draggable ? (e) => {
        e.preventDefault()
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        const insertAfter = e.clientY > rect.top + rect.height / 2
        onDragOverRow?.(task.id, insertAfter)
      } : undefined}
      onDrop={draggable ? (e) => { e.preventDefault(); e.stopPropagation(); onDropRow?.() } : undefined}
      className={cn(
        "flex flex-col gap-1 px-3 py-2.5 rounded-xl group transition-all border",
        done
          ? "bg-muted/20 border-transparent opacity-60"
          : "bg-card border-border/60 hover:border-border shadow-sm hover:shadow",
      )}
    >
      {/* main row */}
      <div className="flex items-center gap-2.5">
        {draggable && (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              const rowEl = rowRef.current
              if (rowEl) {
                const rect = rowEl.getBoundingClientRect()
                // Use the whole row (not just this handle) as the native drag
                // image, so the ghost that follows the cursor looks like the
                // full task item being picked up — snapshotted synchronously
                // here, before onDragStart below swaps the origin slot for a
                // placeholder.
                e.dataTransfer.setDragImage(rowEl, e.clientX - rect.left, e.clientY - rect.top)
              }
              onDragStart?.(task.id, listId)
            }}
            onDragEnd={onDragEndTask}
            title="Drag to reorder or move to another list"
            className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity -ml-1"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
          </span>
        )}
        <button
          onClick={() => done ? onUncomplete(task.id) : onComplete(task.id)}
          className="shrink-0 transition-transform hover:scale-110"
        >
          {done
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            : <Circle className="h-4 w-4 text-muted-foreground/40 hover:text-primary/60" />}
        </button>

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
              className="h-6 text-xs border-primary/50 focus-visible:ring-1 px-1.5"
            />
            <button className="shrink-0" onClick={handleSubmitEdit}>
              <Check className="h-3 w-3 text-emerald-600" />
            </button>
            <button className="shrink-0" onClick={() => setEditing(false)}>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <span
            className={cn("flex-1 text-sm leading-snug select-none min-w-0 truncate", done && "line-through text-muted-foreground")}
            onDoubleClick={!done ? () => { setEditValue(task.text); setEditing(true) } : undefined}
          >
            {task.text}
          </span>
        )}

        {!editing && task.reminderTime && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0" title="Reminder time">
            <Bell className="h-2.5 w-2.5" />
            {task.reminderTime}
          </span>
        )}

        {!editing && !done && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => { setReminderValue(task.reminderTime ?? ""); setEditingReminder(v => !v) }}
              className="p-1 rounded hover:bg-muted transition-colors" title="Set reminder">
              {task.reminderTime
                ? <Bell className="h-2.5 w-2.5 text-amber-500" />
                : <BellOff className="h-2.5 w-2.5 text-muted-foreground" />}
            </button>
            <button onClick={() => { setEditValue(task.text); setEditing(true) }}
              className="p-1 rounded hover:bg-muted transition-colors">
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
            <button onClick={() => onDelete(task.id)}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
              <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </div>
        )}
        {!editing && done && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onDelete(task.id)}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
              <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {editingReminder && (
        <div className="flex items-center gap-1.5 ml-6">
          <Bell className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          <input
            type="time"
            value={reminderValue}
            onChange={e => setReminderValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmitReminder(); if (e.key === "Escape") setEditingReminder(false) }}
            className="text-xs bg-transparent border-none focus:outline-none"
          />
          <button onClick={handleSubmitReminder} className="shrink-0">
            <Check className="h-3 w-3 text-emerald-600" />
          </button>
          <button onClick={() => setEditingReminder(false)} className="shrink-0">
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* project / subproject assignment row */}
      {!editing && !done && projects.length > 0 && (
        <div className="flex items-center gap-1.5 ml-6 min-w-0">
          {assignedProject ? (
            <>
              <span className="h-2 w-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: assignedProject.color }} />
              <select
                value={task.projectId ?? ""}
                onChange={handleProjectChange}
                onClick={e => e.stopPropagation()}
                className="text-xs bg-transparent border-none focus:outline-none cursor-pointer font-medium leading-none p-0 min-w-0 max-w-[180px] truncate"
                style={{ color: assignedProject.color }}
              >
                <option value="">— remove</option>
                {projects.filter(p => p.status === "active").map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {subsForProject.length > 0 && (
                <>
                  <span className="text-muted-foreground/40 text-xs shrink-0">·</span>
                  <select
                    value={task.subprojectId ?? ""}
                    onChange={handleSubprojectChange}
                    onClick={e => e.stopPropagation()}
                    className="text-xs bg-transparent border-none focus:outline-none cursor-pointer text-muted-foreground leading-none p-0 min-w-0 max-w-[160px] truncate"
                  >
                    <option value="">no subproject</option>
                    {subsForProject.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          ) : (
            <select
              value=""
              onChange={handleProjectChange}
              onClick={e => e.stopPropagation()}
              className="text-xs text-muted-foreground/30 bg-transparent border-none focus:outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity leading-none p-0"
            >
              <option value="">+ assign project</option>
              {projects.filter(p => p.status === "active").map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

// ── vertical resize ───────────────────────────────────────────────────────────

const LIST_HEIGHT_MIN = 120
const LIST_HEIGHT_MAX = 900

// Lists auto-fit their height to content (grows/shrinks as tasks are added,
// completed, or cleared) until the user manually drags the resize handle —
// at that point we switch to a fixed, scrollable height and remember it.
function useResizableHeight(storageKey: string) {
  const [manualHeight, setManualHeight] = React.useState<number | null>(() => {
    if (typeof window === "undefined") return null
    const saved = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(saved) && saved > 0 ? saved : null
  })
  const heightRef = React.useRef(manualHeight)
  heightRef.current = manualHeight

  const handleMouseDown = React.useCallback((e: React.MouseEvent, currentHeight: number) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = heightRef.current ?? currentHeight

    function onMouseMove(ev: MouseEvent) {
      const next = Math.min(LIST_HEIGHT_MAX, Math.max(LIST_HEIGHT_MIN, startHeight + (ev.clientY - startY)))
      setManualHeight(next)
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      if (heightRef.current != null) window.localStorage.setItem(storageKey, String(heightRef.current))
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }, [storageKey])

  return { manualHeight, handleMouseDown }
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize"
      className="h-2 shrink-0 cursor-row-resize flex items-center justify-center group/resize"
    >
      <div className="w-10 h-1 rounded-full bg-border group-hover/resize:bg-primary/50 transition-colors" />
    </div>
  )
}

// ── list card ─────────────────────────────────────────────────────────────────

function ListCard({
  list,
  tasks,
  projects,
  subprojectsByProject,
  suggestions,
  onAddTask,
  onComplete,
  onUncomplete,
  onDelete,
  onUpdate,
  onEditList,
  onDeleteList,
  onClearCompleted,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOverCard,
  onDropCard,
  onDragEndCard,
  draggedTaskId,
  draggedTaskData,
  previewListId,
  previewOrderIds,
  onTaskDragStart,
  onTaskDragOverRow,
  onTaskDrop,
  onTaskDragEnd,
}: {
  list: TodoList
  tasks: TodoTask[]
  projects: Project[]
  subprojectsByProject: Map<number, Subproject[]>
  suggestions: string[]
  onAddTask: (listId: number, text: string) => void
  onComplete: (id: number) => void
  onUncomplete: (id: number) => void
  onDelete: (id: number) => void
  onUpdate: (id: number, data: { text?: string; projectId?: number | null; subprojectId?: number | null; reminderTime?: string | null }) => void
  onEditList: (list: TodoList) => void
  onDeleteList: (id: number) => void
  onClearCompleted: (listId: number) => void
  isDragging: boolean
  isDragOver: boolean
  onDragStart: () => void
  onDragOverCard: (e: React.DragEvent) => void
  onDropCard: () => void
  onDragEndCard: () => void
  draggedTaskId: number | null
  draggedTaskData: TodoTask | null
  previewListId: number | null
  previewOrderIds: number[] | null
  onTaskDragStart: (taskId: number, listId: number) => void
  onTaskDragOverRow: (taskId: number | null, insertAfter: boolean) => void
  onTaskDrop: () => void
  onTaskDragEnd: () => void
}) {
  const [newText, setNewText] = React.useState("")
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [highlightIndex, setHighlightIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const { manualHeight, handleMouseDown } = useResizableHeight(`todo-list-height-${list.id}`)
  const pct = completionRate(tasks, list.resetDaily)
  const doneTasks = tasks.filter(t => isTaskComplete(t, list.resetDaily))
  const activeTasks = tasks.filter(t => !isTaskComplete(t, list.resetDaily))
  const complete = tasks.length > 0 && pct === 100

  // Live drag preview: while this list is the current drop target, render
  // tasks in the hovered order (with the dragged task's slot as a gap) —
  // like rearranging iOS home screen icons. If the dragged task started
  // here but the pointer has moved to a different list, drop it from view
  // entirely so it doesn't appear to be in two places at once.
  const isPreviewTarget = previewListId === list.id
  const draggedFromHere = draggedTaskId != null && draggedTaskData?.listId === list.id
  const displayActiveTasks = React.useMemo(() => {
    if (isPreviewTarget && previewOrderIds) {
      const byId = new Map(activeTasks.map(t => [t.id, t]))
      if (draggedTaskData && !byId.has(draggedTaskData.id)) byId.set(draggedTaskData.id, draggedTaskData)
      return previewOrderIds.map(id => byId.get(id)).filter((t): t is TodoTask => !!t)
    }
    if (draggedFromHere) {
      return activeTasks.filter(t => t.id !== draggedTaskId)
    }
    return activeTasks
  }, [isPreviewTarget, previewOrderIds, activeTasks, draggedTaskData, draggedFromHere, draggedTaskId])

  const [celebrate, setCelebrate] = React.useState(false)
  const prevCompleteRef = React.useRef(complete)
  React.useEffect(() => {
    if (complete && !prevCompleteRef.current) setCelebrate(true)
    prevCompleteRef.current = complete
  }, [complete])

  const filteredSuggestions = React.useMemo(() => {
    const q = newText.trim().toLowerCase()
    if (!q) return []
    return suggestions
      .filter(s => s.toLowerCase() !== q && s.toLowerCase().includes(q))
      .slice(0, 6)
  }, [newText, suggestions])

  function submitText(text: string) {
    if (!text.trim()) return
    onAddTask(list.id, text.trim())
    setNewText("")
    setShowSuggestions(false)
    setHighlightIndex(-1)
    inputRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (highlightIndex >= 0 && filteredSuggestions[highlightIndex]) {
      submitText(filteredSuggestions[highlightIndex])
    } else {
      submitText(newText)
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || filteredSuggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % filteredSuggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(i => (i <= 0 ? filteredSuggestions.length - 1 : i - 1))
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div className={cn(
      "bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all",
      isDragging && "opacity-40",
      isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
    )}>
      {/* header — drag handle for reordering */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOverCard}
        onDrop={onDropCard}
        onDragEnd={onDragEndCard}
        className={cn(
          "relative px-4 py-3 border-b flex items-center gap-2.5 group/hdr cursor-grab active:cursor-grabbing transition-colors",
          complete && "bg-amber-400/10",
        )}
        style={{ borderLeftColor: list.color, borderLeftWidth: 4 }}
      >
        {celebrate && <ConfettiBurst onDone={() => setCelebrate(false)} />}
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover/hdr:opacity-100 transition-opacity shrink-0 -ml-1" />
        <div className={cn(
          "relative w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 transition-all",
          complete && "ring-2 ring-amber-400 ring-offset-1 ring-offset-card",
        )} style={{ backgroundColor: list.color }}>
          {complete
            ? <PartyPopper className="h-3.5 w-3.5" />
            : list.letter}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate leading-tight">{list.name}</div>
          <div className="text-xs text-muted-foreground leading-tight">
            {doneTasks.length}/{tasks.length}
            {list.resetDaily && " · daily"}
            {list.autoClearCompleted && " · auto-clear"}
          </div>
        </div>
        <ProgressRing pct={pct} color={complete ? "#f59e0b" : list.color} size={28} />
        <span className="font-mono text-xs font-bold w-8 text-right shrink-0" style={{ color: complete ? "#f59e0b" : list.color }}>{pct}%</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/hdr:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEditList(list)}
            className="p-1 rounded hover:bg-muted transition-colors" title="Edit list">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={() => onDeleteList(list.id)}
            className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete list">
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* add task */}
      <div className="relative border-b bg-muted/20">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={newText}
            onChange={e => { setNewText(e.target.value); setShowSuggestions(true); setHighlightIndex(-1) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            onKeyDown={handleInputKeyDown}
            placeholder="Add a task…"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/40 min-w-0"
          />
          {newText.trim() && (
            <button type="submit"
              className="text-xs font-bold px-2 py-0.5 rounded-md text-white shrink-0"
              style={{ backgroundColor: list.color }}>
              Add
            </button>
          )}
        </form>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mx-2 mb-1 rounded-lg border bg-popover shadow-lg overflow-hidden">
            {filteredSuggestions.map((s, idx) => (
              <button
                key={s}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => submitText(s)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm truncate transition-colors",
                  idx === highlightIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* task list — auto-fits to content until manually resized */}
      <div
        ref={contentRef}
        onDragOver={e => { e.preventDefault(); onTaskDragOverRow(null, true) }}
        onDrop={e => { e.preventDefault(); onTaskDrop() }}
        className={cn("p-3 space-y-1.5", manualHeight != null && "overflow-y-auto")}
        style={manualHeight != null ? { height: manualHeight } : undefined}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/30 gap-2">
            <ListChecks className="h-7 w-7" />
            <p className="text-xs">No tasks yet</p>
          </div>
        ) : (
          <>
            {displayActiveTasks.map(task => (
              task.id === draggedTaskId ? (
                <div key={task.id} className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-3 py-2.5">
                  <div className="h-4" />
                </div>
              ) : (
                <TaskItem key={task.id} task={task} listId={list.id} resetDaily={list.resetDaily}
                  projects={projects} subprojectsByProject={subprojectsByProject}
                  onComplete={onComplete} onUncomplete={onUncomplete}
                  onDelete={onDelete} onUpdate={onUpdate}
                  draggable
                  onDragStart={onTaskDragStart}
                  onDragOverRow={onTaskDragOverRow}
                  onDropRow={onTaskDrop}
                  onDragEndTask={onTaskDragEnd}
                />
              )
            ))}
            {doneTasks.length > 0 && (
              <>
                <div className="flex items-center gap-2 py-1 group/done">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">Done</span>
                  <button
                    onClick={() => onClearCompleted(list.id)}
                    title="Clear completed tasks"
                    className="p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/done:opacity-100"
                  >
                    <Eraser className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {doneTasks.map(task => (
                  <TaskItem key={task.id} task={task} listId={list.id} resetDaily={list.resetDaily}
                    projects={projects} subprojectsByProject={subprojectsByProject}
                    onComplete={onComplete} onUncomplete={onUncomplete}
                    onDelete={onDelete} onUpdate={onUpdate} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <ResizeHandle onMouseDown={e => handleMouseDown(e, contentRef.current?.offsetHeight ?? LIST_HEIGHT_MIN)} />
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Todos() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: lists = [], isLoading: listsLoading } = useListTodoLists()
  const { data: allTasks = [] } = useListTodoTasks()
  const { data: projects = [] } = useListProjects()
  const { data: allSubprojects = [] } = useListSubprojects()

  const createList = useCreateTodoList()
  const updateList = useUpdateTodoList()
  const deleteList = useDeleteTodoList()
  const createTask = useCreateTodoTask()
  const updateTask = useUpdateTodoTask()
  const deleteTask = useDeleteTodoTask()
  const completeTask = useCompleteTodoTask()
  const uncompleteTask = useUncompleteTodoTask()
  const clearCompleted = useClearCompletedTodoTasks()

  const [addingList, setAddingList] = React.useState(false)
  const [editingList, setEditingList] = React.useState<TodoList | null>(null)
  const [dragListId, setDragListId] = React.useState<number | null>(null)
  const [dragOverListId, setDragOverListId] = React.useState<number | null>(null)
  const [deleteListId, setDeleteListId] = React.useState<number | null>(null)
  const [draggedTask, setDraggedTask] = React.useState<{ id: number; listId: number } | null>(null)
  const [previewListId, setPreviewListId] = React.useState<number | null>(null)
  const [previewOrderIds, setPreviewOrderIds] = React.useState<number[] | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListTodoListsQueryKey() })
    queryClient.invalidateQueries({ queryKey: getListTodoTasksQueryKey() })
  }

  const tasksByList = React.useMemo(() => {
    const map = new Map<number, TodoTask[]>()
    for (const t of allTasks) {
      if (!map.has(t.listId)) map.set(t.listId, [])
      map.get(t.listId)!.push(t)
    }
    return map
  }, [allTasks])

  const listsById = React.useMemo(() => new Map(lists.map(l => [l.id, l])), [lists])

  // Most-recently-used distinct task text, across all lists, for the
  // "add a task" autocomplete dropdown.
  const taskTextHistory = React.useMemo(() => {
    const mostRecentTs = new Map<string, number>()
    const original = new Map<string, string>()
    for (const t of allTasks) {
      const trimmed = t.text.trim()
      const key = trimmed.toLowerCase()
      if (!key) continue
      const ts = new Date(t.createdAt).getTime()
      if (!mostRecentTs.has(key) || ts > mostRecentTs.get(key)!) {
        mostRecentTs.set(key, ts)
        original.set(key, trimmed)
      }
    }
    return Array.from(original.entries())
      .sort((a, b) => mostRecentTs.get(b[0])! - mostRecentTs.get(a[0])!)
      .map(([, text]) => text)
  }, [allTasks])

  const subprojectsByProject = React.useMemo(() => {
    const map = new Map<number, Subproject[]>()
    for (const s of allSubprojects) {
      if (!map.has(s.projectId)) map.set(s.projectId, [])
      map.get(s.projectId)!.push(s)
    }
    return map
  }, [allSubprojects])

  // ── list form ──
  const listForm = useForm<ListFormValues>({
    resolver: zodResolver(listSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0], letter: "A", resetDaily: false, autoClearCompleted: false },
  })

  function openAddList() {
    listForm.reset({ name: "", color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)], letter: "A", resetDaily: false, autoClearCompleted: false })
    setEditingList(null)
    setAddingList(true)
  }

  function openEditList(list: TodoList) {
    listForm.reset({ name: list.name, color: list.color, letter: list.letter, resetDaily: list.resetDaily, autoClearCompleted: list.autoClearCompleted })
    setEditingList(list)
    setAddingList(true)
  }

  const watchedName = listForm.watch("name")
  React.useEffect(() => {
    if (watchedName && !editingList) {
      listForm.setValue("letter", watchedName[0].toUpperCase(), { shouldValidate: false })
    }
  }, [watchedName, editingList, listForm])

  function onSubmitList(values: ListFormValues) {
    if (editingList) {
      updateList.mutate({ id: editingList.id, data: values }, {
        onSuccess: () => { invalidate(); setAddingList(false); toast({ title: "List updated" }) },
      })
    } else {
      createList.mutate({ data: { ...values, sortOrder: lists.length } }, {
        onSuccess: () => { invalidate(); setAddingList(false); toast({ title: "List created" }) },
      })
    }
  }

  function handleDeleteList() {
    if (!deleteListId) return
    deleteList.mutate({ id: deleteListId }, {
      onSuccess: () => { invalidate(); setDeleteListId(null); toast({ title: "List deleted" }) },
    })
  }

  // ── task handlers ──
  function handleAddTask(listId: number, text: string) {
    createTask.mutate({ data: { listId, text } }, {
      onSuccess: () => invalidate(),
    })
  }

  function handleComplete(id: number) {
    completeTask.mutate({ id }, { onSuccess: () => invalidate() })
  }

  function handleUncomplete(id: number) {
    uncompleteTask.mutate({ id }, { onSuccess: () => invalidate() })
  }

  function handleDeleteTask(id: number) {
    deleteTask.mutate({ id }, { onSuccess: () => invalidate() })
  }

  function handleUpdateTask(id: number, data: { text?: string; projectId?: number | null; subprojectId?: number | null; reminderTime?: string | null }) {
    updateTask.mutate({ id, data }, { onSuccess: () => invalidate() })
  }

  function handleClearCompleted(listId: number) {
    clearCompleted.mutate({ id: listId }, {
      onSuccess: (result) => { invalidate(); toast({ title: `Cleared ${result.clearedCount} task${result.clearedCount === 1 ? "" : "s"}` }) },
    })
  }

  function handleDragOverList(e: React.DragEvent, id: number) {
    e.preventDefault()
    if (dragOverListId !== id) setDragOverListId(id)
  }

  function handleDropOnList(targetId: number) {
    const draggedId = dragListId
    setDragListId(null)
    setDragOverListId(null)
    if (draggedId == null || draggedId === targetId) return

    const reordered = [...lists]
    const fromIndex = reordered.findIndex(l => l.id === draggedId)
    const toIndex = reordered.findIndex(l => l.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    reordered.forEach((l, idx) => {
      if (l.sortOrder !== idx) {
        updateList.mutate({ id: l.id, data: { sortOrder: idx } }, { onSuccess: () => invalidate() })
      }
    })
  }

  // ── task drag-and-drop: reorder within a list, or move to another list ──
  // Live-previews the drop position as the pointer moves (like rearranging
  // iOS home screen icons) rather than only reacting on drop, so the user
  // can see exactly where an item will land while still dragging it.
  function activeTasksFor(listId: number): TodoTask[] {
    const list = listsById.get(listId)
    if (!list) return []
    return (tasksByList.get(listId) ?? []).filter(t => !isTaskComplete(t, list.resetDaily))
  }

  function handleTaskDragStart(taskId: number, listId: number) {
    setDraggedTask({ id: taskId, listId })
    setPreviewListId(listId)
    setPreviewOrderIds(activeTasksFor(listId).map(t => t.id))
  }

  function handleTaskDragOverRow(listId: number, overTaskId: number | null, insertAfter: boolean) {
    const dragged = draggedTask
    if (!dragged) return

    const baseline = (previewListId === listId && previewOrderIds)
      ? previewOrderIds.filter(id => id !== dragged.id)
      : activeTasksFor(listId).map(t => t.id).filter(id => id !== dragged.id)

    let insertAt = baseline.length
    if (overTaskId != null) {
      const idx = baseline.indexOf(overTaskId)
      insertAt = idx === -1 ? baseline.length : (insertAfter ? idx + 1 : idx)
    }
    const next = [...baseline]
    next.splice(insertAt, 0, dragged.id)

    setPreviewListId(listId)
    setPreviewOrderIds(next)
  }

  function commitTaskDrop() {
    const dragged = draggedTask
    const targetListId = previewListId
    const order = previewOrderIds
    if (!dragged || targetListId == null || !order) return

    const listChanged = dragged.listId !== targetListId
    if (listChanged) {
      const sourceArr = activeTasksFor(dragged.listId).filter(t => t.id !== dragged.id)
      sourceArr.forEach((t, idx) => {
        if (t.sortOrder !== idx) {
          updateTask.mutate({ id: t.id, data: { sortOrder: idx } }, { onSuccess: () => invalidate() })
        }
      })
    }

    const draggedTaskObj = tasksByList.get(dragged.listId)?.find(t => t.id === dragged.id)
    order.forEach((id, idx) => {
      if (id === dragged.id) {
        if (listChanged || draggedTaskObj?.sortOrder !== idx) {
          updateTask.mutate(
            { id, data: listChanged ? { listId: targetListId, sortOrder: idx } : { sortOrder: idx } },
            { onSuccess: () => invalidate() },
          )
        }
      } else {
        const t = (tasksByList.get(targetListId) ?? []).find(x => x.id === id)
        if (t && t.sortOrder !== idx) {
          updateTask.mutate({ id, data: { sortOrder: idx } }, { onSuccess: () => invalidate() })
        }
      }
    })
  }

  function handleTaskDrop() {
    commitTaskDrop()
    setDraggedTask(null)
    setPreviewListId(null)
    setPreviewOrderIds(null)
  }

  function handleTaskDragEnd() {
    setDraggedTask(null)
    setPreviewListId(null)
    setPreviewOrderIds(null)
  }

  const draggedTaskData = draggedTask
    ? (tasksByList.get(draggedTask.listId)?.find(t => t.id === draggedTask.id) ?? null)
    : null

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6 md:p-8 w-full max-w-[1600px] mx-auto">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">To Do</h1>
            <p className="text-muted-foreground">All your lists at a glance.</p>
          </div>
          <Button onClick={openAddList} className="gap-2">
            <Plus className="h-4 w-4" />
            New List
          </Button>
        </div>

        {/* grid of list cards */}
        {listsLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading lists...</div>
        ) : lists.length === 0 ? (
          <div className="border border-dashed rounded-2xl py-24 flex flex-col items-center gap-4 text-muted-foreground">
            <ListChecks className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="font-semibold text-foreground">No lists yet</p>
              <p className="text-sm">Create a list to get started.</p>
            </div>
            <Button variant="outline" onClick={openAddList}>Create a list</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {lists.map(list => (
              <ListCard
                key={list.id}
                list={list}
                tasks={tasksByList.get(list.id) ?? []}
                projects={projects}
                subprojectsByProject={subprojectsByProject}
                suggestions={taskTextHistory}
                onAddTask={handleAddTask}
                onComplete={handleComplete}
                onUncomplete={handleUncomplete}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                onEditList={openEditList}
                onDeleteList={setDeleteListId}
                onClearCompleted={handleClearCompleted}
                isDragging={dragListId === list.id}
                isDragOver={dragOverListId === list.id && dragListId !== list.id}
                onDragStart={() => setDragListId(list.id)}
                onDragOverCard={e => handleDragOverList(e, list.id)}
                onDropCard={() => handleDropOnList(list.id)}
                onDragEndCard={() => { setDragListId(null); setDragOverListId(null) }}
                draggedTaskId={draggedTask?.id ?? null}
                draggedTaskData={draggedTaskData}
                previewListId={previewListId}
                previewOrderIds={previewOrderIds}
                onTaskDragStart={handleTaskDragStart}
                onTaskDragOverRow={(taskId, insertAfter) => handleTaskDragOverRow(list.id, taskId, insertAfter)}
                onTaskDrop={handleTaskDrop}
                onTaskDragEnd={handleTaskDragEnd}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── List dialog ── */}
      <Dialog open={addingList} onOpenChange={setAddingList}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{editingList ? "Edit List" : "New List"}</DialogTitle>
            <DialogDescription>
              {editingList ? "Update the list name and appearance." : "Add a new task list."}
            </DialogDescription>
          </DialogHeader>
          <Form {...listForm}>
            <form onSubmit={listForm.handleSubmit(onSubmitList)} className="space-y-4 pt-2">
              <FormField control={listForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input autoFocus placeholder="E.g. Shopping, Study" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={listForm.control} name="letter" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Letter</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={1}
                        className="text-center text-2xl font-bold uppercase h-12 tracking-widest"
                        onChange={e => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={listForm.control} name="color" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button"
                            className={cn("w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                              field.value === c ? "border-foreground scale-110 shadow" : "border-transparent")}
                            style={{ backgroundColor: c }}
                            onClick={() => listForm.setValue("color", c, { shouldValidate: true })}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={listForm.control} name="resetDaily" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => field.onChange(!field.value)}>
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                      field.value ? "border-primary bg-primary" : "border-border"
                    )}>
                      {field.value && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Reset daily</p>
                      <p className="text-xs text-muted-foreground">Tasks revert to incomplete each day</p>
                    </div>
                  </div>
                </FormItem>
              )} />

              <FormField control={listForm.control} name="autoClearCompleted" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => field.onChange(!field.value)}>
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                      field.value ? "border-primary bg-primary" : "border-border"
                    )}>
                      {field.value && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Auto-clear completed tasks</p>
                      <p className="text-xs text-muted-foreground">Hide completed tasks once the day ends</p>
                    </div>
                  </div>
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setAddingList(false)}>Cancel</Button>
                <Button type="submit" disabled={createList.isPending || updateList.isPending}>
                  {editingList ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete list confirm ── */}
      <AlertDialog open={!!deleteListId} onOpenChange={o => !o && setDeleteListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the list and all its tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); handleDeleteList() }}
              className="bg-destructive text-destructive-foreground"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}
