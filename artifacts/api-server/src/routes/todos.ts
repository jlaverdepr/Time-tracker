import { Router } from "express";
import { db } from "@workspace/db";
import { todoListsTable, todoTasksTable, todoTaskCompletionsTable, todoActiveLogTable } from "@workspace/db/schema";
import { eq, and, lt, isNull, isNotNull, inArray } from "drizzle-orm";
import { format } from "date-fns";
import {
  CreateTodoListBody, UpdateTodoListParams, UpdateTodoListBody, DeleteTodoListParams,
  ClearCompletedTodoTasksParams,
  CreateTodoTaskBody, ListTodoTasksQueryParams, UpdateTodoTaskParams, UpdateTodoTaskBody,
  DeleteTodoTaskParams, CompleteTodoTaskParams, UncompleteTodoTaskParams,
  GetTodoCalendarSummaryQueryParams, GetTodoDayDetailQueryParams, ToggleTodoDayDetailTaskBody,
  ListTodoListsResponse, CreateTodoListResponse, UpdateTodoListResponse,
  ClearCompletedTodoTasksResponse,
  ListTodoTasksResponse, CreateTodoTaskResponse, UpdateTodoTaskResponse,
  CompleteTodoTaskResponse, UncompleteTodoTaskResponse,
  GetTodoCalendarSummaryResponse, GetTodoDayDetailResponse, ToggleTodoDayDetailTaskResponse,
} from "@workspace/api-zod";
import type { TodoList, TodoTask } from "@workspace/db/schema";

const router = Router();

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function taskEffectiveDate(task: TodoTask): string {
  return task.scheduledDate ?? format(task.createdAt, "yyyy-MM-dd");
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return format(d, "yyyy-MM-dd");
}

// Recomputes the full "active task log" for a list: which tasks were part of
// its active (pending) set on each day from the list's earliest task up to
// today. A task is active on a day if it's a resetDaily list (recurring
// checklist, every task active every day), was newly created/scheduled that
// day, or was active the previous day and not completed that day (carried
// over as pending backlog). Run in full after any change to a list's tasks
// or completions so history stays consistent — cheap at personal-app scale,
// and avoids the drift risk of patching the log incrementally.
async function recomputeActiveLog(listId: number): Promise<void> {
  const [list] = await db.select().from(todoListsTable).where(eq(todoListsTable.id, listId));
  if (!list) return;

  const tasks = await db.select().from(todoTasksTable).where(eq(todoTasksTable.listId, listId));
  const taskIds = tasks.map(t => t.id);
  if (taskIds.length === 0) return;

  await db.delete(todoActiveLogTable).where(inArray(todoActiveLogTable.taskId, taskIds));

  const todayStr = today();
  const earliestDate = tasks.map(taskEffectiveDate).reduce((min, d) => d < min ? d : min);
  if (earliestDate > todayStr) return; // only future-prepared tasks exist so far

  const completions = await db.select().from(todoTaskCompletionsTable)
    .where(inArray(todoTaskCompletionsTable.taskId, taskIds));
  const completionsByDate = new Map<string, Set<number>>();
  for (const c of completions) {
    if (!completionsByDate.has(c.date)) completionsByDate.set(c.date, new Set());
    completionsByDate.get(c.date)!.add(c.taskId);
  }

  const rows: { taskId: number; date: string }[] = [];
  let prevActive = new Set<number>();
  for (let date = earliestDate; date <= todayStr; date = addDays(date, 1)) {
    let active: Set<number>;
    if (list.resetDaily) {
      active = new Set(tasks.filter(t => taskEffectiveDate(t) <= date).map(t => t.id));
    } else {
      const prevCompleted = completionsByDate.get(addDays(date, -1)) ?? new Set();
      const carried = [...prevActive].filter(id => !prevCompleted.has(id));
      const newToday = tasks.filter(t => taskEffectiveDate(t) === date).map(t => t.id);
      active = new Set([...carried, ...newToday]);
    }
    for (const taskId of active) rows.push({ taskId, date });
    prevActive = active;
  }

  if (rows.length > 0) await db.insert(todoActiveLogTable).values(rows);
}

// ─── serializers ───────────────────────────────────────────────────────────────

