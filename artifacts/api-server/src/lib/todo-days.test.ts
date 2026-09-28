// Scenario tests for the day-entry engine. Run with `pnpm --filter @workspace/api-server test`.
// Uses a throwaway SQLite file (DB_PATH, set by test.mjs) migrated from lib/db/drizzle,
// and a fake clock so days can pass.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { todoListsTable, todoEntriesTable } from "@workspace/db/schema";
import {
  ensureRolledOver, listEntries, daySummary, createEntry, setEntryStatus,
  deleteEntry, updateTask, clearCompleted,
} from "./todo-days";

const MIGRATIONS = path.resolve(process.cwd(), "../../lib/db/drizzle");

// ── fake clock ────────────────────────────────────────────────────────────────
const RealDate = Date;
let now = new RealDate("2026-09-01T12:00:00").getTime();
globalThis.Date = class extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(now);
    else super(...(args as [string]));
  }
  static now() { return now; }
} as DateConstructor;
function setDay(date: string) {
  now = new RealDate(`${date}T12:00:00`).getTime();
  ensureRolledOver(); // what the router does before every to-do request
}

// ── helpers ───────────────────────────────────────────────────────────────────
function newList(name: string, carryMode: "carry" | "repeat" | "none", autoClearCompleted = false) {
  const today = new Date().toISOString().slice(0, 10);
  return db.insert(todoListsTable)
    .values({ name, color: "#000", letter: name[0], carryMode, autoClearCompleted, lastRolledDate: today })
    .returning().get();
}
function entriesOf(taskId: number) {
  return db.select().from(todoEntriesTable).where(eq(todoEntriesTable.taskId, taskId)).all()
    .sort((a, b) => a.date.localeCompare(b.date));
}
function days(taskId: number) {
  return entriesOf(taskId).map(e => `${e.date}:${e.status}${e.copiedFromDate ? `<${e.copiedFromDate}` : ""}`);
}
function summaryFor(listId: number, from: string, to: string) {
  return Object.fromEntries(daySummary(from, to).filter(s => s.listId === listId).map(s => [s.date, `${s.completedTasks}/${s.totalTasks}`]));
}

before(() => { migrate(db, { migrationsFolder: MIGRATIONS }); });

// ── carry lists ───────────────────────────────────────────────────────────────
test("carry: pending entries are copied to each new day, linked to the day before", () => {
  setDay("2026-09-01");
  const list = newList("Carry", "carry");
  const a = createEntry({ listId: list.id, text: "A" })!;
  setDay("2026-09-03");
  assert.deepEqual(days(a.task.id), [
    "2026-09-01:pending", "2026-09-02:pending<2026-09-01", "2026-09-03:pending<2026-09-02",
  ]);
  assert.deepEqual(summaryFor(list.id, "2026-09-01", "2026-09-30"), {
    "2026-09-01": "0/1", "2026-09-02": "0/1", "2026-09-03": "0/1",
  });
});

test("carry: completing a past entry deletes the whole chain of copies after it", () => {
  setDay("2026-09-10");
  const list = newList("Correct", "carry");
  const a = createEntry({ listId: list.id, text: "A" })!;
  setDay("2026-09-13");
  const first = entriesOf(a.task.id)[0];
  setEntryStatus(first.id, "done");
  assert.deepEqual(days(a.task.id), ["2026-09-10:done"]);
  assert.deepEqual(summaryFor(list.id, "2026-09-01", "2026-09-30"), { "2026-09-10": "1/1" });
});

test("carry: un-completing a past entry re-copies it forward to today", () => {
  setDay("2026-09-20");
  const list = newList("Uncomplete", "carry");
  const a = createEntry({ listId: list.id, text: "A" })!;
  setEntryStatus(a.entry.id, "done");
  setDay("2026-09-22");
  assert.deepEqual(days(a.task.id), ["2026-09-20:done"], "done entries are not carried");
  setEntryStatus(a.entry.id, "pending");
  assert.deepEqual(days(a.task.id), [
    "2026-09-20:pending", "2026-09-21:pending<2026-09-20", "2026-09-22:pending<2026-09-21",
  ]);
  // Completing the middle copy keeps the earlier day pending and removes later copies.
  setEntryStatus(entriesOf(a.task.id)[1].id, "done");
  assert.deepEqual(days(a.task.id), ["2026-09-20:pending", "2026-09-21:done<2026-09-20"]);
  assert.deepEqual(summaryFor(list.id, "2026-09-01", "2026-09-30"), { "2026-09-20": "0/1", "2026-09-21": "1/1" });
});

