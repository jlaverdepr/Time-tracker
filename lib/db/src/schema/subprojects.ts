import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const subprojectsTable = sqliteTable("subprojects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"), // optional; inherits parent project color if null
  status: text("status").notNull().default("active"), // 'active' | 'completed'
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const insertSubprojectSchema = createInsertSchema(subprojectsTable).omit({ id: true, createdAt: true });
export type InsertSubproject = z.infer<typeof insertSubprojectSchema>;
export type Subproject = typeof subprojectsTable.$inferSelect;
