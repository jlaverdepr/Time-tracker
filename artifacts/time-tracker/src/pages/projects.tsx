import * as React from "react"
import { Layout } from "@/components/layout/layout"
import {
  useListProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useCompleteProject, useReopenProject, getListProjectsQueryKey,
  useListSubprojects, useCreateSubproject, useUpdateSubproject,
  useDeleteSubproject, useCompleteSubproject, useReopenSubproject,
  getListSubprojectsQueryKey,
} from "@workspace/api-client-react"
import type { Subproject } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Trash2, Edit2, Plus, FolderGit2, CheckCircle2, RotateCcw,
  ChevronDown, ChevronRight, GitBranch, Circle,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"

// ── schemas ──────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1).regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
})
type ProjectFormValues = z.infer<typeof projectSchema>

const subprojectSchema = z.object({
  name: z.string().min(1, "Name is required"),
})
type SubprojectFormValues = z.infer<typeof subprojectSchema>

const PRESET_COLORS = [
  "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#d946ef", "#ec4899", "#f43f5e", "#eab308", "#f97316",
  "#f59e0b", "#84cc16", "#22c55e", "#10b981", "#64748b",
  "#71717a", "#78716c",
]

// ── subproject row ─────────────────────────────────────────────────────────

function SubprojectRow({
  sub,
  projectColor,
  onEdit,
  onDelete,
  onComplete,
  onReopen,
}: {
  sub: Subproject
  projectColor: string
  onEdit: (sub: Subproject) => void
  onDelete: (id: number) => void
  onComplete: (id: number) => void
  onReopen: (id: number) => void
}) {
  const color = sub.color ?? projectColor
  const done = sub.status === "completed"

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-lg group transition-colors",
      done ? "opacity-60" : "hover:bg-muted/40"
    )}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>
          {sub.name}
        </span>
        {done && sub.completedAt && (
          <span className="ml-2 text-xs text-muted-foreground">
            ✓ {format(parseISO(sub.completedAt), "MMM d")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!done ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              title="Mark complete" onClick={() => onComplete(sub.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => onEdit(sub)}>
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reopen" onClick={() => onReopen(sub.id)}>
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
          title="Delete" onClick={() => onDelete(sub.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── main page ────────────────────────────────────────────────────────────────

export default function Projects() {
  const { data: projects, isLoading } = useListProjects()
  const { data: allSubprojects } = useListSubprojects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const completeProject = useCompleteProject()
  const reopenProject = useReopenProject()
  const createSubproject = useCreateSubproject()
  const updateSubproject = useUpdateSubproject()
  const deleteSubproject = useDeleteSubproject()
  const completeSubproject = useCompleteSubproject()
  const reopenSubproject = useReopenSubproject()

  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── project dialog ──
  const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false)
  const [editingProjectId, setEditingProjectId] = React.useState<number | null>(null)
  const [deleteProjectId, setDeleteProjectId] = React.useState<number | null>(null)

  // ── subproject dialog ──
  const [isSubprojectDialogOpen, setIsSubprojectDialogOpen] = React.useState(false)
  const [subprojectParentId, setSubprojectParentId] = React.useState<number | null>(null)
  const [editingSubprojectId, setEditingSubprojectId] = React.useState<number | null>(null)
  const [deleteSubprojectId, setDeleteSubprojectId] = React.useState<number | null>(null)

  // ── expanded cards ──
  const [expandedProjects, setExpandedProjects] = React.useState<Set<number>>(new Set())

  const projectForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0] },
  })

  const subprojectForm = useForm<SubprojectFormValues>({
    resolver: zodResolver(subprojectSchema),
    defaultValues: { name: "" },
  })

  // group subprojects by projectId
  const subprojectsByProject = React.useMemo(() => {
    const map = new Map<number, Subproject[]>()
    for (const sub of allSubprojects ?? []) {
      if (!map.has(sub.projectId)) map.set(sub.projectId, [])
      map.get(sub.projectId)!.push(sub)
    }
    return map
  }, [allSubprojects])

  function toggleExpand(id: number) {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
    queryClient.invalidateQueries({ queryKey: getListSubprojectsQueryKey() })
  }

  // ── project CRUD ──
  const openCreateProject = () => {
    setEditingProjectId(null)
    projectForm.reset({ name: "", color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] })
    setIsProjectDialogOpen(true)
  }

  const openEditProject = (p: { id: number; name: string; color: string }) => {
    setEditingProjectId(p.id)
    projectForm.reset({ name: p.name, color: p.color })
    setIsProjectDialogOpen(true)
  }

  const onSubmitProject = (values: ProjectFormValues) => {
    if (editingProjectId) {
      updateProject.mutate({ id: editingProjectId, data: values }, {
        onSuccess: () => { toast({ title: "Project updated" }); invalidateAll(); setIsProjectDialogOpen(false) },
      })
    } else {
      createProject.mutate({ data: values }, {
        onSuccess: () => { toast({ title: "Project created" }); invalidateAll(); setIsProjectDialogOpen(false) },
      })
    }
  }

  const handleDeleteProject = () => {
    if (!deleteProjectId) return
    deleteProject.mutate({ id: deleteProjectId }, {
      onSuccess: () => { toast({ title: "Project deleted" }); invalidateAll(); setDeleteProjectId(null) },
    })
  }

  const handleCompleteProject = (id: number) => {
    completeProject.mutate({ id }, {
      onSuccess: () => { toast({ title: "Project completed" }); invalidateAll() },
    })
  }

  const handleReopenProject = (id: number) => {
    reopenProject.mutate({ id }, {
      onSuccess: () => { toast({ title: "Project reopened" }); invalidateAll() },
    })
  }

  // ── subproject CRUD ──
  const openAddSubproject = (projectId: number) => {
    setSubprojectParentId(projectId)
    setEditingSubprojectId(null)
    subprojectForm.reset({ name: "" })
    setIsSubprojectDialogOpen(true)
    setExpandedProjects(prev => new Set([...prev, projectId]))
  }

  const openEditSubproject = (sub: Subproject) => {
    setSubprojectParentId(sub.projectId)
    setEditingSubprojectId(sub.id)
    subprojectForm.reset({ name: sub.name })
    setIsSubprojectDialogOpen(true)
  }

  const onSubmitSubproject = (values: SubprojectFormValues) => {
    if (editingSubprojectId) {
      updateSubproject.mutate({ id: editingSubprojectId, data: values }, {
        onSuccess: () => { toast({ title: "Subproject updated" }); invalidateAll(); setIsSubprojectDialogOpen(false) },
      })
    } else if (subprojectParentId) {
      createSubproject.mutate({ data: { projectId: subprojectParentId, name: values.name } }, {
        onSuccess: () => { toast({ title: "Subproject added" }); invalidateAll(); setIsSubprojectDialogOpen(false) },
      })
    }
  }

  const handleDeleteSubproject = () => {
    if (!deleteSubprojectId) return
    deleteSubproject.mutate({ id: deleteSubprojectId }, {
      onSuccess: () => { toast({ title: "Subproject deleted" }); invalidateAll(); setDeleteSubprojectId(null) },
    })
  }

  const handleCompleteSubproject = (id: number) => {
    completeSubproject.mutate({ id }, {
      onSuccess: () => { toast({ title: "Subproject completed ✓" }); invalidateAll() },
    })
  }

  const handleReopenSubproject = (id: number) => {
    reopenSubproject.mutate({ id }, {
      onSuccess: () => { toast({ title: "Subproject reopened" }); invalidateAll() },
    })
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Manage projects and their subprojects.</p>
          </div>
          <Button onClick={openCreateProject} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading projects...</div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-center text-muted-foreground py-24 flex flex-col items-center gap-4 bg-card rounded-xl border border-dashed">
            <FolderGit2 className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-semibold text-foreground">No projects yet</p>
              <p className="text-sm">Create a project to start categorizing your time.</p>
            </div>
            <Button variant="outline" onClick={openCreateProject}>Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map(project => {
              const subs = subprojectsByProject.get(project.id) ?? []
              const activeSubs = subs.filter(s => s.status === "active")
              const completedSubs = subs.filter(s => s.status === "completed")
              const isExpanded = expandedProjects.has(project.id)
              const isDone = project.status === "completed"

              return (
                <Card key={project.id} className={cn("overflow-hidden flex flex-col group", isDone && "opacity-70")}>
                  {/* color bar */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: project.color }} />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className={cn("text-base", isDone && "line-through text-muted-foreground")}>
                          {project.name}
                        </CardTitle>
                        {isDone && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium shrink-0">
                            Done
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!isDone ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                            title="Complete project" onClick={() => handleCompleteProject(project.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reopen"
                            onClick={() => handleReopenProject(project.id)}>
                            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => openEditProject(project)}>
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteProjectId(project.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* subproject summary badge */}
                    {subs.length > 0 && (
                      <button
                        onClick={() => toggleExpand(project.id)}
                        className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <GitBranch className="h-3 w-3" />
                        <span>{activeSubs.length} active</span>
                        {completedSubs.length > 0 && (
                          <span className="text-emerald-600">· {completedSubs.length} done</span>
                        )}
                      </button>
                    )}
                  </CardHeader>

                  {/* subprojects section */}
                  <CardContent className="pt-0 pb-3">
                    {(isExpanded || subs.length === 0) && (
                      <div className="space-y-0.5">
                        {isExpanded && subs.map(sub => (
                          <SubprojectRow
                            key={sub.id}
                            sub={sub}
                            projectColor={project.color}
                            onEdit={openEditSubproject}
                            onDelete={setDeleteSubprojectId}
                            onComplete={handleCompleteSubproject}
                            onReopen={handleReopenSubproject}
                          />
                        ))}
                        <button
                          onClick={() => openAddSubproject(project.id)}
                          className="flex items-center gap-2 px-4 py-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/40 mt-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add subproject
                        </button>
                      </div>
                    )}

                    {!isExpanded && subs.length > 0 && (
                      <button
                        onClick={() => openAddSubproject(project.id)}
                        className="flex items-center gap-2 px-4 py-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
                      >
                        <Plus className="h-3 w-3" />
                        Add subproject
                      </button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Project dialog ── */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProjectId ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>
              {editingProjectId ? "Update project details." : "Create a new project to track time against."}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(onSubmitProject)} className="space-y-6 pt-4">
              <FormField control={projectForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="E.g. Client Work, Open Source" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={projectForm.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-md border shadow-sm" style={{ backgroundColor: field.value }} />
                        <Input type="text" {...field} className="uppercase font-mono" />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {PRESET_COLORS.map(color => (
                          <button key={color} type="button"
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${field.value === color ? 'border-foreground shadow-md scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => projectForm.setValue("color", color, { shouldValidate: true })}
                          />
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end pt-4">
                <Button type="button" variant="ghost" className="mr-2" onClick={() => setIsProjectDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
                  {editingProjectId ? "Save Changes" : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Subproject dialog ── */}
      <Dialog open={isSubprojectDialogOpen} onOpenChange={setIsSubprojectDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{editingSubprojectId ? "Edit Subproject" : "Add Subproject"}</DialogTitle>
            <DialogDescription>
              {editingSubprojectId ? "Rename this subproject." : "Break your project into a smaller deliverable."}
            </DialogDescription>
          </DialogHeader>
          <Form {...subprojectForm}>
            <form onSubmit={subprojectForm.handleSubmit(onSubmitSubproject)} className="space-y-4 pt-2">
              <FormField control={subprojectForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="E.g. Design mockups, API endpoints" autoFocus {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsSubprojectDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createSubproject.isPending || updateSubproject.isPending}>
                  {editingSubprojectId ? "Save" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete project confirm ── */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={open => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its subprojects. Sessions will be kept but marked as unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleDeleteProject() }}
              className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete subproject confirm ── */}
      <AlertDialog open={!!deleteSubprojectId} onOpenChange={open => !open && setDeleteSubprojectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subproject?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this subproject. Sessions linked to it will remain but lose the subproject association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleDeleteSubproject() }}
              className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}
