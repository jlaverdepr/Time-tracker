import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import subprojectsRouter from "./subprojects";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(subprojectsRouter);
router.use(sessionsRouter);

export default router;
