// Day-entry engine for to-dos. A day's to-do state is exactly the rows in
// todo_entries with that date; everything the UI shows (lists, percentages,
// calendar icons) is read straight from them. The rules:
//
// - Rollover: when a new day starts, each list copies entries from the
//   previous day according to its carryMode:
//     carry  – pending entries only, linked to the entry they came from
//     repeat – every entry, as an independent pending entry (no link)
//     none   – nothing
//   The server may be asleep at midnight, so rollover is lazy: every to-do
//   request first catches up any days since the list's lastRolledDate.
// - Late corrections: marking an entry done deletes the copies made from it
//   (and, via ON DELETE CASCADE on copied_from_entry_id, their copies).
//   Marking a past entry pending again re-copies it forward to today.
// - Deleting an entry deletes the copies made from it the same way.
// - Subtasks belong to the task; which are ticked belongs to each entry.
//   A carried copy starts with its source's ticks; a repeat copy with none.
//
// All multi-step mutations run inside one synchronous better-sqlite3
// transaction, so concurrent requests can't interleave mid-update.
import { db } from "@workspace/db";
import {
  todoListsTable, todoTasksTable, todoEntriesTable, todoSubtasksTable, todoSubtaskChecksTable,
} from "@workspace/db/schema";
import type { TodoEntry, TodoList, TodoTask, TodoSubtask } from "@workspace/db/schema";
import { and, asc, count, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { format } from "date-fns";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CarryMode = "carry" | "repeat" | "none";
export type EntryStatus = "pending" | "done";

// Server-local calendar date. Set TZ on the server (see fly.toml) so "a new
// day" starts at the user's midnight, not UTC's.
export function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── rollover ──────────────────────────────────────────────────────────────────

// A carried copy keeps the subtasks already ticked on the entry it came from.
function copyChecks(tx: Tx, fromEntryId: number, toEntryId: number): void {
  const checks = tx.select().from(todoSubtaskChecksTable)
    .where(eq(todoSubtaskChecksTable.entryId, fromEntryId)).all();
  for (const c of checks) {
    tx.insert(todoSubtaskChecksTable)
      .values({ subtaskId: c.subtaskId, entryId: toEntryId, completedAt: c.completedAt })
      .onConflictDoNothing().run();
  }
}

function rollOverList(tx: Tx, list: TodoList, today: string): void {
  if (list.lastRolledDate != null && list.lastRolledDate >= today) return;

  if (list.lastRolledDate != null && list.carryMode !== "none") {
    for (let date = addDays(list.lastRolledDate, 1); date <= today; date = addDays(date, 1)) {
      const prevDate = addDays(date, -1);
      const prevEntries = tx.select().from(todoEntriesTable)
        .where(and(eq(todoEntriesTable.listId, list.id), eq(todoEntriesTable.date, prevDate)))
        .all();
      for (const e of prevEntries) {
        if (list.carryMode === "carry" && e.status !== "pending") continue;
        const copy = tx.insert(todoEntriesTable).values(
          list.carryMode === "carry"
            ? { taskId: e.taskId, listId: list.id, date, status: "pending", copiedFromDate: prevDate, copiedFromEntryId: e.id }
            : { taskId: e.taskId, listId: list.id, date, status: "pending" },
        ).onConflictDoNothing().returning().get();
        if (copy && list.carryMode === "carry") copyChecks(tx, e.id, copy.id);
      }
    }
  }

  tx.update(todoListsTable).set({ lastRolledDate: today }).where(eq(todoListsTable.id, list.id)).run();
}

export function ensureRolledOver(): void {
  const today = todayStr();
  const stale = db.select().from(todoListsTable).all()
    .filter(l => l.lastRolledDate == null || l.lastRolledDate < today);
  if (stale.length === 0) return;
  db.transaction(tx => {
    // Re-read inside the transaction in case another request just rolled it.
    for (const { id } of stale) {
      const list = tx.select().from(todoListsTable).where(eq(todoListsTable.id, id)).get();
      if (list) rollOverList(tx, list, today);
    }
  });
}

// Copies a pending entry on a past day forward, day by day up to today, the
// way the rollover would have. Stops at the first day the task already has an
// entry (it's already there, or was scheduled there separately).
function carryForward(tx: Tx, from: TodoEntry, today: string): void {
  let prev = from;
  for (let date = addDays(from.date, 1); date <= today; date = addDays(date, 1)) {
    const existing = tx.select({ id: todoEntriesTable.id }).from(todoEntriesTable)
      .where(and(eq(todoEntriesTable.taskId, from.taskId), eq(todoEntriesTable.date, date))).get();
    if (existing) return;
    const copy = tx.insert(todoEntriesTable).values({
      taskId: from.taskId, listId: from.listId, date, status: "pending",
      copiedFromDate: prev.date, copiedFromEntryId: prev.id,
    }).returning().get();
    copyChecks(tx, prev.id, copy.id);
    prev = copy;
  }
}

// Repeat lists: an entry added on a past day recurs on every day since.
function repeatForward(tx: Tx, from: TodoEntry, today: string): void {
  for (let date = addDays(from.date, 1); date <= today; date = addDays(date, 1)) {
    tx.insert(todoEntriesTable)
      .values({ taskId: from.taskId, listId: from.listId, date, status: "pending" })
      .onConflictDoNothing().run();
  }
}

// ─── reads ─────────────────────────────────────────────────────────────────────

type EntryRow = { entry: TodoEntry; task: TodoTask };
export type EntryWithTask = EntryRow & { subtasks: (TodoSubtask & { done: boolean })[] };

export function serializeEntry({ entry, task, subtasks }: EntryWithTask) {
  return {
    id: entry.id,
    taskId: entry.taskId,
    listId: entry.listId,
    date: entry.date,
    status: entry.status as EntryStatus,
    copiedFromDate: entry.copiedFromDate ?? null,
    completedAt: entry.completedAt ? entry.completedAt.toISOString() : null,
    text: task.text,
    projectId: task.projectId ?? null,
    subprojectId: task.subprojectId ?? null,
    reminderTime: task.reminderTime ?? null,
    sortOrder: task.sortOrder,
    subtasks: subtasks.map(s => ({ id: s.id, text: s.text, sortOrder: s.sortOrder, done: s.done })),
  };
}

// Adds each entry's subtasks (from its task) and which are ticked on its day.
function withSubtasks(tx: Tx | typeof db, rows: EntryRow[]): EntryWithTask[] {
  if (rows.length === 0) return [];
  const taskIds = [...new Set(rows.map(r => r.task.id))];
  const subtasks = tx.select().from(todoSubtasksTable)
    .where(inArray(todoSubtasksTable.taskId, taskIds))
    .orderBy(asc(todoSubtasksTable.sortOrder), asc(todoSubtasksTable.id)).all();
  if (subtasks.length === 0) return rows.map(r => ({ ...r, subtasks: [] }));
  const checks = tx.select().from(todoSubtaskChecksTable)
    .where(inArray(todoSubtaskChecksTable.entryId, rows.map(r => r.entry.id))).all();
  const ticked = new Set(checks.map(c => `${c.entryId}:${c.subtaskId}`));
  return rows.map(r => ({
    ...r,
    subtasks: subtasks.filter(s => s.taskId === r.task.id)
      .map(s => ({ ...s, done: ticked.has(`${r.entry.id}:${s.id}`) })),
  }));
}

function selectEntries(tx: Tx | typeof db) {
  return tx.select({ entry: todoEntriesTable, task: todoTasksTable })
    .from(todoEntriesTable)
    .innerJoin(todoTasksTable, eq(todoTasksTable.id, todoEntriesTable.taskId));
}

function getEntry(tx: Tx | typeof db, id: number): EntryWithTask | undefined {
  const row = selectEntries(tx).where(eq(todoEntriesTable.id, id)).get();
  return row && withSubtasks(tx, [row])[0];
}

export function listEntries(opts: {
  date?: string; listId?: number; projectId?: number; includeEarlierDone?: boolean;
}): EntryWithTask[] {
  const date = opts.date ?? todayStr();
  const filters = [
    opts.listId != null ? eq(todoEntriesTable.listId, opts.listId) : undefined,
    opts.projectId != null ? eq(todoTasksTable.projectId, opts.projectId) : undefined,
  ];
  const order = [asc(todoTasksTable.sortOrder), asc(todoTasksTable.createdAt)];

  const rows = selectEntries(db).where(and(eq(todoEntriesTable.date, date), ...filters)).orderBy(...order).all();
  if (!opts.includeEarlierDone) return withSubtasks(db, rows);

  // The To-Do view also keeps showing earlier days' completed entries until
  // they're cleared, for lists that don't auto-clear. Repeat lists are
  // excluded: today already has its own copy of every task.
  const keepDoneLists = db.select({ id: todoListsTable.id }).from(todoListsTable)
    .where(and(eq(todoListsTable.autoClearCompleted, false), ne(todoListsTable.carryMode, "repeat")))
    .all().map(l => l.id);
  if (keepDoneLists.length === 0) return withSubtasks(db, rows);
  const earlierDone = selectEntries(db).where(and(
    lt(todoEntriesTable.date, date),
    eq(todoEntriesTable.status, "done"),
    isNull(todoEntriesTable.clearedAt),
    inArray(todoEntriesTable.listId, keepDoneLists),
    ...filters,
  )).orderBy(...order).all();
  return withSubtasks(db, [...rows, ...earlierDone]);
}

export function daySummary(startDate: string, endDate: string) {
  const done = sql<number>`sum(case when ${todoEntriesTable.status} = 'done' then 1 else 0 end)`;
  const rows = db.select({
    date: todoEntriesTable.date,
    listId: todoEntriesTable.listId,
    total: count(),
    done,
  }).from(todoEntriesTable)
    .where(and(gte(todoEntriesTable.date, startDate), lte(todoEntriesTable.date, endDate)))
    .groupBy(todoEntriesTable.date, todoEntriesTable.listId)
    .all();
  return rows.map(r => ({
    date: r.date,
    listId: r.listId,
    totalTasks: r.total,
    completedTasks: r.done,
    pendingTasks: r.total - r.done,
    percentage: Math.round((r.done / r.total) * 100),
  }));
}

// ─── writes ────────────────────────────────────────────────────────────────────

export function createEntry(input: {
  listId: number; text: string; date?: string;
  projectId?: number; subprojectId?: number; reminderTime?: string;
}): EntryWithTask | null {
  const today = todayStr();
  const date = input.date ?? today;
  return db.transaction(tx => {
    const list = tx.select().from(todoListsTable).where(eq(todoListsTable.id, input.listId)).get();
    if (!list) return null;
    const task = tx.insert(todoTasksTable).values({
      listId: list.id,
      text: input.text,
      projectId: input.projectId ?? null,
      subprojectId: input.subprojectId ?? null,
      reminderTime: input.reminderTime ?? null,
      sortOrder: 0,
    }).returning().get();
    const entry = tx.insert(todoEntriesTable)
      .values({ taskId: task.id, listId: list.id, date, status: "pending" })
      .returning().get();
    if (date < today) {
      if (list.carryMode === "carry") carryForward(tx, entry, today);
      else if (list.carryMode === "repeat") repeatForward(tx, entry, today);
    }
    return { entry, task, subtasks: [] };
  });
}

export function setEntryStatus(id: number, status: EntryStatus): EntryWithTask | null {
  const today = todayStr();
  return db.transaction(tx => {
    const current = tx.select().from(todoEntriesTable).where(eq(todoEntriesTable.id, id)).get();
    if (!current) return null;

    if (status === "done") {
      tx.update(todoEntriesTable).set({ status: "done", completedAt: current.completedAt ?? new Date() })
        .where(eq(todoEntriesTable.id, id)).run();
      // Late correction: the task was done that day, so the copies carried
      // from it (and their own copies, via cascade) never should have existed.
      tx.delete(todoEntriesTable).where(eq(todoEntriesTable.copiedFromEntryId, id)).run();
    } else {
      const updated = tx.update(todoEntriesTable).set({ status: "pending", completedAt: null, clearedAt: null })
        .where(eq(todoEntriesTable.id, id)).returning().get();
      const list = tx.select().from(todoListsTable).where(eq(todoListsTable.id, current.listId)).get();
      if (list?.carryMode === "carry" && updated.date < today) {
        const hasCopy = tx.select({ id: todoEntriesTable.id }).from(todoEntriesTable)
          .where(eq(todoEntriesTable.copiedFromEntryId, id)).get();
        if (!hasCopy) carryForward(tx, updated, today);
      }
    }
    return getEntry(tx, id) ?? null;
  });
}

export function deleteEntry(id: number): boolean {
  return db.transaction(tx => {
    const entry = tx.delete(todoEntriesTable).where(eq(todoEntriesTable.id, id)).returning().get();
    if (!entry) return false;
    // A task with no entries left on any day no longer exists anywhere.
    const remaining = tx.select({ id: todoEntriesTable.id }).from(todoEntriesTable)
      .where(eq(todoEntriesTable.taskId, entry.taskId)).get();
    if (!remaining) tx.delete(todoTasksTable).where(eq(todoTasksTable.id, entry.taskId)).run();
    return true;
  });
}

export function updateTask(id: number, updates: Partial<typeof todoTasksTable.$inferInsert>): TodoTask | null {
  const today = todayStr();
  return db.transaction(tx => {
    const task = tx.update(todoTasksTable).set(updates).where(eq(todoTasksTable.id, id)).returning().get();
    if (!task) return null;
    // Moving lists moves today's and future entries; past days keep the list they were on.
    if (updates.listId !== undefined) {
      tx.update(todoEntriesTable).set({ listId: updates.listId })
        .where(and(eq(todoEntriesTable.taskId, id), gte(todoEntriesTable.date, today))).run();
    }
    return task;
  });
}

export function clearCompleted(listId: number): number {
  return db.update(todoEntriesTable).set({ clearedAt: new Date() })
    .where(and(
      eq(todoEntriesTable.listId, listId),
      eq(todoEntriesTable.status, "done"),
      isNull(todoEntriesTable.clearedAt),
      lte(todoEntriesTable.date, todayStr()),
    ))
    .returning({ id: todoEntriesTable.id }).all().length;
}

// ─── subtasks ──────────────────────────────────────────────────────────────────

export function createSubtask(taskId: number, input: { text: string; sortOrder?: number }): TodoSubtask | null {
  return db.transaction(tx => {
    const task = tx.select({ id: todoTasksTable.id }).from(todoTasksTable).where(eq(todoTasksTable.id, taskId)).get();
    if (!task) return null;
    // New subtasks go to the bottom unless placed explicitly.
    const last = tx.select({ max: sql<number | null>`max(${todoSubtasksTable.sortOrder})` })
      .from(todoSubtasksTable).where(eq(todoSubtasksTable.taskId, taskId)).get();
    return tx.insert(todoSubtasksTable).values({
      taskId, text: input.text, sortOrder: input.sortOrder ?? (last?.max ?? -1) + 1,
    }).returning().get();
  });
}

export function updateSubtask(id: number, updates: { text?: string; sortOrder?: number }): TodoSubtask | null {
  return db.update(todoSubtasksTable).set(updates).where(eq(todoSubtasksTable.id, id)).returning().get() ?? null;
}

export function deleteSubtask(id: number): boolean {
  return db.delete(todoSubtasksTable).where(eq(todoSubtasksTable.id, id)).returning().get() != null;
}

// Ticks/unticks a subtask on one day's entry only; other days keep their own ticks.
export function setSubtaskDone(entryId: number, subtaskId: number, done: boolean): EntryWithTask | null {
  return db.transaction(tx => {
    const entry = tx.select().from(todoEntriesTable).where(eq(todoEntriesTable.id, entryId)).get();
    const subtask = tx.select().from(todoSubtasksTable).where(eq(todoSubtasksTable.id, subtaskId)).get();
    if (!entry || !subtask || subtask.taskId !== entry.taskId) return null;
    if (done) {
      tx.insert(todoSubtaskChecksTable).values({ subtaskId, entryId }).onConflictDoNothing().run();
    } else {
      tx.delete(todoSubtaskChecksTable).where(and(
        eq(todoSubtaskChecksTable.subtaskId, subtaskId), eq(todoSubtaskChecksTable.entryId, entryId),
      )).run();
    }
    return getEntry(tx, entryId) ?? null;
  });
}
