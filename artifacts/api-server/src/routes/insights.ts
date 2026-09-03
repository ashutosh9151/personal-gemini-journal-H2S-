import { Router, type IRouter } from "express";
import {
  CreateInsightBody,
  CreateInsightResponse,
  DeleteInsightParams,
  ListInsightsResponse,
  UpdateInsightBody,
  UpdateInsightParams,
  UpdateInsightResponse,
} from "@workspace/api-zod";
import { requireFirebaseUser, userId } from "../middlewares/firebase-auth";
import {
  createInsight,
  deleteInsight,
  listInsights,
  updateInsight,
} from "../lib/journal-store";

const router: IRouter = Router();
router.use(requireFirebaseUser);

router.get("/insights", async (req, res): Promise<void> => {
  res.json(ListInsightsResponse.parse(await listInsights(userId(req))));
});

router.post("/insights", async (req, res): Promise<void> => {
  const parsed = CreateInsightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const insight = await createInsight(userId(req), parsed.data);
  res.status(201).json(CreateInsightResponse.parse(insight));
});

router.patch("/insights/:insightId", async (req, res): Promise<void> => {
  const params = UpdateInsightParams.safeParse(req.params);
  const body = UpdateInsightBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const insight = await updateInsight(userId(req), params.data.insightId, body.data);
  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }
  res.json(UpdateInsightResponse.parse(insight));
});

router.delete("/insights/:insightId", async (req, res): Promise<void> => {
  const params = DeleteInsightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteInsight(userId(req), params.data.insightId);
  if (!deleted) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;