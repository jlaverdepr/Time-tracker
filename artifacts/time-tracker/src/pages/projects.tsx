import * as React from "react"
import { Layout } from "@/components/layout/layout"
import { useListProjects, useCreateProject, useUpdateProject, useDeleteProject, getListProjectsQueryKey } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2, Edit2, Plus, FolderGit2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1, "Color is required").regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
})

type ProjectFormValues = z.infer<typeof projectSchema>

const PRESET_COLORS = [
  "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", 
  "#d946ef", "#ec4899", "#f43f5e", "#f43f5e", "#eab308", 
  "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#10b981", 
  "#64748b", "#71717a", "#78716c"
]

export default function Projects() {
  const { data: projects, isLoading } = useListProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0] }
  })

  const openCreate = () => {
    setEditingId(null)
    form.reset({ name: "", color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] })
    setIsDialogOpen(true)
  }

  const openEdit = (project: { id: number, name: string, color: string }) => {
    setEditingId(project.id)
    form.reset({ name: project.name, color: project.color })
    setIsDialogOpen(true)
  }

  const onSubmit = (values: ProjectFormValues) => {
    if (editingId) {
      updateProject.mutate({ id: editingId, data: values }, {
        onSuccess: () => {
          toast({ title: "Project updated" })
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
          setIsDialogOpen(false)
        }
      })
    } else {
      createProject.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: "Project created" })
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
          setIsDialogOpen(false)
        }
      })
    }
  }

  const handleDelete = () => {
    if (!deleteId) return
    deleteProject.mutate({ id: deleteId }, {
      onSuccess: () => {
        toast({ title: "Project deleted" })
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        setDeleteId(null)
      }
    })
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Manage the buckets of work you track.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
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
            <Button variant="outline" onClick={openCreate}>Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden group flex flex-col">
                <div className="h-3 w-full" style={{ backgroundColor: project.color }} />
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <CardTitle>{project.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(project)}>
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(project.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update project details." : "Create a new project to track time against."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Client Work, Open Source, Admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Theme</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <div className="flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-md border shadow-sm" style={{ backgroundColor: field.value }} />
                          <Input type="text" {...field} className="uppercase font-mono uppercase" />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${field.value === color ? 'border-foreground shadow-md scale-110' : 'border-transparent'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => form.setValue("color", color, { shouldValidate: true })}
                            />
                          ))}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="button" variant="ghost" className="mr-2" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
                  {editingId ? "Save Changes" : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project. Any sessions associated with this project will be kept but marked as unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}
