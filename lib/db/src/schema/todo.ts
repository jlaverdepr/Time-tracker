import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const todoListsTable = pgTable("todo_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  letter: text("letter").notNull(), // single uppercase char shown in badges
  resetDaily: boolean("reset_daily").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const todoTasksTable = pgTable("todo_tasks", {
  id: serial("id").primaryKey(),
  listId: integer("list_id")
    .notNull()
    .references(() => todoListsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedDate: text("completed_date"), // YYYY-MM-DD; for daily-reset tracking
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTodoListSchema = createInsertSchema(todoListsTable).omit({ id: true, createdAt: true });
export const insertTodoTaskSchema = createInsertSchema(todoTasksTable).omit({ id: true, createdAt: true });

export type TodoList = typeof todoListsTable.$inferSelect;
export type TodoTask = typeof todoTasksTable.$inferSelect;
export type InsertTodoList = z.infer<typeof insertTodoListSchema>;
export type InsertTodoTask = z.infer<typeof insertTodoTaskSchema>;
