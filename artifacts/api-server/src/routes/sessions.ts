import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { CreateSessionBody, GetSessionParams, DeleteSessionParams, GetSessionQrParams } from "@workspace/api-zod";
import {
  startSession,
  stopSession,
  getSessionStatus,
  requestPairingCode,
  reconnectSession,
} from "../lib/whatsapp-manager";

const router = Router();

router.get("/sessions", async (req, res) => {
  const { userId } = req.query;
  let sessions;
  if (userId && typeof userId === "string") {
    sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId));
  } else {
    sessions = await db.select().from(sessionsTable);
  }
  const result = sessions.map((s) => {
    const live = getSessionStatus(s.id);
    return {
      id: s.id,
      name: s.name,
      phone: live.phone ?? s.phone,
      status: live.status,
      qrCode: live.qrCode,
      locked: s.locked,
      userId: s.userId,
      createdAt: s.createdAt.toISOString(),
    };
  });
  res.json(result);
});

router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { name } = parsed.data;
  const userId: string | null = (req.body.userId && typeof req.body.userId === "string") ? req.body.userId : null;
  const id = uuidv4();
  await db.insert(sessionsTable).values({ id, name, status: "pending", userId });
  await startSession(id);

  const live = getSessionStatus(id);
  res.status(201).json({
    id,
    name,
    phone: null,
    status: live.status,
    qrCode: live.qrCode,
    userId,
    createdAt: new Date().toISOString(),
  });
});

router.get("/sessions/:sessionId", async (req, res) => {
  const parsed = GetSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { sessionId } = parsed.data;
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const live = getSessionStatus(sessionId);
  res.json({
    id: session.id,
    name: session.name,
    phone: live.phone ?? session.phone,
    status: live.status,
    qrCode: live.qrCode,
    createdAt: session.createdAt.toISOString(),
  });
});

router.delete("/sessions/:sessionId", async (req, res) => {
  const parsed = DeleteSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { sessionId } = parsed.data;
  await stopSession(sessionId);
  await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  res.json({ success: true, message: "Session deleted" });
});

router.get("/sessions/:sessionId/qr", async (req, res) => {
  const parsed = GetSessionQrParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { sessionId } = parsed.data;
  const live = getSessionStatus(sessionId);
  res.json({ qrCode: live.qrCode, status: live.status });
});

router.post("/sessions/:sessionId/reconnect", async (req, res) => {
  const { sessionId } = req.params;
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await reconnectSession(sessionId);
  const live = getSessionStatus(sessionId);
  res.json({ id: sessionId, status: live.status });
});

router.patch("/sessions/:sessionId/lock", async (req, res) => {
  const { sessionId } = req.params;
  const { locked } = req.body;
  if (typeof locked !== "boolean") {
    res.status(400).json({ error: "locked must be a boolean" });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await db.update(sessionsTable).set({ locked, updatedAt: new Date() }).where(eq(sessionsTable.id, sessionId));
  res.json({ id: sessionId, locked });
});

router.post("/sessions/:sessionId/pairing-code", async (req, res) => {
  const { sessionId } = req.params;
  const { phoneNumber } = req.body;

  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber is required" });
    return;
  }

  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length < 7 || cleaned.length > 15) {
    res.status(400).json({ error: "Invalid phone number" });
    return;
  }

  const code = await requestPairingCode(sessionId, cleaned);
  if (!code) {
    res.status(503).json({ error: "Failed to generate pairing code. Make sure the session is active." });
    return;
  }
  res.json({ code });
});

export default router;
