import { randomUUID } from "node:crypto";
import { getFirebaseDb, Timestamp } from "./firebase";

export type JournalMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
};

export type Journal = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: JournalMessage[];
};

export type Insight = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: "open" | "done";
  createdAt: string;
  updatedAt: string;
};

function iso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date().toISOString();
}

function userRoot(uid: string) {
  return getFirebaseDb().collection("users").doc(uid);
}

function journalCollection(uid: string) {
  return userRoot(uid).collection("journals");
}

function insightCollection(uid: string) {
  return userRoot(uid).collection("insights");
}

function mapMessage(id: string, data: FirebaseFirestore.DocumentData): JournalMessage {
  return {
    id,
    role: data.role === "model" ? "model" : "user",
    text: String(data.text ?? ""),
    createdAt: iso(data.createdAt),
  };
}

async function withMessages(
  uid: string,
  id: string,
  data: FirebaseFirestore.DocumentData,
): Promise<Journal> {
  const messageSnapshot = await journalCollection(uid)
    .doc(id)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  return {
    id,
    title: String(data.title ?? "Untitled journal"),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    messages: messageSnapshot.docs.map((message) =>
      mapMessage(message.id, message.data()),
    ),
  };
}

export async function listJournals(uid: string): Promise<Journal[]> {
  const snapshot = await journalCollection(uid).orderBy("updatedAt", "desc").get();
  return Promise.all(
    snapshot.docs.map((doc) => withMessages(uid, doc.id, doc.data())),
  );
}

export async function getJournal(uid: string, id: string): Promise<Journal | null> {
  const doc = await journalCollection(uid).doc(id).get();
  return doc.exists ? withMessages(uid, id, doc.data() ?? {}) : null;
}

export async function createJournal(uid: string, title: string): Promise<Journal> {
  const id = randomUUID();
  const now = Timestamp.now();
  await journalCollection(uid).doc(id).set({
    title,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    title,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
    messages: [],
  };
}

export async function updateJournal(
  uid: string,
  id: string,
  title: string,
): Promise<Journal | null> {
  const reference = journalCollection(uid).doc(id);
  const existing = await reference.get();
  if (!existing.exists) {
    return null;
  }
  const now = Timestamp.now();
  await reference.update({ title, updatedAt: now });
  return getJournal(uid, id);
}

export async function deleteJournal(uid: string, id: string): Promise<boolean> {
  const reference = journalCollection(uid).doc(id);
  const existing = await reference.get();
  if (!existing.exists) {
    return false;
  }

  const messages = await reference.collection("messages").get();
  const batch = getFirebaseDb().batch();
  messages.docs.forEach((message) => batch.delete(message.ref));
  batch.delete(reference);
  await batch.commit();
  return true;
}

export async function appendMessage(
  uid: string,
  id: string,
  role: "user" | "model",
  text: string,
): Promise<void> {
  const journalReference = journalCollection(uid).doc(id);
  const journal = await journalReference.get();
  if (!journal.exists) {
    throw new Error("Journal not found");
  }
  const now = Timestamp.now();
  await journalReference
    .collection("messages")
    .doc(randomUUID())
    .set({ role, text, createdAt: now });
  await journalReference.update({ updatedAt: now });
}

export async function listInsights(uid: string): Promise<Insight[]> {
  const snapshot = await insightCollection(uid).orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: String(data.title ?? ""),
      body: String(data.body ?? ""),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      status: data.status === "done" ? "done" : "open",
      createdAt: iso(data.createdAt),
      updatedAt: iso(data.updatedAt),
    };
  });
}

export async function createInsight(
  uid: string,
  input: Pick<Insight, "title" | "body" | "tags" | "status">,
): Promise<Insight> {
  const id = randomUUID();
  const now = Timestamp.now();
  await insightCollection(uid).doc(id).set({
    ...input,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    ...input,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  };
}

export async function updateInsight(
  uid: string,
  id: string,
  input: Partial<Pick<Insight, "title" | "body" | "tags" | "status">>,
): Promise<Insight | null> {
  const reference = insightCollection(uid).doc(id);
  const existing = await reference.get();
  if (!existing.exists) {
    return null;
  }
  const now = Timestamp.now();
  await reference.update({ ...input, updatedAt: now });
  const updated = await reference.get();
  const data = updated.data() ?? {};
  return {
    id,
    title: String(data.title ?? ""),
    body: String(data.body ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    status: data.status === "done" ? "done" : "open",
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
}

export async function deleteInsight(uid: string, id: string): Promise<boolean> {
  const reference = insightCollection(uid).doc(id);
  const existing = await reference.get();
  if (!existing.exists) {
    return false;
  }
  await reference.delete();
  return true;
}

export async function getDashboardSummary(uid: string) {
  const [journals, insights] = await Promise.all([
    listJournals(uid),
    listInsights(uid),
  ]);
  return {
    journalCount: journals.length,
    messageCount: journals.reduce((total, journal) => total + journal.messages.length, 0),
    openInsightCount: insights.filter((insight) => insight.status === "open").length,
    latestJournal: journals[0] ?? null,
  };
}
