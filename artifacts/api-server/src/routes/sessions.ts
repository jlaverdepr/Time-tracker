import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, sessionsTable, projectsTable, subprojectsTable } from "@workspace/db";
import {
  CreateSessionBody,
  UpdateSessionBody,
  UpdateSessionParams,
  DeleteSessionParams,
  GetSessionParams,
  ListSessionsQueryParams,
  GetCalendarQueryParams,
  GetRecentSessionsQueryParams,
  ListSessionsResponse,
  CreateSessionResponse,
  GetSessionResponse,
  UpdateSessionResponse,
  GetCalendarResponse,
  GetStatsResponse,
  GetRecentSessionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type RawSessionRow = {
  id: number;
  projectId: number | null;
  projectName: string | null;
  projectColor: string | null;
  subprojectId: number | null;
  subprojectName: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  notes: string | null;
  createdAt: Date | string;
};

function serializeSession(row: RawSessionRow) {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

const sessionSelectFields = {
  id: sessionsTable.id,
  projectId: sessionsTable.projectId,
  projectName: projectsTable.name,
  projectColor: projectsTable.color,
  subprojectId: sessionsTable.subprojectId,
  subprojectName: subprojectsTable.name,
  date: sessionsTable.date,
  startTime: sessionsTable.startTime,
  endTime: sessionsTable.endTime,
  durationMinutes: sessionsTable.durationMinutes,
  notes: sessionsTable.notes,
  createdAt: sessionsTable.createdAt,
} as const;

async function getSessionWithProject(id: number): Promise<RawSessionRow | null> {
  const rows = await db
    .select(sessionSelectFields)
    .from(sessionsTable)
    .leftJoin(projectsTable, eq(sessionsTable.projectId, projectsTable.id))
    .leftJoin(subprojectsTable, eq(sessionsTable.subprojectId, subprojectsTable.id))
    .where(eq(sessionsTable.id, id));
  return rows[0] ?? null;
}

// GET /sessions
router.get("/sessions", async (req, res): Promise<void> => {
  const query = ListSessionsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { startDate, endDate, projectId, subprojectId } = query.data;

  const conditions = [];
  if (startDate) conditions.push(gte(sessionsTable.date, startDate));
  if (endDate) conditions.push(lte(sessionsTable.date, endDate));
  if (projectId) conditions.push(eq(sessionsTable.projectId, projectId));
  if (subprojectId) conditions.push(eq(sessionsTable.subprojectId, subprojectId));

  const rows = await db
    .select(sessionSelectFields)
    .from(sessionsTable)
    .leftJoin(projectsTable, eq(sessionsTable.projectId, projectsTable.id))
    .leftJoin(subprojectsTable, eq(sessionsTable.subprojectId, subprojectsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sessionsTable.date), desc(sessionsTable.createdAt));

  res.json(ListSessionsResponse.parse(rows.map(serializeSession)));
});

// POST /sessions
router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Enforce subproject ↔ project consistency
  if (parsed.data.subprojectId) {
    const [sub] = await db.select().from(subprojectsTable).where(eq(subprojectsTable.id, parsed.data.subprojectId));
    if (!sub) { res.status(400).json({ error: "Subproject not found" }); return; }
    if (parsed.data.projectId && sub.projectId !== parsed.data.projectId) {
      res.status(400).json({ error: "Subproject does not belong to the specified project" }); return;
    }
    // Auto-set projectId from subproject if not provided
    if (!parsed.data.projectId) parsed.data.projectId = sub.projectId;
  }

  const [inserted] = await db.insert(sessionsTable).values(parsed.data).returning();
  const row = await getSessionWithProject(inserted.id);
  res.status(201).json(CreateSessionResponse.parse(serializeSession(row!)));
});

