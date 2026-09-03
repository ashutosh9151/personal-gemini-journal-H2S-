import { Router, type IRouter } from "express";
import {
  CreateJournalBody,
  CreateJournalResponse,
  DeleteJournalParams,
  GetJournalParams,
  GetJournalResponse,
  ListJournalsResponse,
  SendJournalMessageBody,
  SendJournalMessageParams,
  SendJournalMessageResponse,
  UpdateJournalBody,
  UpdateJournalParams,
  UpdateJournalResponse,
} from "@workspace/api-zod";
import { requireFirebaseUser, userId } from "../middlewares/firebase-auth";
import {
  appendMessage,
  createJournal,
  deleteJournal,
  getJournal,
  listJournals,
  updateJournal,
} from "../lib/journal-store";
import { replyToJournal } from "../lib/gemini";

const router: IRouter = Router();
router.use(requireFirebaseUser);

router.get("/journals", async (req, res): Promise<void> => {
  const journals = await listJournals(userId(req));
  res.json(ListJournalsResponse.parse(journals));
});

router.post("/journals", async (req, res): Promise<void> => {
  const parsed = CreateJournalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const journal = await createJournal(userId(req), parsed.data.title.trim());
  res.status(201).json(CreateJournalResponse.parse(journal));
});

router.get("/journals/:journalId", async (req, res): Promise<void> => {
  const params = GetJournalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const journal = await getJournal(userId(req), params.data.journalId);
  if (!journal) {
    res.status(404).json({ error: "Journal not found" });
    return;
  }
  res.json(GetJournalResponse.parse(journal));
});

router.patch("/journals/:journalId", async (req, res): Promise<void> => {
  const params = UpdateJournalParams.safeParse(req.params);
  const body = UpdateJournalBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const journal = await updateJournal(userId(req), params.data.journalId, body.data.title.trim());
  if (!journal) {
    res.status(404).json({ error: "Journal not found" });
    return;
  }
  res.json(UpdateJournalResponse.parse(journal));
});

router.delete("/journals/:journalId", async (req, res): Promise<void> => {
  const params = DeleteJournalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteJournal(userId(req), params.data.journalId);
  if (!deleted) {
    res.status(404).json({ error: "Journal not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/journals/:journalId/messages", async (req, res): Promise<void> => {
  const params = SendJournalMessageParams.safeParse(req.params);
  const body = SendJournalMessageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const uid = userId(req);
  const journal = await getJournal(uid, params.data.journalId);
  if (!journal) {
    res.status(404).json({ error: "Journal not found" });
    return;
  }

  const text = body.data.text.trim();
  await appendMessage(uid, journal.id, "user", text);
  const modelText = await replyToJournal(journal.messages, text);
  await appendMessage(uid, journal.id, "model", modelText);
  const updated = await getJournal(uid, journal.id);
  res.json(SendJournalMessageResponse.parse(updated));
});

export default router;