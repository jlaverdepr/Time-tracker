import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, subprojectsTable, projectsTable, sessionsTable } from "@workspace/db";
import {
  CreateSubprojectBody,
  UpdateSubprojectBody,
  UpdateSubprojectParams,
  DeleteSubprojectParams,
  CompleteSubprojectParams,
  ReopenSubprojectParams,
  ListSubprojectsQueryParams,
  GetSubprojectCalendarEventsQueryParams,
  ListSubprojectsResponse,
  CreateSubprojectResponse,
  UpdateSubprojectResponse,
  CompleteSubprojectResponse,
  ReopenSubprojectResponse,
  GetSubprojectCalendarEventsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeSubproject(s: {
  id: number;
  projectId: number;
  name: string;
  color: string | null;
  status: string;
  completedAt: Date | string | null;
  createdAt: Date | string;
}) {
  return {
    ...s,
    completedAt: s.completedAt instanceof Date ? s.completedAt.toISOString() : s.completedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

// GET /subprojects — must come before /subprojects/:id
router.get("/subprojects/calendar-events", async (req, res): Promise<void> => {
  const query = GetSubprojectCalendarEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { startDate, endDate } = query.data;

  // 1. Active days: sessions with a subprojectId in the range
  const sessionRows = await db
    .select({
      date: sessionsTable.date,
      subprojectId: sessionsTable.subprojectId,
      subprojectName: subprojectsTable.name,
      subprojectColor: subprojectsTable.color,
      projectId: subprojectsTable.projectId,
      projectName: projectsTable.name,
      projectColor: projectsTable.color,
    })
    .from(sessionsTable)
    .innerJoin(subprojectsTable, eq(sessionsTable.subprojectId, subprojectsTable.id))
    .innerJoin(projectsTable, eq(subprojectsTable.projectId, projectsTable.id))
    .where(
      and(
        gte(sessionsTable.date, startDate),
        lte(sessionsTable.date, endDate)
      )
    );

  // 2. Completion days: subprojects completed within range
  const completedRows = await db
    .select({
      subprojectId: subprojectsTable.id,
      subprojectName: subprojectsTable.name,
      subprojectColor: subprojectsTable.color,
      projectId: subprojectsTable.projectId,
      projectName: projectsTable.name,
      projectColor: projectsTable.color,
      completedAt: subprojectsTable.completedAt,
    })
    .from(subprojectsTable)
    .innerJoin(projectsTable, eq(subprojectsTable.projectId, projectsTable.id))
    .where(eq(subprojectsTable.status, "completed"));

  // Build result — deduplicate active events per (date, subprojectId)
  const seen = new Set<string>();
  const events: Array<{
    date: string;
    subprojectId: number;
    subprojectName: string;
    subprojectColor: string | null;
    projectId: number;
    projectName: string;
    projectColor: string;
    eventType: string;
  }> = [];

  for (const row of sessionRows) {
    if (!row.subprojectId) continue;
    const key = `${row.date}:${row.subprojectId}:active`;
    if (!seen.has(key)) {
      seen.add(key);
      events.push({
        date: row.date,
        subprojectId: row.subprojectId,
        subprojectName: row.subprojectName,
        subprojectColor: row.subprojectColor ?? null,
        projectId: row.projectId,
        projectName: row.projectName ?? "",
        projectColor: row.projectColor ?? "#3B82F6",
        eventType: "active",
      });
    }
  }

  for (const row of completedRows) {
    if (!row.completedAt) continue;
    const date = row.completedAt instanceof Date
      ? row.completedAt.toISOString().slice(0, 10)
      : String(row.completedAt).slice(0, 10);
    if (date < startDate || date > endDate) continue;
    const key = `${date}:${row.subprojectId}:completed`;
    if (!seen.has(key)) {
      seen.add(key);
      events.push({
        date,
        subprojectId: row.subprojectId,
        subprojectName: row.subprojectName,
        subprojectColor: row.subprojectColor ?? null,
        projectId: row.projectId,
        projectName: row.projectName ?? "",
        projectColor: row.projectColor ?? "#3B82F6",
        eventType: "completed",
      });
    }
  }

  res.json(GetSubprojectCalendarEventsResponse.parse(events));
});

router.get("/subprojects", async (req, res): Promise<void> => {
  const query = ListSubprojectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(subprojectsTable)
    .where(query.data.projectId ? eq(subprojectsTable.projectId, query.data.projectId) : undefined)
    .orderBy(subprojectsTable.createdAt);

  res.json(ListSubprojectsResponse.parse(rows.map(serializeSubproject)));
});

router.post("/subprojects", async (req, res): Promise<void> => {
  const parsed = CreateSubprojectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(subprojectsTable).values(parsed.data).returning();
  res.status(201).json(CreateSubprojectResponse.parse(serializeSubproject(row)));
});

router.patch("/subprojects/:id", async (req, res): Promise<void> => {
  const params = UpdateSubprojectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSubprojectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(subprojectsTable)
    .set(parsed.data)
    .where(eq(subprojectsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Subproject not found" });
    return;
  }
  res.json(UpdateSubprojectResponse.parse(serializeSubproject(row)));
});

router.delete("/subprojects/:id", async (req, res): Promise<void> => {
  const params = DeleteSubprojectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(subprojectsTable)
    .where(eq(subprojectsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Subproject not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/subprojects/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteSubprojectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(subprojectsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(subprojectsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Subproject not found" });
    return;
  }
  res.json(CompleteSubprojectResponse.parse(serializeSubproject(row)));
});

router.post("/subprojects/:id/reopen", async (req, res): Promise<void> => {
  const params = ReopenSubprojectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(subprojectsTable)
    .set({ status: "active", completedAt: null })
    .where(eq(subprojectsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Subproject not found" });
    return;
  }
  res.json(ReopenSubprojectResponse.parse(serializeSubproject(row)));
});

export default router;