// GET /sessions/calendar  — must be before /sessions/:id
router.get("/sessions/calendar", async (req, res): Promise<void> => {
  const query = GetCalendarQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { startDate, endDate } = query.data;

  const rows = await db
    .select({
      id: sessionsTable.id,
      projectId: sessionsTable.projectId,
      projectName: projectsTable.name,
      projectColor: projectsTable.color,
      date: sessionsTable.date,
      durationMinutes: sessionsTable.durationMinutes,
    })
    .from(sessionsTable)
    .leftJoin(projectsTable, eq(sessionsTable.projectId, projectsTable.id))
    .where(and(gte(sessionsTable.date, startDate), lte(sessionsTable.date, endDate)))
    .orderBy(sessionsTable.date);

  const dayMap = new Map<string, {
    totalMinutes: number;
    sessionCount: number;
    projectMap: Map<string, { projectId: number | null; projectName: string | null; projectColor: string | null; minutes: number }>;
  }>();

  for (const row of rows) {
    if (!dayMap.has(row.date)) {
      dayMap.set(row.date, { totalMinutes: 0, sessionCount: 0, projectMap: new Map() });
    }
    const day = dayMap.get(row.date)!;
    day.totalMinutes += row.durationMinutes;
    day.sessionCount += 1;
    const key = String(row.projectId ?? "none");
    if (!day.projectMap.has(key)) {
      day.projectMap.set(key, { projectId: row.projectId, projectName: row.projectName ?? null, projectColor: row.projectColor ?? null, minutes: 0 });
    }
    day.projectMap.get(key)!.minutes += row.durationMinutes;
  }

  const result = Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    totalMinutes: data.totalMinutes,
    sessionCount: data.sessionCount,
    projectBreakdown: Array.from(data.projectMap.values()),
  }));

  res.json(GetCalendarResponse.parse(result));
});

// GET /sessions/stats
router.get("/sessions/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const allSessions = await db.select({ date: sessionsTable.date, durationMinutes: sessionsTable.durationMinutes }).from(sessionsTable);

  let todayMinutes = 0, weekMinutes = 0, monthMinutes = 0, allTimeMinutes = 0;
  let todaySessions = 0, weekSessions = 0, monthSessions = 0, allTimeSessions = 0;

  for (const s of allSessions) {
    allTimeMinutes += s.durationMinutes;
    allTimeSessions += 1;
    if (s.date >= monthStartStr) { monthMinutes += s.durationMinutes; monthSessions += 1; }
    if (s.date >= weekStartStr) { weekMinutes += s.durationMinutes; weekSessions += 1; }
    if (s.date === todayStr) { todayMinutes += s.durationMinutes; todaySessions += 1; }
  }

  res.json(GetStatsResponse.parse({ todayMinutes, weekMinutes, monthMinutes, allTimeMinutes, todaySessions, weekSessions, monthSessions, allTimeSessions }));
});

// GET /sessions/recent
router.get("/sessions/recent", async (req, res): Promise<void> => {
  const query = GetRecentSessionsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const limit = query.data.limit ?? 10;

  const rows = await db
    .select(sessionSelectFields)
    .from(sessionsTable)
    .leftJoin(projectsTable, eq(sessionsTable.projectId, projectsTable.id))
    .leftJoin(subprojectsTable, eq(sessionsTable.subprojectId, subprojectsTable.id))
    .orderBy(desc(sessionsTable.date), desc(sessionsTable.createdAt))
    .limit(limit);

  res.json(GetRecentSessionsResponse.parse(rows.map(serializeSession)));
});

// GET /sessions/:id
router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = await getSessionWithProject(params.data.id);
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(GetSessionResponse.parse(serializeSession(row)));
});

// PATCH /sessions/:id
router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (Object.keys(parsed.data).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  // Enforce subproject ↔ project consistency on update
  if (parsed.data.subprojectId) {
    const [sub] = await db.select().from(subprojectsTable).where(eq(subprojectsTable.id, parsed.data.subprojectId));
    if (!sub) { res.status(400).json({ error: "Subproject not found" }); return; }
    const effectiveProjectId = parsed.data.projectId ?? (await getSessionWithProject(params.data.id))?.projectId;
    if (effectiveProjectId && sub.projectId !== effectiveProjectId) {
      res.status(400).json({ error: "Subproject does not belong to the specified project" }); return;
    }
    if (!parsed.data.projectId) parsed.data.projectId = sub.projectId;
  }

  const [updated] = await db.update(sessionsTable).set(parsed.data).where(eq(sessionsTable.id, params.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "Session not found" }); return; }
  const row = await getSessionWithProject(updated.id);
  res.json(UpdateSessionResponse.parse(serializeSession(row!)));
});

// DELETE /sessions/:id
router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Session not found" }); return; }
  res.sendStatus(204);
});

export default router;
