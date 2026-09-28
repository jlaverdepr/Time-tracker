import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gymExercisesTable = sqliteTable("gym_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // 'Upper Body' | 'Lower Body' | 'Full Body' | 'Core' | 'Minor'
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymWorkoutsTable = sqliteTable("gym_workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  title: text("title"), // 'Chest' | 'Legs' | 'Back' | free text (from "Other")
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymWorkoutEntriesTable = sqliteTable("gym_workout_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => gymWorkoutsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => gymExercisesTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymWorkoutSetsTable = sqliteTable("gym_workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id")
    .notNull()
    .references(() => gymWorkoutEntriesTable.id, { onDelete: "cascade" }),
  isWarmup: integer("is_warmup", { mode: "boolean" }).notNull().default(false),
  setIndex: integer("set_index").notNull(), // 1-5, position within its group (main or warmup)
  reps: integer("reps"),
  weight: real("weight"),
  failure: integer("failure", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymRunsTable = sqliteTable("gym_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  distanceKm: real("distance_km"),
  durationMinutes: integer("duration_minutes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymBodyWeightLogsTable = sqliteTable("gym_body_weight_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  weightKg: real("weight_kg").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymWorkoutTemplatesTable = sqliteTable("gym_workout_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const gymWorkoutTemplateExercisesTable = sqliteTable("gym_workout_template_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateId: integer("template_id")
    .notNull()
    .references(() => gymWorkoutTemplatesTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => gymExercisesTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertGymExerciseSchema = createInsertSchema(gymExercisesTable).omit({ id: true, createdAt: true });
export const insertGymWorkoutSchema = createInsertSchema(gymWorkoutsTable).omit({ id: true, createdAt: true });
export const insertGymWorkoutEntrySchema = createInsertSchema(gymWorkoutEntriesTable).omit({ id: true, createdAt: true });
export const insertGymWorkoutSetSchema = createInsertSchema(gymWorkoutSetsTable).omit({ id: true, createdAt: true });
export const insertGymRunSchema = createInsertSchema(gymRunsTable).omit({ id: true, createdAt: true });
export const insertGymBodyWeightLogSchema = createInsertSchema(gymBodyWeightLogsTable).omit({ id: true, createdAt: true });
export const insertGymWorkoutTemplateSchema = createInsertSchema(gymWorkoutTemplatesTable).omit({ id: true, createdAt: true });
export const insertGymWorkoutTemplateExerciseSchema = createInsertSchema(gymWorkoutTemplateExercisesTable).omit({ id: true });

export type GymExercise = typeof gymExercisesTable.$inferSelect;
export type GymWorkout = typeof gymWorkoutsTable.$inferSelect;
export type GymWorkoutEntry = typeof gymWorkoutEntriesTable.$inferSelect;
export type GymWorkoutSet = typeof gymWorkoutSetsTable.$inferSelect;
export type GymRun = typeof gymRunsTable.$inferSelect;
export type GymBodyWeightLog = typeof gymBodyWeightLogsTable.$inferSelect;
export type GymWorkoutTemplate = typeof gymWorkoutTemplatesTable.$inferSelect;
export type GymWorkoutTemplateExercise = typeof gymWorkoutTemplateExercisesTable.$inferSelect;
export type InsertGymExercise = z.infer<typeof insertGymExerciseSchema>;
export type InsertGymWorkout = z.infer<typeof insertGymWorkoutSchema>;
export type InsertGymWorkoutEntry = z.infer<typeof insertGymWorkoutEntrySchema>;
export type InsertGymWorkoutSet = z.infer<typeof insertGymWorkoutSetSchema>;
export type InsertGymRun = z.infer<typeof insertGymRunSchema>;
export type InsertGymBodyWeightLog = z.infer<typeof insertGymBodyWeightLogSchema>;
export type InsertGymWorkoutTemplate = z.infer<typeof insertGymWorkoutTemplateSchema>;
export type InsertGymWorkoutTemplateExercise = z.infer<typeof insertGymWorkoutTemplateExerciseSchema>;
