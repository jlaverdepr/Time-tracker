import {
  getListTodoListsQueryKey, getListTodoEntriesQueryKey, getGetTodoDaySummaryQueryKey,
} from "@workspace/api-client-react";
import type { TodoEntry } from "@workspace/api-client-react";

export function isEntryDone(entry: TodoEntry): boolean {
  return entry.status === "done";
}

// A day's completion counts only that day's own entries (the To-Do view may
// also list earlier days' completed entries, which belong to those days).
export function dayProgress(entries: TodoEntry[], date: string): { done: number; total: number; percentage: number } {
  const own = entries.filter(e => e.date === date);
  const done = own.filter(isEntryDone).length;
  return { done, total: own.length, percentage: own.length === 0 ? 0 : Math.round((done / own.length) * 100) };
}

// Any to-do change can reshape several days at once (copies added or removed),
// so refresh every to-do view: lists, any day's entries, and calendar summaries.
export function invalidateTodoQueries(queryClient: { invalidateQueries(filters: { queryKey: readonly unknown[] }): unknown }): void {
  queryClient.invalidateQueries({ queryKey: getListTodoListsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getListTodoEntriesQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetTodoDaySummaryQueryKey() });
}
