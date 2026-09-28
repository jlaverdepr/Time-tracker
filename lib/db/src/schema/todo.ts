import { sqliteTable, text, integer, uniqueIndex, index, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { subprojectsTable } from "./subprojects";

export const todoListsTable = sqliteTable("todo_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  letter: text("letter").notNull(), // single uppercase char shown in badges
  autoClearCompleted: integer("auto_clear_completed", { mode: "boolean" }).notNull().default(false),
  // 'carry' | 'repeat' | 'none' — what the day rollover does with this list's entries
  carryMode: text("carry_mode").notNull().default("carry"),
  // Last date the rollover has materialized entries up to (YYYY-MM-DD)
  lastRolledDate: text("last_rolled_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// What a task is (text, project link, reminder, order); its per-day state lives in todoEntriesTable.
export const todoTasksTable = sqliteTable("todo_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id")
    .notNull()
    .references(() => todoListsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  subprojectId: integer("subproject_id").references(() => subprojectsTable.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  reminderTime: text("reminder_time"), // HH:mm; opt-in per-task reminder
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// One row per task per calendar day: the "day entries". A day's to-do state is
// exactly the set of entries with that date — percentages, calendar icons and
// history are all read from here, never reconstructed.
export const todoEntriesTable = sqliteTable("todo_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => todoTasksTable.id, { onDelete: "cascade" }),
  // The list the task belonged to on this day (history stays put if the task moves lists later)
  listId: integer("list_id")
    .notNull()
    .references(() => todoListsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  status: text("status").notNull().default("pending"), // 'pending' | 'done'
  // Set when the rollover carried this entry over from a previous day's pending entry
  copiedFromDate: text("copied_from_date"),
  // The entry it was carried from; deleting/completing that entry removes this copy (and its own copies)
  copiedFromEntryId: integer("copied_from_entry_id")
    .references((): AnySQLiteColumn => todoEntriesTable.id, { onDelete: "cascade" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  clearedAt: integer("cleared_at", { mode: "timestamp" }), // hidden from the To-Do view; still counts in history
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("todo_entries_task_date_idx").on(table.taskId, table.date),
  index("todo_entries_date_idx").on(table.date),
  index("todo_entries_copied_from_idx").on(table.copiedFromEntryId),
]);

export const insertTodoListSchema = createInsertSchema(todoListsTable).omit({ id: true, createdAt: true });
export const insertTodoTaskSchema = createInsertSchema(todoTasksTable).omit({ id: true, createdAt: true });
export const insertTodoEntrySchema = createInsertSchema(todoEntriesTable).omit({ id: true, createdAt: true });

export type TodoList = typeof todoListsTable.$inferSelect;
export type TodoTask = typeof todoTasksTable.$inferSelect;
export type TodoEntry = typeof todoEntriesTable.$inferSelect;
export type InsertTodoList = z.infer<typeof insertTodoListSchema>;
export type InsertTodoTask = z.infer<typeof insertTodoTaskSchema>;
export type InsertTodoEntry = z.infer<typeof insertTodoEntrySchema>;
