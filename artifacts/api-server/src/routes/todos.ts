import { Router } from "express";
import { db } from "@workspace/db";
import { todoListsTable } from "@workspace/db/schema";
import type { TodoList, TodoTask, TodoSubtask } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateTodoListBody, UpdateTodoListParams, UpdateTodoListBody, DeleteTodoListParams,
  ClearCompletedTodoEntriesParams,
  ListTodoEntriesQueryParams, CreateTodoEntryBody, GetTodoDaySummaryQueryParams,
  UpdateTodoEntryParams, UpdateTodoEntryBody, DeleteTodoEntryParams,
  UpdateTodoTaskParams, UpdateTodoTaskBody,
  CreateTodoSubtaskParams, CreateTodoSubtaskBody, CreateTodoSubtaskResponse,
  UpdateTodoSubtaskParams, UpdateTodoSubtaskBody, UpdateTodoSubtaskResponse,
  DeleteTodoSubtaskParams, SetTodoSubtaskDoneParams, SetTodoSubtaskDoneBody, SetTodoSubtaskDoneResponse,
  ListTodoListsResponse, CreateTodoListResponse, UpdateTodoListResponse,
  ClearCompletedTodoEntriesResponse,
  ListTodoEntriesResponse, CreateTodoEntryResponse, GetTodoDaySummaryResponse,
  UpdateTodoEntryResponse, UpdateTodoTaskResponse,
} from "@workspace/api-zod";
import {
  ensureRolledOver, todayStr, serializeEntry, listEntries, daySummary,
  createEntry, setEntryStatus, deleteEntry, updateTask, clearCompleted,
  createSubtask, updateSubtask, deleteSubtask, setSubtaskDone,
} from "../lib/todo-days";

const router = Router();

// Every to-do request first materializes any days that started since the
// last one (the server may have been asleep at midnight).
router.use(["/todo-lists", "/todo-entries", "/todo-tasks", "/todo-subtasks"], (_req, _res, next) => {
  ensureRolledOver();
  next();
});

function serializeList(row: TodoList) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    letter: row.letter,
    carryMode: row.carryMode as "carry" | "repeat" | "none",
    autoClearCompleted: row.autoClearCompleted,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeTask(row: TodoTask) {
  return {
    id: row.id,
    listId: row.listId,
    text: row.text,
    projectId: row.projectId ?? null,
    subprojectId: row.subprojectId ?? null,
    reminderTime: row.reminderTime ?? null,
    sortOrder: row.sortOrder,
  };
}

function serializeSubtask(row: TodoSubtask) {
  return { id: row.id, taskId: row.taskId, text: row.text, sortOrder: row.sortOrder };
}

// ─── todo lists ────────────────────────────────────────────────────────────────

router.get("/todo-lists", async (_req, res): Promise<void> => {
  const rows = await db.select().from(todoListsTable).orderBy(todoListsTable.sortOrder, todoListsTable.createdAt);
  res.json(ListTodoListsResponse.parse(rows.map(serializeList)));
});

router.post("/todo-lists", async (req, res): Promise<void> => {
  const parsed = CreateTodoListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, color, letter, carryMode, autoClearCompleted, sortOrder } = parsed.data;
  const [row] = await db.insert(todoListsTable).values({
    name,
    color,
    letter: letter.toUpperCase(),
    carryMode: carryMode ?? "carry",
    autoClearCompleted: autoClearCompleted ?? false,
    sortOrder: sortOrder ?? 0,
    lastRolledDate: todayStr(),
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
  if (parsed.data.carryMode !== undefined) updates.carryMode = parsed.data.carryMode;
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
  const parsed = ClearCompletedTodoEntriesParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  res.json(ClearCompletedTodoEntriesResponse.parse({ clearedCount: clearCompleted(parsed.data.id) }));
});

// ─── day entries ───────────────────────────────────────────────────────────────

router.get("/todo-entries", async (req, res): Promise<void> => {
  const parsed = ListTodoEntriesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  res.json(ListTodoEntriesResponse.parse(listEntries(parsed.data).map(serializeEntry)));
});

router.post("/todo-entries", async (req, res): Promise<void> => {
  const parsed = CreateTodoEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const created = createEntry(parsed.data);
  if (!created) { res.status(404).json({ error: "List not found" }); return; }
  res.status(201).json(CreateTodoEntryResponse.parse(serializeEntry(created)));
});

// Registered before /todo-entries/:id so "summary" isn't taken as an id.
router.get("/todo-entries/summary", async (req, res): Promise<void> => {
  const parsed = GetTodoDaySummaryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  res.json(GetTodoDaySummaryResponse.parse(daySummary(parsed.data.startDate, parsed.data.endDate)));
});

router.patch("/todo-entries/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoEntryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTodoEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updated = setEntryStatus(params.data.id, parsed.data.status);
  if (!updated) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json(UpdateTodoEntryResponse.parse(serializeEntry(updated)));
});

router.put("/todo-entries/:id/subtasks/:subtaskId", async (req, res): Promise<void> => {
  const params = SetTodoSubtaskDoneParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = SetTodoSubtaskDoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updated = setSubtaskDone(params.data.id, params.data.subtaskId, parsed.data.done);
  if (!updated) { res.status(404).json({ error: "Entry or subtask not found" }); return; }
  res.json(SetTodoSubtaskDoneResponse.parse(serializeEntry(updated)));
});

router.delete("/todo-entries/:id", async (req, res): Promise<void> => {
  const parsed = DeleteTodoEntryParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!deleteEntry(parsed.data.id)) { res.status(404).json({ error: "Entry not found" }); return; }
  res.status(204).send();
});

// ─── tasks (details shared by all of a task's entries) ─────────────────────────

router.patch("/todo-tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTodoTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Parameters<typeof updateTask>[1] = {};
  if (parsed.data.text !== undefined) updates.text = parsed.data.text;
  if ("projectId" in parsed.data) updates.projectId = parsed.data.projectId ?? null;
  if ("subprojectId" in parsed.data) updates.subprojectId = parsed.data.subprojectId ?? null;
  if ("reminderTime" in parsed.data) updates.reminderTime = parsed.data.reminderTime ?? null;
  if (parsed.data.listId !== undefined) updates.listId = parsed.data.listId;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const task = updateTask(params.data.id, updates);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(UpdateTodoTaskResponse.parse(serializeTask(task)));
});


// ─── subtasks ──────────────────────────────────────────────────────────────────

router.post("/todo-tasks/:id/subtasks", async (req, res): Promise<void> => {
  const params = CreateTodoSubtaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateTodoSubtaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const subtask = createSubtask(params.data.id, parsed.data);
  if (!subtask) { res.status(404).json({ error: "Task not found" }); return; }
  res.status(201).json(CreateTodoSubtaskResponse.parse(serializeSubtask(subtask)));
});

router.patch("/todo-subtasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoSubtaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTodoSubtaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.text === undefined && parsed.data.sortOrder === undefined) { res.status(400).json({ error: "Nothing to update" }); return; }
  const subtask = updateSubtask(params.data.id, parsed.data);
  if (!subtask) { res.status(404).json({ error: "Subtask not found" }); return; }
  res.json(UpdateTodoSubtaskResponse.parse(serializeSubtask(subtask)));
});

router.delete("/todo-subtasks/:id", async (req, res): Promise<void> => {
  const parsed = DeleteTodoSubtaskParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!deleteSubtask(parsed.data.id)) { res.status(404).json({ error: "Subtask not found" }); return; }
  res.status(204).send();
});

export default router;
