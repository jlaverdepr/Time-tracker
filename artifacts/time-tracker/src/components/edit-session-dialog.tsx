import * as React from "react"
import { parseISO } from "date-fns"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useUpdateSession, useListProjects, useListSubprojects,
  getGetStatsQueryKey, getListSessionsQueryKey,
  getGetRecentSessionsQueryKey, getGetCalendarQueryKey,
  getGetSubprojectCalendarEventsQueryKey,
} from "@workspace/api-client-react"
import type { Session } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  projectId: z.string().optional().nullable(),
  subprojectId: z.string().optional().nullable(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  notes: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof formSchema>

function invalidateSessionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() })
  queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() })
  queryClient.invalidateQueries({ queryKey: getGetRecentSessionsQueryKey() })
  queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey() })
  queryClient.invalidateQueries({ queryKey: getGetSubprojectCalendarEventsQueryKey() })
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
}

export function EditSessionDialog({
  session,
  open,
  onOpenChange,
}: {
  session: Session | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: projects } = useListProjects()
  const { data: allSubprojects } = useListSubprojects()
  const updateSession = useUpdateSession()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: null,
      subprojectId: null,
      date: "",
      startTime: "",
      endTime: "",
      durationMinutes: 60,
      notes: "",
    },
  })

  React.useEffect(() => {
    if (session && open) {
      form.reset({
        projectId: session.projectId != null ? String(session.projectId) : null,
        subprojectId: session.subprojectId != null ? String(session.subprojectId) : null,
        date: session.date,
        startTime: session.startTime || "",
        endTime: session.endTime || "",
        durationMinutes: session.durationMinutes,
        notes: session.notes || "",
      })
    }
  }, [session, open, form])

  const selectedProjectId = form.watch("projectId")

  const availableSubprojects = React.useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "none" || !allSubprojects) return []
    return allSubprojects.filter(s => s.projectId === Number(selectedProjectId) && s.status === "active")
  }, [selectedProjectId, allSubprojects])

  // Auto-recalc duration whenever the user edits either time field
  const startTime = form.watch("startTime")
  const endTime = form.watch("endTime")
  React.useEffect(() => {
    if (startTime && endTime && startTime.length === 5 && endTime.length === 5) {
      const start = parseISO(`1970-01-01T${startTime}:00`)
      const end = parseISO(`1970-01-01T${endTime}:00`)
      let diffMins = (end.getTime() - start.getTime()) / 60000
      if (diffMins < 0) diffMins += 24 * 60
      if (diffMins > 0) form.setValue("durationMinutes", diffMins, { shouldValidate: true })
    }
  }, [startTime, endTime, form])

  const onSubmit = (values: FormValues) => {
    if (!session) return
    updateSession.mutate({
      id: session.id,
      data: {
        projectId: values.projectId && values.projectId !== "none" ? Number(values.projectId) : null,
        subprojectId: values.subprojectId && values.subprojectId !== "none" ? Number(values.subprojectId) : null,
        date: values.date,
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        durationMinutes: values.durationMinutes,
        notes: values.notes || null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Session updated" })
        invalidateSessionQueries(queryClient)
        onOpenChange(false)
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update session.", variant: "destructive" })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Session</DialogTitle>
          <DialogDescription>Adjust the time, date, or details of this session.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

            <FormField control={form.control} name="projectId" render={({ field }) => (
              <FormItem>
                <FormLabel>Project</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "none"}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
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

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl><Input type="time" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <FormControl><Input type="time" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="durationMinutes" render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (Minutes)</FormLabel>
                <FormControl><Input type="number" min="1" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Input placeholder="What did you work on?" {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="mr-2">Cancel</Button>
              <Button type="submit" disabled={updateSession.isPending}>Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
