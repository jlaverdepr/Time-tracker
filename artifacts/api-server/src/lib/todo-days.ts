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
//
// All multi-step mutations run inside one synchronous better-sqlite3
// transaction, so concurrent requests can't interleave mid-update.
import { db } from "@workspace/db";
import { todoListsTable, todoTasksTable, todoEntriesTable } from "@workspace/db/schema";
import type { TodoEntry, TodoList, TodoTask } from "@workspace/db/schema";
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
        tx.insert(todoEntriesTable).values(
          list.carryMode === "carry"
            ? { taskId: e.taskId, listId: list.id, date, status: "pending", copiedFromDate: prevDate, copiedFromEntryId: e.id }
            : { taskId: e.taskId, listId: list.id, date, status: "pending" },
        ).onConflictDoNothing().run();
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
    prev = tx.insert(todoEntriesTable).values({
      taskId: from.taskId, listId: from.listId, date, status: "pending",
      copiedFromDate: prev.date, copiedFromEntryId: prev.id,
    }).returning().get();
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

export type EntryWithTask = { entry: TodoEntry; task: TodoTask };

export function serializeEntry({ entry, task }: EntryWithTask) {
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
  };
}

function selectEntries(tx: Tx | typeof db) {
  return tx.select({ entry: todoEntriesTable, task: todoTasksTable })
    .from(todoEntriesTable)
    .innerJoin(todoTasksTable, eq(todoTasksTable.id, todoEntriesTable.taskId));
}

function getEntry(tx: Tx | typeof db, id: number): EntryWithTask | undefined {
  return selectEntries(tx).where(eq(todoEntriesTable.id, id)).get();
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
  if (!opts.includeEarlierDone) return rows;

  // The To-Do view also keeps showing earlier days' completed entries until
  // they're cleared, for lists that don't auto-clear. Repeat lists are
  // excluded: today already has its own copy of every task.
  const keepDoneLists = db.select({ id: todoListsTable.id }).from(todoListsTable)
    .where(and(eq(todoListsTable.autoClearCompleted, false), ne(todoListsTable.carryMode, "repeat")))
    .all().map(l => l.id);
  if (keepDoneLists.length === 0) return rows;
  const earlierDone = selectEntries(db).where(and(
    lt(todoEntriesTable.date, date),
    eq(todoEntriesTable.status, "done"),
    isNull(todoEntriesTable.clearedAt),
    inArray(todoEntriesTable.listId, keepDoneLists),
    ...filters,
  )).orderBy(...order).all();
  return [...rows, ...earlierDone];
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
    return { entry, task };
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
