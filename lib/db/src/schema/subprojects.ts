import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const subprojectsTable = pgTable("subprojects", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"), // optional; inherits parent project color if null
  status: text("status").notNull().default("active"), // 'active' | 'completed'
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubprojectSchema = createInsertSchema(subprojectsTable).omit({ id: true, createdAt: true });
export type InsertSubproject = z.infer<typeof insertSubprojectSchema>;
export type Subproject = typeof subprojectsTable.$inferSelect;