test("carry: deleting an entry deletes the copies made from it; last entry deletes the task", () => {
  setDay("2026-10-01");
  const list = newList("Delete", "carry");
  const a = createEntry({ listId: list.id, text: "A" })!;
  setDay("2026-10-03");
  const [, second] = entriesOf(a.task.id);
  deleteEntry(second.id);
  assert.deepEqual(days(a.task.id), ["2026-10-01:pending"]);
  deleteEntry(entriesOf(a.task.id)[0].id);
  assert.deepEqual(entriesOf(a.task.id), []);
});

test("carry: a task added on a past day is carried forward to today", () => {
  setDay("2026-10-10");
  const list = newList("Backdate", "carry");
  const a = createEntry({ listId: list.id, text: "A", date: "2026-10-08" })!;
  assert.deepEqual(days(a.task.id), [
    "2026-10-08:pending", "2026-10-09:pending<2026-10-08", "2026-10-10:pending<2026-10-09",
  ]);
});

test("carry: tasks scheduled ahead only exist on their day until it arrives", () => {
  setDay("2026-10-15");
  const list = newList("Ahead", "carry");
  const a = createEntry({ listId: list.id, text: "A", date: "2026-10-17" })!;
  assert.deepEqual(summaryFor(list.id, "2026-10-01", "2026-10-31"), { "2026-10-17": "0/1" });
  setDay("2026-10-18");
  assert.deepEqual(days(a.task.id), ["2026-10-17:pending", "2026-10-18:pending<2026-10-17"]);
});

// ── repeat / none lists ───────────────────────────────────────────────────────
test("repeat: every task comes back each day as an independent pending entry", () => {
  setDay("2026-11-01");
  const list = newList("Repeat", "repeat");
  const a = createEntry({ listId: list.id, text: "A" })!;
  setEntryStatus(a.entry.id, "done");
  setDay("2026-11-03");
  assert.deepEqual(days(a.task.id), ["2026-11-01:done", "2026-11-02:pending", "2026-11-03:pending"]);
  // Corrections on one day never touch the others.
  setEntryStatus(entriesOf(a.task.id)[1].id, "done");
  setEntryStatus(entriesOf(a.task.id)[0].id, "pending");
  assert.deepEqual(days(a.task.id), ["2026-11-01:pending", "2026-11-02:done", "2026-11-03:pending"]);
});

test("none: nothing is copied to a new day", () => {
  setDay("2026-11-10");
  const list = newList("None", "none");
  const a = createEntry({ listId: list.id, text: "A" })!;
  setDay("2026-11-12");
  assert.deepEqual(days(a.task.id), ["2026-11-10:pending"]);
});

// ── To-Do view ────────────────────────────────────────────────────────────────
test("To-Do view: earlier completed entries show until cleared, unless the list auto-clears", () => {
  setDay("2026-12-01");
  const keep = newList("Keep", "carry", false);
  const auto = newList("Auto", "carry", true);
  const k = createEntry({ listId: keep.id, text: "K" })!;
  const x = createEntry({ listId: auto.id, text: "X" })!;
  setEntryStatus(k.entry.id, "done");
  setEntryStatus(x.entry.id, "done");
  setDay("2026-12-02");
  const view = () => listEntries({ includeEarlierDone: true }).filter(e => [keep.id, auto.id].includes(e.entry.listId));
  assert.deepEqual(view().map(e => e.task.text), ["K"]);
  clearCompleted(keep.id);
  assert.deepEqual(view(), []);
  // Clearing only hides; history and percentages are unchanged.
  assert.deepEqual(summaryFor(keep.id, "2026-12-01", "2026-12-31"), { "2026-12-01": "1/1" });
});

