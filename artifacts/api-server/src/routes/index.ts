import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import subprojectsRouter from "./subprojects";
import sessionsRouter from "./sessions";
import todosRouter from "./todos";
import gymRouter from "./gym";
import { requireAuthToken } from "../lib/auth";

const router: IRouter = Router();

// Unauthenticated: lets a client verify it can reach the server at all
// before it has a token configured.
router.use(healthRouter);

router.use(requireAuthToken);
router.use(projectsRouter);
router.use(subprojectsRouter);
router.use(sessionsRouter);
router.use(todosRouter);
router.use(gymRouter);

export default router;
