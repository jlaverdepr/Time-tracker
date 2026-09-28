import type { QueryClient } from "@tanstack/react-query"
import {
  getGetStatsQueryKey, getListSessionsQueryKey,
  getGetRecentSessionsQueryKey, getGetCalendarQueryKey,
  getGetSubprojectCalendarEventsQueryKey,
} from "@workspace/api-client-react"

// Everything that shows session data. Call after any session create/update/delete.
export function invalidateSessionQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() })
  queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() })
  queryClient.invalidateQueries({ queryKey: getGetRecentSessionsQueryKey() })
  queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey() })
  queryClient.invalidateQueries({ queryKey: getGetSubprojectCalendarEventsQueryKey() })
  // Calendar day panel's per-date session list (see pages/calendar.tsx)
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
}
