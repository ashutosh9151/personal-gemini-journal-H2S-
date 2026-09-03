import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import insightsRouter from "./insights";
import journalsRouter from "./journals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(journalsRouter);
router.use(insightsRouter);
router.use(dashboardRouter);

export default router;
