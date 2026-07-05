import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
  resetDaily: integer("reset_daily", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const todoTasksTable = sqliteTable("todo_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id")
    .notNull()
    .references(() => todoListsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  subprojectId: integer("subproject_id").references(() => subprojectsTable.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  completedDate: text("completed_date"), // YYYY-MM-DD; for daily-reset tracking
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const insertTodoListSchema = createInsertSchema(todoListsTable).omit({ id: true, createdAt: true });
export const insertTodoTaskSchema = createInsertSchema(todoTasksTable).omit({ id: true, createdAt: true });

export type TodoList = typeof todoListsTable.$inferSelect;
export type TodoTask = typeof todoTasksTable.$inferSelect;
export type InsertTodoList = z.infer<typeof insertTodoListSchema>;
export type InsertTodoTask = z.infer<typeof insertTodoTaskSchema>;
