import * as React from "react"
import { format } from "date-fns"
import { Layout } from "@/components/layout/layout"
import {
  useListTodoLists, useCreateTodoList, useUpdateTodoList, useDeleteTodoList,
  useListTodoTasks, useCreateTodoTask, useUpdateTodoTask, useDeleteTodoTask,
  useCompleteTodoTask, useUncompleteTodoTask,
  getListTodoListsQueryKey, getListTodoTasksQueryKey,
} from "@workspace/api-client-react"
import type { TodoList, TodoTask } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Plus, Trash2, CheckCircle2, Circle, ListChecks, Pencil, Check, X } from "lucide-react"
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

// ── task item ─────────────────────────────────────────────────────────────────

function TaskItem({
  task,
  resetDaily,
  onComplete,
  onUncomplete,
  onDelete,
  onEdit,
}: {
  task: TodoTask
  resetDaily: boolean
  onComplete: (id: number) => void
  onUncomplete: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (task: TodoTask) => void
}) {
  const done = isTaskComplete(task, resetDaily)
  const [editing, setEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState(task.text)
  const editRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  function handleStartEdit() {
    setEditValue(task.text)
    setEditing(true)
  }

  function handleSubmitEdit() {
    if (editValue.trim() && editValue.trim() !== task.text) {
      onEdit({ ...task, text: editValue.trim() })
    }
    setEditing(false)
  }

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl group transition-all border",
      done
        ? "bg-muted/20 border-transparent opacity-60"
        : "bg-card border-border/60 hover:border-border shadow-sm hover:shadow"
    )}>
      <button
        onClick={() => done ? onUncomplete(task.id) : onComplete(task.id)}
        className="shrink-0 transition-transform hover:scale-110"
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done
          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          : <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary/60" />}
      </button>

      {editing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            ref={editRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleSubmitEdit()
              if (e.key === "Escape") setEditing(false)
            }}
            className="h-7 text-sm border-primary/50 focus-visible:ring-1"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSubmitEdit}>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <span
          className={cn(
            "flex-1 text-sm leading-snug select-none",
            done && "line-through text-muted-foreground"
          )}
          onDoubleClick={!done ? handleStartEdit : undefined}
        >
          {task.text}
        </span>
      )}

      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!done && (
            <button
              onClick={handleStartEdit}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Edit"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
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

// ── list tab ──────────────────────────────────────────────────────────────────

function ListTab({
  list, tasks, isActive, onClick,
}: {
  list: TodoList; tasks: TodoTask[]; isActive: boolean; onClick: () => void
}) {
  const pct = completionRate(tasks, list.resetDaily)
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all shrink-0 text-sm font-semibold",
        isActive
          ? "border-transparent text-white shadow-md"
          : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
      )}
      style={isActive ? { backgroundColor: list.color } : {}}
    >
      <span
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
        style={isActive ? { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" } : { backgroundColor: list.color + "22", color: list.color }}
      >
        {list.letter}
      </span>
      <span>{list.name}</span>
      <div className={cn("ml-1", isActive ? "opacity-90" : "opacity-60")}>
        <ProgressRing pct={pct} color={isActive ? "#fff" : list.color} size={22} />
      </div>
      <span className={cn("text-xs tabular-nums ml-0.5 font-normal", isActive ? "text-white/80" : "text-muted-foreground")}>
        {pct}%
      </span>
    </button>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Todos() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: lists = [], isLoading: listsLoading } = useListTodoLists()
  const { data: allTasks = [], isLoading: tasksLoading } = useListTodoTasks()

  const createList = useCreateTodoList()
  const updateList = useUpdateTodoList()
  const deleteList = useDeleteTodoList()
  const createTask = useCreateTodoTask()
  const updateTask = useUpdateTodoTask()
  const deleteTask = useDeleteTodoTask()
  const completeTask = useCompleteTodoTask()
  const uncompleteTask = useUncompleteTodoTask()

  const [activeListId, setActiveListId] = React.useState<number | null>(null)
  const [newTaskText, setNewTaskText] = React.useState("")
  const [addingList, setAddingList] = React.useState(false)
  const [editingList, setEditingList] = React.useState<TodoList | null>(null)
  const [deleteListId, setDeleteListId] = React.useState<number | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Set first list active once loaded
  React.useEffect(() => {
    if (lists.length > 0 && activeListId === null) {
      setActiveListId(lists[0].id)
    }
  }, [lists, activeListId])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListTodoListsQueryKey() })
    queryClient.invalidateQueries({ queryKey: getListTodoTasksQueryKey() })
  }

  const activeList = lists.find(l => l.id === activeListId) ?? null
  const activeTasks = allTasks.filter(t => t.listId === activeListId)
  const tasksByList = React.useMemo(() => {
    const map = new Map<number, TodoTask[]>()
    for (const t of allTasks) {
      if (!map.has(t.listId)) map.set(t.listId, [])
      map.get(t.listId)!.push(t)
    }
    return map
  }, [allTasks])

  // Sort: active tasks first (by creation), then completed at bottom
  const sortedTasks = React.useMemo(() => {
    if (!activeList) return []
    const active = activeTasks.filter(t => !isTaskComplete(t, activeList.resetDaily))
    const done = activeTasks.filter(t => isTaskComplete(t, activeList.resetDaily))
    return [...active, ...done]
  }, [activeTasks, activeList])

  // ── list form ──
  const listForm = useForm<ListFormValues>({
    resolver: zodResolver(listSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0], letter: "A", resetDaily: false },
  })

  function openAddList() {
    listForm.reset({ name: "", color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)], letter: "A", resetDaily: false })
    setEditingList(null)
    setAddingList(true)
  }

  function openEditList(list: TodoList) {
    listForm.reset({ name: list.name, color: list.color, letter: list.letter, resetDaily: list.resetDaily })
    setEditingList(list)
    setAddingList(true)
  }

  // Auto-set letter from name
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
        onSuccess: (data) => {
          invalidate()
          setAddingList(false)
          setActiveListId(data.id)
          toast({ title: "List created" })
        },
      })
    }
  }

  function handleDeleteList() {
    if (!deleteListId) return
    deleteList.mutate({ id: deleteListId }, {
      onSuccess: () => {
        invalidate()
        setDeleteListId(null)
        if (activeListId === deleteListId) setActiveListId(lists.find(l => l.id !== deleteListId)?.id ?? null)
        toast({ title: "List deleted" })
      },
    })
  }

  // ── tasks ──
  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskText.trim() || !activeListId) return
    createTask.mutate({ data: { listId: activeListId, text: newTaskText.trim() } }, {
      onSuccess: () => { invalidate(); setNewTaskText(""); inputRef.current?.focus() },
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

  function handleEditTask(task: TodoTask) {
    updateTask.mutate({ id: task.id, data: { text: task.text } }, {
      onSuccess: () => invalidate(),
    })
  }

  const pct = activeList ? completionRate(activeTasks, activeList.resetDaily) : 0
  const doneCount = activeList ? activeTasks.filter(t => isTaskComplete(t, activeList.resetDaily)).length : 0

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-8 max-w-3xl mx-auto w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">To Do</h1>
          <p className="text-muted-foreground">Organize your tasks across lists.</p>
        </div>

        {/* ── List tabs ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {listsLoading ? (
            <div className="text-sm text-muted-foreground">Loading lists...</div>
          ) : (
            lists.map(list => (
              <div key={list.id} className="relative group/tab">
                <ListTab
                  list={list}
                  tasks={tasksByList.get(list.id) ?? []}
                  isActive={activeListId === list.id}
                  onClick={() => setActiveListId(list.id)}
                />
                {activeListId === list.id && (
                  <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover/tab:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditList(list)}
                      className="w-5 h-5 bg-background border rounded-full flex items-center justify-center shadow-sm hover:bg-muted"
                    >
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setDeleteListId(list.id)}
                      className="w-5 h-5 bg-background border rounded-full flex items-center justify-center shadow-sm hover:bg-destructive/10"
                    >
                      <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          <button
            onClick={openAddList}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New List
          </button>
        </div>

        {/* ── Active list panel ── */}
        {activeList && (
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            {/* header bar */}
            <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderLeftColor: activeList.color, borderLeftWidth: 4 }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ backgroundColor: activeList.color }}>
                {activeList.letter}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{activeList.name}</div>
                <div className="text-xs text-muted-foreground">
                  {doneCount} of {activeTasks.length} complete
                  {activeList.resetDaily && " · resets daily"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ProgressRing pct={pct} color={activeList.color} size={36} />
                <span className="font-mono font-bold text-sm" style={{ color: activeList.color }}>{pct}%</span>
              </div>
            </div>

            {/* add task input */}
            <form onSubmit={handleAddTask} className="flex items-center gap-3 px-5 py-3 border-b bg-muted/20">
              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                ref={inputRef}
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                placeholder="Add a task…"
                className="border-none shadow-none bg-transparent focus-visible:ring-0 px-0 text-sm"
                disabled={createTask.isPending}
              />
              {newTaskText.trim() && (
                <Button type="submit" size="sm" disabled={createTask.isPending} style={{ backgroundColor: activeList.color }} className="text-white h-7 px-3">
                  Add
                </Button>
              )}
            </form>

            {/* tasks */}
            <div className="p-4 space-y-2 min-h-[200px]">
              {tasksLoading ? (
                <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
              ) : sortedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <ListChecks className="h-10 w-10 opacity-20" />
                  <p className="text-sm">No tasks yet. Add one above!</p>
                </div>
              ) : (
                <>
                  {/* active tasks */}
                  {sortedTasks.filter(t => !isTaskComplete(t, activeList.resetDaily)).map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      resetDaily={activeList.resetDaily}
                      onComplete={handleComplete}
                      onUncomplete={handleUncomplete}
                      onDelete={handleDeleteTask}
                      onEdit={handleEditTask}
                    />
                  ))}

                  {/* completed divider */}
                  {sortedTasks.some(t => isTaskComplete(t, activeList.resetDaily)) && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground font-medium">Completed</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  {/* completed tasks */}
                  {sortedTasks.filter(t => isTaskComplete(t, activeList.resetDaily)).map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      resetDaily={activeList.resetDaily}
                      onComplete={handleComplete}
                      onUncomplete={handleUncomplete}
                      onDelete={handleDeleteTask}
                      onEdit={handleEditTask}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {!activeList && !listsLoading && (
          <div className="border border-dashed rounded-2xl py-20 flex flex-col items-center gap-4 text-muted-foreground">
            <ListChecks className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="font-semibold text-foreground">No lists yet</p>
              <p className="text-sm">Create a list to get started.</p>
            </div>
            <Button variant="outline" onClick={openAddList}>Create a list</Button>
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