function serializeList(row: TodoList) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    letter: row.letter,
    resetDaily: row.resetDaily,
    autoClearCompleted: row.autoClearCompleted,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeTask(row: TodoTask) {
  return {
    id: row.id,
    listId: row.listId,
    projectId: row.projectId ?? null,
    subprojectId: row.subprojectId ?? null,
    text: row.text,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    completedDate: row.completedDate ?? null,
    clearedAt: row.clearedAt ? row.clearedAt.toISOString() : null,
    scheduledDate: row.scheduledDate ?? null,
    reminderTime: row.reminderTime ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── todo lists ────────────────────────────────────────────────────────────────

router.get("/todo-lists", async (_req, res): Promise<void> => {
  const rows = await db.select().from(todoListsTable).orderBy(todoListsTable.sortOrder, todoListsTable.createdAt);
  res.json(ListTodoListsResponse.parse(rows.map(serializeList)));
});

router.post("/todo-lists", async (req, res): Promise<void> => {
  const parsed = CreateTodoListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, color, letter, resetDaily, autoClearCompleted, sortOrder } = parsed.data;
  const [row] = await db.insert(todoListsTable).values({
    name,
    color,
    letter: letter.toUpperCase(),
    resetDaily: resetDaily ?? false,
    autoClearCompleted: autoClearCompleted ?? false,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(CreateTodoListResponse.parse(serializeList(row)));
});

router.patch("/todo-lists/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoListParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTodoListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof todoListsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (parsed.data.letter !== undefined) updates.letter = parsed.data.letter.toUpperCase();
  if (parsed.data.resetDaily !== undefined) updates.resetDaily = parsed.data.resetDaily;
  if (parsed.data.autoClearCompleted !== undefined) updates.autoClearCompleted = parsed.data.autoClearCompleted;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [row] = await db.update(todoListsTable).set(updates).where(eq(todoListsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "List not found" }); return; }
  res.json(UpdateTodoListResponse.parse(serializeList(row)));
});

router.delete("/todo-lists/:id", async (req, res): Promise<void> => {
  const parsed = DeleteTodoListParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(todoListsTable).where(eq(todoListsTable.id, parsed.data.id));
  res.status(204).send();
});

router.post("/todo-lists/:id/clear-completed", async (req, res): Promise<void> => {
  const parsed = ClearCompletedTodoTasksParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = await db.update(todoTasksTable)
    .set({ clearedAt: new Date() })
    .where(and(
      eq(todoTasksTable.listId, parsed.data.id),
      isNotNull(todoTasksTable.completedAt),
      isNull(todoTasksTable.clearedAt),
    ))
    .returning();
  res.json(ClearCompletedTodoTasksResponse.parse({ clearedCount: rows.length }));
});

// ─── todo tasks ─────────────────────────────────────────────────────────────────

// IMPORTANT: /todo-tasks/calendar-summary and /todo-tasks/day-detail(/toggle) must be
// registered before /todo-tasks/:id, otherwise Express matches them as an :id param.
router.get("/todo-tasks/calendar-summary", async (req, res): Promise<void> => {
  const parsed = GetTodoCalendarSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { startDate, endDate } = parsed.data;
  const todayStr = today();

  const lists = await db.select().from(todoListsTable).orderBy(todoListsTable.sortOrder);
  for (const list of lists) {
    await recomputeActiveLog(list.id);
  }

  const [allTasks, allCompletions, allActiveLog] = await Promise.all([
    db.select().from(todoTasksTable),
    db.select().from(todoTaskCompletionsTable),
    db.select().from(todoActiveLogTable),
  ]);

  const results: {
    date: string; listId: number; listName: string; listColor: string;
    letter: string; totalTasks: number; completedTasks: number; preparedTasks: number; percentage: number;
  }[] = [];

  const dates: string[] = [];
  const d = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (d <= end) {
    dates.push(format(d, "yyyy-MM-dd"));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  for (const list of lists) {
    const listTasks = allTasks.filter(t => t.listId === list.id);
    if (listTasks.length === 0) continue;
    const listTaskIds = new Set(listTasks.map(t => t.id));
    const listCompletions = allCompletions.filter(c => listTaskIds.has(c.taskId));
    const listActiveLog = allActiveLog.filter(a => listTaskIds.has(a.taskId));

    for (const date of dates) {
      const completedTaskIdsForDate = new Set(listCompletions.filter(c => c.date === date).map(c => c.taskId));
      const totalTasks = new Set(listActiveLog.filter(a => a.date === date).map(a => a.taskId)).size;
      const completedTasks = completedTaskIdsForDate.size;
      const preparedTasks = listTasks.filter(t => t.scheduledDate === date).length;

      const isFuture = date > todayStr;
      const isToday = date === todayStr;
      const liveVisibleCount = isToday
        ? listTasks.filter(t => t.clearedAt == null && taskEffectiveDate(t) <= date).length
        : 0;

      const showBadge = isFuture
        ? preparedTasks > 0
        : isToday
          ? (liveVisibleCount > 0 || completedTasks > 0 || preparedTasks > 0)
          : (completedTasks > 0 || preparedTasks > 0);

      if (!showBadge) continue;

      results.push({
        date,
        listId: list.id,
        listName: list.name,
        listColor: list.color,
        letter: list.letter,
        totalTasks,
        completedTasks,
        preparedTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      });
    }
  }

  res.json(GetTodoCalendarSummaryResponse.parse(results));
});

router.get("/todo-tasks/day-detail", async (req, res): Promise<void> => {
  const parsed = GetTodoDayDetailQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { listId, date } = parsed.data;

  await recomputeActiveLog(listId);

  const [tasks, completions, activeLog] = await Promise.all([
    db.select().from(todoTasksTable).where(eq(todoTasksTable.listId, listId))
      .orderBy(todoTasksTable.sortOrder, todoTasksTable.createdAt),
    db.select().from(todoTaskCompletionsTable).where(eq(todoTaskCompletionsTable.date, date)),
    db.select().from(todoActiveLogTable).where(eq(todoActiveLogTable.date, date)),
  ]);

  const completedTaskIds = new Set(completions.map(c => c.taskId));
  const activeTaskIds = new Set(activeLog.map(a => a.taskId));

  const results = tasks
    .filter(t => activeTaskIds.has(t.id))
    .map(t => ({
      taskId: t.id,
      text: t.text,
      completed: completedTaskIds.has(t.id),
    }));

  res.json(GetTodoDayDetailResponse.parse(results));
});

router.post("/todo-tasks/day-detail/toggle", async (req, res): Promise<void> => {
  const parsed = ToggleTodoDayDetailTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { taskId, date, completed } = parsed.data;

  const [task] = await db.select().from(todoTasksTable).where(eq(todoTasksTable.id, taskId));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  if (completed) {
    await db.insert(todoTaskCompletionsTable).values({ taskId, date }).onConflictDoNothing();
  } else {
    await db.delete(todoTaskCompletionsTable)
      .where(and(eq(todoTaskCompletionsTable.taskId, taskId), eq(todoTaskCompletionsTable.date, date)));
  }

  // Only today's toggle updates the live cache fields used by the main To Do
  // page; past-day edits are history-only and must not disturb today's view.
  if (date === today()) {
    await db.update(todoTasksTable)
      .set(completed
        ? { completedAt: new Date(), completedDate: date }
        : { completedAt: null, completedDate: null })
      .where(eq(todoTasksTable.id, taskId));
  }

  await recomputeActiveLog(task.listId);
  res.json(ToggleTodoDayDetailTaskResponse.parse({ taskId, text: task.text, completed }));
});

router.get("/todo-tasks", async (req, res): Promise<void> => {
  const parsed = ListTodoTasksQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const todayStr = today();

  // Opportunistic sweep: lists with autoClearCompleted soft-clear any task
  // completed on a previous day that hasn't been cleared yet. Self-heals
  // whenever the app is next opened; no background job required.
  const allLists = await db.select().from(todoListsTable);
  for (const list of allLists) {
    if (list.autoClearCompleted) {
      await db.update(todoTasksTable)
        .set({ clearedAt: new Date() })
        .where(and(
          eq(todoTasksTable.listId, list.id),
          isNotNull(todoTasksTable.completedDate),
          lt(todoTasksTable.completedDate, todayStr),
          isNull(todoTasksTable.clearedAt),
        ));
    }
    // Same self-healing idea for the active-task log: catches up any days
    // that elapsed with the app closed, with no mutation to trigger it.
    await recomputeActiveLog(list.id);
  }

  const conditions = [];
  if (parsed.data.listId) conditions.push(eq(todoTasksTable.listId, parsed.data.listId));
  if (parsed.data.projectId) conditions.push(eq(todoTasksTable.projectId, parsed.data.projectId));

  const rows = conditions.length > 0
    ? await db.select().from(todoTasksTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(todoTasksTable.sortOrder, todoTasksTable.createdAt)
    : await db.select().from(todoTasksTable).orderBy(todoTasksTable.sortOrder, todoTasksTable.createdAt);

  const includeCleared = parsed.data.includeCleared ?? false;
  const includeFuture = parsed.data.includeFuture ?? false;

  const filtered = rows.filter(t => {
    if (!includeCleared && t.clearedAt != null) return false;
    if (!includeFuture && t.scheduledDate != null && t.scheduledDate > todayStr) return false;
    return true;
  });

  res.json(ListTodoTasksResponse.parse(filtered.map(serializeTask)));
});

router.post("/todo-tasks", async (req, res): Promise<void> => {
  const parsed = CreateTodoTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(todoTasksTable).values({
    listId: parsed.data.listId,
    text: parsed.data.text,
    projectId: parsed.data.projectId ?? null,
    subprojectId: parsed.data.subprojectId ?? null,
    scheduledDate: parsed.data.scheduledDate ?? null,
    reminderTime: parsed.data.reminderTime ?? null,
    sortOrder: 0,
  }).returning();
  await recomputeActiveLog(row.listId);
  res.status(201).json(CreateTodoTaskResponse.parse(serializeTask(row)));
});

router.patch("/todo-tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTodoTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(todoTasksTable).where(eq(todoTasksTable.id, params.data.id));
  const previousListId = existing[0]?.listId;

  const updates: Partial<typeof todoTasksTable.$inferInsert> = {};
  if (parsed.data.text !== undefined) updates.text = parsed.data.text;
  if ("projectId" in parsed.data) updates.projectId = parsed.data.projectId ?? null;
  if ("subprojectId" in parsed.data) updates.subprojectId = parsed.data.subprojectId ?? null;
  if ("scheduledDate" in parsed.data) updates.scheduledDate = parsed.data.scheduledDate ?? null;
  if ("reminderTime" in parsed.data) updates.reminderTime = parsed.data.reminderTime ?? null;
  if (parsed.data.listId !== undefined) updates.listId = parsed.data.listId;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [row] = await db.update(todoTasksTable).set(updates)
    .where(eq(todoTasksTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  if ("scheduledDate" in parsed.data) await recomputeActiveLog(row.listId);
  if (parsed.data.listId !== undefined && previousListId !== undefined && previousListId !== row.listId) {
    await recomputeActiveLog(previousListId);
    await recomputeActiveLog(row.listId);
  }
  res.json(UpdateTodoTaskResponse.parse(serializeTask(row)));
});

router.delete("/todo-tasks/:id", async (req, res): Promise<void> => {
  const parsed = DeleteTodoTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.delete(todoTasksTable).where(eq(todoTasksTable.id, parsed.data.id)).returning();
  if (row) await recomputeActiveLog(row.listId);
  res.status(204).send();
});

router.post("/todo-tasks/:id/complete", async (req, res): Promise<void> => {
  const parsed = CompleteTodoTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const [row] = await db.update(todoTasksTable)
    .set({ completedAt: now, completedDate: todayStr })
    .where(eq(todoTasksTable.id, parsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  await db.insert(todoTaskCompletionsTable)
    .values({ taskId: row.id, date: todayStr, completedAt: now })
    .onConflictDoNothing();
  await recomputeActiveLog(row.listId);
  res.json(CompleteTodoTaskResponse.parse(serializeTask(row)));
});

router.post("/todo-tasks/:id/uncomplete", async (req, res): Promise<void> => {
  const parsed = UncompleteTodoTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(todoTasksTable)
    .set({ completedAt: null, completedDate: null })
    .where(eq(todoTasksTable.id, parsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  // Only remove today's completion fact; a task completed on an earlier day
  // (still visible because auto-clear is off) keeps that day's history intact.
  await db.delete(todoTaskCompletionsTable)
    .where(and(eq(todoTaskCompletionsTable.taskId, row.id), eq(todoTaskCompletionsTable.date, today())));
  await recomputeActiveLog(row.listId);
  res.json(UncompleteTodoTaskResponse.parse(serializeTask(row)));
});

export default router;
