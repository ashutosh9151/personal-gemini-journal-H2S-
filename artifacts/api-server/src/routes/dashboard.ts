import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireFirebaseUser, userId } from "../middlewares/firebase-auth";
import { getDashboardSummary } from "../lib/journal-store";

const router: IRouter = Router();
router.use(requireFirebaseUser);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  res.json(GetDashboardSummaryResponse.parse(await getDashboardSummary(userId(req))));
});

export default router;