test("moving a task to another list moves today's entry but not history", () => {
  setDay("2026-12-10");
  const from = newList("From", "carry");
  const to = newList("To", "carry");
  const a = createEntry({ listId: from.id, text: "A" })!;
  setDay("2026-12-11");
  updateTask(a.task.id, { listId: to.id });
  assert.deepEqual(entriesOf(a.task.id).map(e => [e.date, e.listId]), [["2026-12-10", from.id], ["2026-12-11", to.id]]);
  setDay("2026-12-12");
  assert.deepEqual(entriesOf(a.task.id).map(e => [e.date, e.listId]).at(-1), ["2026-12-12", to.id]);
});

// ── data migration from the old model ─────────────────────────────────────────
test("migration 0011 converts the old active log + completions into day entries", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "todo-mig-"));
  // Migrations folder truncated to before the rework, to seed old-model data.
  const oldDir = path.join(dir, "old");
  mkdirSync(path.join(oldDir, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf-8"));
  const reworkIdx = journal.entries.findIndex((e: { tag: string }) => e.tag.startsWith("0011_"));
  for (const f of readdirSync(MIGRATIONS).filter(f => f.endsWith(".sql"))) {
    copyFileSync(path.join(MIGRATIONS, f), path.join(oldDir, f));
  }
  writeFileSync(path.join(oldDir, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, reworkIdx) }));

  const sqlite = new Database(path.join(dir, "db.sqlite"));
  sqlite.pragma("foreign_keys = ON");
  const oldDb = drizzle(sqlite);
  migrate(oldDb, { migrationsFolder: oldDir });
  sqlite.exec(`
    INSERT INTO todo_lists (id, name, color, letter, reset_daily) VALUES (1, 'Work', '#000', 'W', 0), (2, 'Daily', '#000', 'D', 1);
    INSERT INTO todo_tasks (id, list_id, text, scheduled_date) VALUES (1, 1, 'carried', NULL), (2, 2, 'habit', NULL), (3, 1, 'future', '2099-01-01');
    -- task 1 active Mon..Wed, done Wed; task 2 active Mon..Tue, done Mon
    INSERT INTO todo_active_log (task_id, date) VALUES
      (1, '2026-01-05'), (1, '2026-01-06'), (1, '2026-01-07'), (2, '2026-01-05'), (2, '2026-01-06');
    INSERT INTO todo_task_completions (task_id, date) VALUES (1, '2026-01-07'), (2, '2026-01-05');
  `);
  migrate(oldDb, { migrationsFolder: MIGRATIONS });

  const rows = sqlite.prepare(`
    SELECT e.task_id, e.date, e.status, e.copied_from_date, p.date AS parent_date
    FROM todo_entries e LEFT JOIN todo_entries p ON p.id = e.copied_from_entry_id ORDER BY e.task_id, e.date
  `).all();
  assert.deepEqual(rows, [
    { task_id: 1, date: "2026-01-05", status: "pending", copied_from_date: null, parent_date: null },
    { task_id: 1, date: "2026-01-06", status: "pending", copied_from_date: "2026-01-05", parent_date: "2026-01-05" },
    { task_id: 1, date: "2026-01-07", status: "done", copied_from_date: "2026-01-06", parent_date: "2026-01-06" },
    { task_id: 2, date: "2026-01-05", status: "done", copied_from_date: null, parent_date: null },
    { task_id: 2, date: "2026-01-06", status: "pending", copied_from_date: null, parent_date: null },
    { task_id: 3, date: "2099-01-01", status: "pending", copied_from_date: null, parent_date: null },
  ]);
  assert.deepEqual(
    sqlite.prepare("SELECT id, carry_mode, last_rolled_date FROM todo_lists ORDER BY id").all(),
    [{ id: 1, carry_mode: "carry", last_rolled_date: "2026-01-07" }, { id: 2, carry_mode: "repeat", last_rolled_date: "2026-01-06" }],
  );
  sqlite.close();
});
