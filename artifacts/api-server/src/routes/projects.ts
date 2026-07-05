import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  UpdateProjectParams,
  DeleteProjectParams,
  CompleteProjectParams,
  ReopenProjectParams,
  ListProjectsResponse,
  CreateProjectResponse,
  UpdateProjectResponse,
  CompleteProjectResponse,
  ReopenProjectResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeProject(p: {
  id: number;
  name: string;
  color: string;
  status: string;
  completedAt: Date | string | null;
  createdAt: Date | string;
}) {
  return {
    ...p,
    completedAt: p.completedAt instanceof Date ? p.completedAt.toISOString() : p.completedAt,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  res.json(ListProjectsResponse.parse(projects.map(serializeProject)));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [project] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json(CreateProjectResponse.parse(serializeProject(project)));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (Object.keys(parsed.data).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [project] = await db
    .update(projectsTable).set(parsed.data).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(UpdateProjectResponse.parse(serializeProject(project)));
});

router.post("/projects/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db
    .update(projectsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(CompleteProjectResponse.parse(serializeProject(project)));
});

router.post("/projects/:id/reopen", async (req, res): Promise<void> => {
  const params = ReopenProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db
    .update(projectsTable)
    .set({ status: "active", completedAt: null })
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(ReopenProjectResponse.parse(serializeProject(project)));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.sendStatus(204);
});

export default router;
