import { Router } from "express";
import { db } from "@workspace/db";
import { todoListsTable, todoTasksTable } from "@workspace/db/schema";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { format } from "date-fns";
import {
  CreateTodoListBody, UpdateTodoListParams, UpdateTodoListBody, DeleteTodoListParams,
  CreateTodoTaskBody, ListTodoTasksQueryParams, UpdateTodoTaskParams, UpdateTodoTaskBody,
  DeleteTodoTaskParams, CompleteTodoTaskParams, UncompleteTodoTaskParams,
  GetTodoCalendarSummaryQueryParams,
  ListTodoListsResponse, CreateTodoListResponse, UpdateTodoListResponse,
  ListTodoTasksResponse, CreateTodoTaskResponse, UpdateTodoTaskResponse,
  CompleteTodoTaskResponse, UncompleteTodoTaskResponse,
  GetTodoCalendarSummaryResponse,
} from "@workspace/api-zod";
import type { TodoList, TodoTask } from "@workspace/db/schema";

const router = Router();

// ─── serializers ───────────────────────────────────────────────────────────────

function serializeList(row: TodoList) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    letter: row.letter,
    resetDaily: row.resetDaily,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeTask(row: TodoTask) {
  return {
    id: row.id,
    listId: row.listId,
    text: row.text,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    completedDate: row.completedDate ?? null,
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
  const { name, color, letter, resetDaily, sortOrder } = parsed.data;
  const [row] = await db.insert(todoListsTable).values({
    name,
    color,
    letter: letter.toUpperCase(),
    resetDaily: resetDaily ?? false,
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

// ─── todo tasks ─────────────────────────────────────────────────────────────────

// IMPORTANT: /todo-tasks/calendar-summary must be registered before /todo-tasks/:id
router.get("/todo-tasks/calendar-summary", async (req, res): Promise<void> => {
  const parsed = GetTodoCalendarSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { startDate, endDate } = parsed.data;

  const [lists, allTasks] = await Promise.all([
    db.select().from(todoListsTable).orderBy(todoListsTable.sortOrder),
    db.select().from(todoTasksTable),
  ]);

  // Build per-day events for each list
  const results: {
    date: string; listId: number; listName: string; listColor: string;
    letter: string; totalTasks: number; completedTasks: number; percentage: number;
  }[] = [];

  // Generate all dates in range
  const dates: string[] = [];
  const d = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (d <= end) {
    dates.push(format(d, "yyyy-MM-dd"));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  for (const list of lists) {
    const listTasks = allTasks.filter(t => t.listId === list.id);
    const totalTasks = listTasks.length;
    if (totalTasks === 0) continue;

    for (const date of dates) {
      const completedTasks = listTasks.filter(t => t.completedDate === date).length;
      // For non-daily lists, skip days with zero activity to avoid calendar clutter
      if (!list.resetDaily && completedTasks === 0) continue;
      results.push({
        date,
        listId: list.id,
        listName: list.name,
        listColor: list.color,
        letter: list.letter,
        totalTasks,
        completedTasks,
        percentage: Math.round((completedTasks / totalTasks) * 100),
      });
    }
  }

  res.json(GetTodoCalendarSummaryResponse.parse(results));
});

router.get("/todo-tasks", async (req, res): Promise<void> => {
  const parsed = ListTodoTasksQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = parsed.data.listId
    ? await db.select().from(todoTasksTable)
        .where(eq(todoTasksTable.listId, parsed.data.listId))
        .orderBy(todoTasksTable.sortOrder, todoTasksTable.createdAt)
    : await db.select().from(todoTasksTable).orderBy(todoTasksTable.sortOrder, todoTasksTable.createdAt);
  res.json(ListTodoTasksResponse.parse(rows.map(serializeTask)));
});

router.post("/todo-tasks", async (req, res): Promise<void> => {
  const parsed = CreateTodoTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(todoTasksTable).values({
    listId: parsed.data.listId,
    text: parsed.data.text,
    sortOrder: 0,
  }).returning();
  res.status(201).json(CreateTodoTaskResponse.parse(serializeTask(row)));
});

router.patch("/todo-tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTodoTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!parsed.data.text) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [row] = await db.update(todoTasksTable).set({ text: parsed.data.text })
    .where(eq(todoTasksTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(UpdateTodoTaskResponse.parse(serializeTask(row)));
});

router.delete("/todo-tasks/:id", async (req, res): Promise<void> => {
  const parsed = DeleteTodoTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(todoTasksTable).where(eq(todoTasksTable.id, parsed.data.id));
  res.status(204).send();
});

router.post("/todo-tasks/:id/complete", async (req, res): Promise<void> => {
  const parsed = CompleteTodoTaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const [row] = await db.update(todoTasksTable)
    .set({ completedAt: now, completedDate: format(now, "yyyy-MM-dd") })
    .where(eq(todoTasksTable.id, parsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
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
  res.json(UncompleteTodoTaskResponse.parse(serializeTask(row)));
});

export default router;
