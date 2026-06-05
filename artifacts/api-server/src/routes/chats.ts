import { Router } from "express";
import { ListChatsParams, ListMessagesParams, ListMessagesQueryParams, SendMessageBody, SendMessageParams } from "@workspace/api-zod";
import { getChats, getMessages, sendMessage, sendVoiceNote, downloadMedia, getStatuses, addSseClient } from "../lib/whatsapp-manager";

const router = Router();

router.get("/sessions/:sessionId/chats", async (req, res) => {
  const parsed = ListChatsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { sessionId } = parsed.data;
  const chats = await getChats(sessionId);
  res.json(chats);
});

router.get("/sessions/:sessionId/chats/:chatId/messages", async (req, res) => {
  const parsedParams = ListMessagesParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const queryParsed = ListMessagesQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? (queryParsed.data.limit ?? 50) : 50;
  const before = queryParsed.success ? queryParsed.data.before : undefined;

  const { sessionId, chatId } = parsedParams.data;
  const messages = await getMessages(sessionId, chatId, limit, before ?? undefined);
  res.json(messages);
});

router.post("/sessions/:sessionId/chats/:chatId/messages", async (req, res) => {
  const parsedParams = SendMessageParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const parsedBody = SendMessageBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { sessionId, chatId } = parsedParams.data;
  const { message } = parsedBody.data;

  const sent = await sendMessage(sessionId, chatId, message);
  if (!sent) {
    res.status(503).json({ error: "Session not connected" });
    return;
  }
  res.status(201).json(sent);
});

router.post("/sessions/:sessionId/chats/:chatId/voice-note", async (req, res) => {
  const { sessionId, chatId } = req.params;
  const { audio, mimetype } = req.body;
  if (!audio || typeof audio !== "string") {
    res.status(400).json({ error: "audio (base64) is required" });
    return;
  }
  const sent = await sendVoiceNote(sessionId, chatId, audio, mimetype || "audio/ogg; codecs=opus");
  if (!sent) {
    res.status(503).json({ error: "Session not connected" });
    return;
  }
  res.status(201).json(sent);
});

router.get("/sessions/:sessionId/statuses", async (req, res) => {
  const { sessionId } = req.params;
  const fromMeParam = req.query.fromMe;
  const fromMe =
    fromMeParam === "true" ? true : fromMeParam === "false" ? false : undefined;
  const statuses = await getStatuses(sessionId, fromMe);
  res.json(statuses);
});

router.get("/sessions/:sessionId/chats/:chatId/messages/:messageId/media", async (req, res) => {
  const { sessionId, chatId, messageId } = req.params;
  if (!sessionId || !chatId || !messageId) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const result = await downloadMedia(sessionId, chatId, messageId);
  if (!result) {
    res.status(404).json({ error: "Media not found" });
    return;
  }

  const { buffer, mimeType } = result;
  const total = buffer.length;

  res.set("Content-Type", mimeType);
  res.set("Accept-Ranges", "bytes");
  res.set("Cache-Control", "public, max-age=86400");

  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      const chunkSize = end - start + 1;
      res.status(206);
      res.set("Content-Range", `bytes ${start}-${end}/${total}`);
      res.set("Content-Length", String(chunkSize));
      res.send(buffer.subarray(start, end + 1));
      return;
    }
  }

  res.set("Content-Length", String(total));
  res.send(buffer);
});

router.get("/sessions/:sessionId/events", (req, res) => {
  const { sessionId } = req.params;
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

  const cleanup = addSseClient(sessionId, res);
  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(keepAlive); }
  }, 25_000);

  req.on("close", () => {
    cleanup();
    clearInterval(keepAlive);
  });
});

export default router;
