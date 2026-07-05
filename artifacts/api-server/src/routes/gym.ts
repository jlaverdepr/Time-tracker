import { Router } from "express";
import { db } from "@workspace/db";
import {
  gymExercisesTable, gymWorkoutsTable, gymWorkoutEntriesTable, gymWorkoutSetsTable,
  gymRunsTable, gymWorkoutTemplatesTable, gymWorkoutTemplateExercisesTable,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { format } from "date-fns";
import {
  CreateGymExerciseBody, UpdateGymExerciseParams, UpdateGymExerciseBody, DeleteGymExerciseParams,
  CreateGymWorkoutBody, UpdateGymWorkoutParams, UpdateGymWorkoutBody, DeleteGymWorkoutParams,
  ListGymWorkoutEntriesQueryParams, CreateGymWorkoutEntryBody, DeleteGymWorkoutEntryParams,
  ListGymWorkoutSetsQueryParams, CreateGymWorkoutSetBody,
  UpdateGymWorkoutSetParams, UpdateGymWorkoutSetBody, DeleteGymWorkoutSetParams,
  CreateGymRunBody, UpdateGymRunParams, UpdateGymRunBody, DeleteGymRunParams,
  CreateGymWorkoutTemplateBody, DeleteGymWorkoutTemplateParams,
  ListGymExercisesResponse, CreateGymExerciseResponse, UpdateGymExerciseResponse,
  ListGymWorkoutsResponse, CreateGymWorkoutResponse, UpdateGymWorkoutResponse,
  ListGymWorkoutEntriesResponse, CreateGymWorkoutEntryResponse,
  ListGymWorkoutSetsResponse, CreateGymWorkoutSetResponse, UpdateGymWorkoutSetResponse,
  ListGymRunsResponse, CreateGymRunResponse, UpdateGymRunResponse,
  ListGymWorkoutTemplatesResponse, CreateGymWorkoutTemplateResponse,
} from "@workspace/api-zod";
import type {
  GymExercise, GymWorkout, GymWorkoutEntry, GymWorkoutSet, GymRun, GymWorkoutTemplate,
} from "@workspace/db/schema";

const router = Router();

// ─── serializers ───────────────────────────────────────────────────────────────

function serializeExercise(row: GymExercise) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeWorkout(row: GymWorkout) {
  return {
    id: row.id,
    date: row.date,
    title: row.title ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeEntry(row: GymWorkoutEntry) {
  return {
    id: row.id,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeSet(row: GymWorkoutSet) {
  return {
    id: row.id,
    entryId: row.entryId,
    isWarmup: row.isWarmup,
    setIndex: row.setIndex,
    reps: row.reps ?? null,
    weight: row.weight ?? null,
    failure: row.failure,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeRun(row: GymRun) {
  return {
    id: row.id,
    date: row.date,
    distanceKm: row.distanceKm ?? null,
    durationMinutes: row.durationMinutes ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeTemplate(row: GymWorkoutTemplate, exerciseIds: number[]) {
  return {
    id: row.id,
    name: row.name,
    exerciseIds,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── exercises ──────────────────────────────────────────────────────────────────

router.get("/gym-exercises", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gymExercisesTable).orderBy(gymExercisesTable.name);
  res.json(ListGymExercisesResponse.parse(rows.map(serializeExercise)));
});

router.post("/gym-exercises", async (req, res): Promise<void> => {
  const parsed = CreateGymExerciseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(gymExercisesTable).values({
    name: parsed.data.name,
    category: parsed.data.category,
  }).returning();
  res.status(201).json(CreateGymExerciseResponse.parse(serializeExercise(row)));
});

router.patch("/gym-exercises/:id", async (req, res): Promise<void> => {
  const params = UpdateGymExerciseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGymExerciseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof gymExercisesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [row] = await db.update(gymExercisesTable).set(updates).where(eq(gymExercisesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Exercise not found" }); return; }
  res.json(UpdateGymExerciseResponse.parse(serializeExercise(row)));
});

router.delete("/gym-exercises/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGymExerciseParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(gymExercisesTable).where(eq(gymExercisesTable.id, parsed.data.id));
  res.status(204).send();
});

// ─── workouts ───────────────────────────────────────────────────────────────────

router.get("/gym-workouts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gymWorkoutsTable).orderBy(gymWorkoutsTable.date, gymWorkoutsTable.createdAt);
  res.json(ListGymWorkoutsResponse.parse(rows.map(serializeWorkout)));
});

router.post("/gym-workouts", async (req, res): Promise<void> => {
  const parsed = CreateGymWorkoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(gymWorkoutsTable).values({
    date: parsed.data.date ?? format(new Date(), "yyyy-MM-dd"),
    title: parsed.data.title ?? null,
  }).returning();
  res.status(201).json(CreateGymWorkoutResponse.parse(serializeWorkout(row)));
});

router.patch("/gym-workouts/:id", async (req, res): Promise<void> => {
  const params = UpdateGymWorkoutParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGymWorkoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof gymWorkoutsTable.$inferInsert> = {};
  if ("title" in parsed.data) updates.title = parsed.data.title ?? null;
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [row] = await db.update(gymWorkoutsTable).set(updates)
    .where(eq(gymWorkoutsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Workout not found" }); return; }
  res.json(UpdateGymWorkoutResponse.parse(serializeWorkout(row)));
});

router.delete("/gym-workouts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGymWorkoutParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(gymWorkoutsTable).where(eq(gymWorkoutsTable.id, parsed.data.id));
  res.status(204).send();
});

// ─── workout entries ────────────────────────────────────────────────────────────

router.get("/gym-workout-entries", async (req, res): Promise<void> => {
  const parsed = ListGymWorkoutEntriesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = parsed.data.workoutId
    ? await db.select().from(gymWorkoutEntriesTable)
        .where(eq(gymWorkoutEntriesTable.workoutId, parsed.data.workoutId))
        .orderBy(gymWorkoutEntriesTable.sortOrder, gymWorkoutEntriesTable.createdAt)
    : await db.select().from(gymWorkoutEntriesTable).orderBy(gymWorkoutEntriesTable.sortOrder, gymWorkoutEntriesTable.createdAt);
  res.json(ListGymWorkoutEntriesResponse.parse(rows.map(serializeEntry)));
});

router.post("/gym-workout-entries", async (req, res): Promise<void> => {
  const parsed = CreateGymWorkoutEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(gymWorkoutEntriesTable).values({
    workoutId: parsed.data.workoutId,
    exerciseId: parsed.data.exerciseId,
    sortOrder: parsed.data.sortOrder ?? 0,
  }).returning();
  // Seed one empty main set so the exercise appears with a single input field.
  await db.insert(gymWorkoutSetsTable).values({
    entryId: row.id,
    isWarmup: false,
    setIndex: 1,
  });
  res.status(201).json(CreateGymWorkoutEntryResponse.parse(serializeEntry(row)));
});

router.delete("/gym-workout-entries/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGymWorkoutEntryParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(gymWorkoutEntriesTable).where(eq(gymWorkoutEntriesTable.id, parsed.data.id));
  res.status(204).send();
});

// ─── workout sets ───────────────────────────────────────────────────────────────

router.get("/gym-workout-sets", async (req, res): Promise<void> => {
  const parsed = ListGymWorkoutSetsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = parsed.data.entryId
    ? await db.select().from(gymWorkoutSetsTable)
        .where(eq(gymWorkoutSetsTable.entryId, parsed.data.entryId))
        .orderBy(gymWorkoutSetsTable.isWarmup, gymWorkoutSetsTable.setIndex)
    : await db.select().from(gymWorkoutSetsTable).orderBy(gymWorkoutSetsTable.isWarmup, gymWorkoutSetsTable.setIndex);
  res.json(ListGymWorkoutSetsResponse.parse(rows.map(serializeSet)));
});

router.post("/gym-workout-sets", async (req, res): Promise<void> => {
  const parsed = CreateGymWorkoutSetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.setIndex < 1 || parsed.data.setIndex > 5) {
    res.status(400).json({ error: "setIndex must be between 1 and 5" });
    return;
  }
  const [row] = await db.insert(gymWorkoutSetsTable).values({
    entryId: parsed.data.entryId,
    isWarmup: parsed.data.isWarmup,
    setIndex: parsed.data.setIndex,
    reps: parsed.data.reps ?? null,
    weight: parsed.data.weight ?? null,
  }).returning();
  res.status(201).json(CreateGymWorkoutSetResponse.parse(serializeSet(row)));
});

router.patch("/gym-workout-sets/:id", async (req, res): Promise<void> => {
  const params = UpdateGymWorkoutSetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGymWorkoutSetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof gymWorkoutSetsTable.$inferInsert> = {};
  if ("reps" in parsed.data) updates.reps = parsed.data.reps ?? null;
  if ("weight" in parsed.data) updates.weight = parsed.data.weight ?? null;
  if (parsed.data.failure !== undefined) updates.failure = parsed.data.failure;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [row] = await db.update(gymWorkoutSetsTable).set(updates)
    .where(eq(gymWorkoutSetsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Set not found" }); return; }
  res.json(UpdateGymWorkoutSetResponse.parse(serializeSet(row)));
});

router.delete("/gym-workout-sets/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGymWorkoutSetParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(gymWorkoutSetsTable).where(eq(gymWorkoutSetsTable.id, parsed.data.id));
  res.status(204).send();
});

// ─── runs ───────────────────────────────────────────────────────────────────────

router.get("/gym-runs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gymRunsTable).orderBy(gymRunsTable.date, gymRunsTable.createdAt);
  res.json(ListGymRunsResponse.parse(rows.map(serializeRun)));
});

router.post("/gym-runs", async (req, res): Promise<void> => {
  const parsed = CreateGymRunBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(gymRunsTable).values({
    date: parsed.data.date ?? format(new Date(), "yyyy-MM-dd"),
    distanceKm: parsed.data.distanceKm ?? null,
    durationMinutes: parsed.data.durationMinutes ?? null,
  }).returning();
  res.status(201).json(CreateGymRunResponse.parse(serializeRun(row)));
});

router.patch("/gym-runs/:id", async (req, res): Promise<void> => {
  const params = UpdateGymRunParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGymRunBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof gymRunsTable.$inferInsert> = {};
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;
  if ("distanceKm" in parsed.data) updates.distanceKm = parsed.data.distanceKm ?? null;
  if ("durationMinutes" in parsed.data) updates.durationMinutes = parsed.data.durationMinutes ?? null;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [row] = await db.update(gymRunsTable).set(updates).where(eq(gymRunsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Run not found" }); return; }
  res.json(UpdateGymRunResponse.parse(serializeRun(row)));
});

router.delete("/gym-runs/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGymRunParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(gymRunsTable).where(eq(gymRunsTable.id, parsed.data.id));
  res.status(204).send();
});

// ─── workout templates ──────────────────────────────────────────────────────────

router.get("/gym-workout-templates", async (_req, res): Promise<void> => {
  const [templates, templateExercises] = await Promise.all([
    db.select().from(gymWorkoutTemplatesTable).orderBy(gymWorkoutTemplatesTable.name),
    db.select().from(gymWorkoutTemplateExercisesTable).orderBy(asc(gymWorkoutTemplateExercisesTable.sortOrder)),
  ]);
  const exerciseIdsByTemplate = new Map<number, number[]>();
  for (const te of templateExercises) {
    if (!exerciseIdsByTemplate.has(te.templateId)) exerciseIdsByTemplate.set(te.templateId, []);
    exerciseIdsByTemplate.get(te.templateId)!.push(te.exerciseId);
  }
  res.json(ListGymWorkoutTemplatesResponse.parse(
    templates.map(t => serializeTemplate(t, exerciseIdsByTemplate.get(t.id) ?? [])),
  ));
});

router.post("/gym-workout-templates", async (req, res): Promise<void> => {
  const parsed = CreateGymWorkoutTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(gymWorkoutTemplatesTable).values({ name: parsed.data.name }).returning();
  if (parsed.data.exerciseIds.length > 0) {
    await db.insert(gymWorkoutTemplateExercisesTable).values(
      parsed.data.exerciseIds.map((exerciseId, index) => ({
        templateId: row.id,
        exerciseId,
        sortOrder: index,
      })),
    );
  }
  res.status(201).json(CreateGymWorkoutTemplateResponse.parse(serializeTemplate(row, parsed.data.exerciseIds)));
});

router.delete("/gym-workout-templates/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGymWorkoutTemplateParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(gymWorkoutTemplatesTable).where(eq(gymWorkoutTemplatesTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
