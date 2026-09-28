import type { TodoTask } from "@workspace/api-client-react";
import { todayStr } from "./dates";

// Tasks in a resetDaily list count as done only if completed today.
export function isTaskComplete(task: TodoTask, resetDaily: boolean): boolean {
  if (!task.completedAt) return false;
  if (resetDaily) return task.completedDate === todayStr();
  return true;
}

export function completionRate(tasks: TodoTask[], resetDaily: boolean): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => isTaskComplete(t, resetDaily)).length;
  return Math.round((done / tasks.length) * 100);
}
