import * as React from "react"
import { Layout } from "@/components/layout/layout"
import { useListSessions, useListProjects, useDeleteSession } from "@workspace/api-client-react"
import type { Session } from "@workspace/api-client-react"
import { format } from "date-fns"
import { Search, Filter, Trash2, Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { SessionDialog } from "@/components/session-dialog"
import { invalidateSessionQueries } from "@/lib/session-queries"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatDuration } from "@workspace/shared"

export default function Sessions() {
  const [projectIdFilter, setProjectIdFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sessionToDelete, setSessionToDelete] = React.useState<number | null>(null)
  const [sessionToEdit, setSessionToEdit] = React.useState<Session | null>(null)
  
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: projects } = useListProjects()
  
  // "unassigned" is filtered client-side since the API doesn't support null projectId queries
  const queryParams = (projectIdFilter !== "all" && projectIdFilter !== "unassigned")
    ? { projectId: Number(projectIdFilter) }
    : undefined
  const { data: sessions, isLoading } = useListSessions(queryParams)
  
  const deleteSession = useDeleteSession()

  const handleDelete = () => {
    if (!sessionToDelete) return
    deleteSession.mutate({ id: sessionToDelete }, {
      onSuccess: () => {
        toast({ title: "Session deleted" })
        invalidateSessionQueries(queryClient)
        setSessionToDelete(null)
      },
      onError: () => {
        toast({ title: "Error deleting session", variant: "destructive" })
      }
    })
  }

  const filteredSessions = React.useMemo(() => {
    if (!sessions) return []
    let result = sessions
    if (projectIdFilter === "unassigned") {
      result = result.filter(s => s.projectId == null)
    }
    if (!searchQuery) return result
    const lowerQ = searchQuery.toLowerCase()
    return result.filter(s =>
      (s.notes && s.notes.toLowerCase().includes(lowerQ)) ||
      (s.projectName && s.projectName.toLowerCase().includes(lowerQ))
    )
  }, [sessions, searchQuery, projectIdFilter])

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-8 max-w-5xl mx-auto w-full h-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sessions Log</h1>
          <p className="text-muted-foreground">Every block of work you've recorded.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search notes or projects..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={projectIdFilter} onValueChange={setProjectIdFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter project" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {projects?.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-sm flex flex-col">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex-1 flex items-center justify-center">
              Loading sessions...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex-1 flex items-center justify-center">
              No sessions found matching your filters.
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 backdrop-blur border-b">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Project</th>
                    <th className="px-6 py-4 font-semibold">Duration</th>
                    <th className="px-6 py-4 font-semibold">Time</th>
                    <th className="px-6 py-4 font-semibold w-1/3">Notes</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => setSessionToEdit(session)}
                    >
                      <td className="px-6 py-4 font-medium whitespace-nowrap">
                        {format(new Date(session.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {session.projectName ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: session.projectColor || "#ccc" }} />
                            <span>{session.projectName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">
                        {formatDuration(session.durationMinutes)}
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {session.startTime && session.endTime ? `${session.startTime} - ${session.endTime}` : "-"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]" title={session.notes || ""}>
                        {session.notes || "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-muted"
                            onClick={(e) => { e.stopPropagation(); setSessionToEdit(session) }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setSessionToDelete(session.id) }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your recorded work session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionDialog
        session={sessionToEdit}
        open={!!sessionToEdit}
        onOpenChange={(open) => !open && setSessionToEdit(null)}
      />
    </Layout>
  )
}
