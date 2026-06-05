import makeWASocket, {
  BufferJSON,
  initAuthCreds,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  WASocket,
  proto,
  downloadMediaMessage,
  Contact,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";
import { db } from "@workspace/db";
import { sessionsTable, chatsTable, messagesTable, contactsTable, authKeysTable } from "@workspace/db";
import { eq, and, desc, lt, sql, inArray } from "drizzle-orm";
import QRCode from "qrcode";

const SESSIONS_DIR = path.join(process.cwd(), "whatsapp-sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const MEDIA_CACHE_DIR = path.join(process.cwd(), "whatsapp-media");
if (!fs.existsSync(MEDIA_CACHE_DIR)) fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });

const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker"]);

function mediaCachePath(sessionId: string, messageId: string): string {
  const dir = path.join(MEDIA_CACHE_DIR, sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, messageId);
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg; codecs=opus": "ogg",
    "video/mp4": "mp4", "video/webm": "webm",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

// Status codes that should NEVER trigger a reconnect
const PERMANENT_DISCONNECT_CODES = new Set([
  DisconnectReason.loggedOut,  // 401 – user removed this device from phone
  DisconnectReason.forbidden,  // 403 – account banned or revoked by WhatsApp
]);

// Status codes that should clear auth files and restart fresh
const CLEAR_AUTH_CODES = new Set([
  DisconnectReason.badSession, // 500 – corrupt credentials, need re-link
]);

export interface ChatInfo {
  id: string;
  name: string;
  phone: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  isGroup: boolean;
  profilePicture: string | null;
}

export interface StatusInfo {
  id: string;
  participantJid: string;
  participantName: string | null;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "other";
  body: string;
  timestamp: number;
  messageId: string;
}

export interface MessageInfo {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  senderName: string | null;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "other";
}

interface ChatEntry {
  id: string;
  name?: string;
  unreadCount: number;
  lastMessage: proto.IWebMessageInfo | null;
}

interface ActiveSession {
  socket: WASocket;
  qrCode: string | null;
  pairingCode: string | null;
  status: "pending" | "connected" | "disconnected";
  phone: string | null;
  chats: Map<string, ChatEntry>;
  messages: Map<string, proto.IWebMessageInfo[]>;
  contacts: Map<string, Contact>;
  lidToJid: Map<string, string>;
  // Watchdog timer — detects silent WebSocket deaths
  watchdogTimer: ReturnType<typeof setInterval> | null;
  // Track last heartbeat so watchdog knows if connection is actually alive
  lastHeartbeat: number;
}

const activeSessions = new Map<string, ActiveSession>();
// Exponential backoff tracker: sessionId → attempt count
const reconnectAttempts = new Map<string, number>();
// Track sessions that have been permanently stopped (no reconnect ever)
const stoppedSessions = new Set<string>();
// Track sessions that already have a reconnect timer queued (prevent duplicates)
const pendingReconnects = new Set<string>();

// ── SSE real-time push ────────────────────────────────────────────────────────
interface SseSink { write(data: string): boolean }
const sseClients = new Map<string, Set<SseSink>>();

export function addSseClient(sessionId: string, sink: SseSink): () => void {
  if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set());
  sseClients.get(sessionId)!.add(sink);
  return () => { sseClients.get(sessionId)?.delete(sink); };
}

function broadcastSse(sessionId: string, event: string, data: unknown) {
  const clients = sseClients.get(sessionId);
  if (!clients?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const sink of [...clients]) {
    try { sink.write(payload); } catch { clients.delete(sink); }
  }
}

function getSessionDir(sessionId: string): string {
  return path.join(SESSIONS_DIR, sessionId);
}

// ── Message text/type helpers ─────────────────────────────────────────────────

function extractMessageText(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return "";
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return "[Image] " + m.imageMessage.caption;
  if (m.imageMessage) return "[Image]";
  if (m.videoMessage?.caption) return "[Video] " + m.videoMessage.caption;
  if (m.videoMessage) return "[Video]";
  if (m.audioMessage) return "[Audio]";
  if (m.documentMessage) return "[Document] " + (m.documentMessage.fileName || "");
  if (m.stickerMessage) return "[Sticker]";
  return "[Message]";
}

function getMessageType(msg: proto.IWebMessageInfo): MessageInfo["type"] {
  const m = msg.message;
  if (!m) return "other";
  if (m.conversation || m.extendedTextMessage) return "text";
  if (m.imageMessage) return "image";
  if (m.videoMessage) return "video";
  if (m.audioMessage) return "audio";
  if (m.documentMessage) return "document";
  if (m.stickerMessage) return "sticker";
  return "other";
}

// ── DB helpers (fire-and-forget) ──────────────────────────────────────────────

function saveMessageToDB(
  sessionId: string,
  chatId: string,
  msg: proto.IWebMessageInfo
) {
  if (!msg.key?.id) return;
  const type = getMessageType(msg);
  db.insert(messagesTable)
    .values({
      sessionId,
      chatId,
      messageId: msg.key.id,
      fromMe: msg.key.fromMe ?? false,
      body: extractMessageText(msg),
      type,
      timestamp: Number(msg.messageTimestamp) || 0,
      senderName: msg.pushName || null,
      rawMessage: MEDIA_TYPES.has(type) ? JSON.stringify(msg) : null,
    })
    .onConflictDoNothing()
    .catch((err: unknown) => logger.error({ err }, "Failed to save message to DB"));
}

/**
 * Bulk-save a batch of messages — used for history sync where we can receive
 * thousands of messages at once.
 */
async function saveMessagesBatch(
  sessionId: string,
  msgs: proto.IWebMessageInfo[]
) {
  const CHUNK = 200;
  const valid = msgs.filter((m) => m.key?.id && m.key?.remoteJid);
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    await db
      .insert(messagesTable)
      .values(
        chunk.map((msg) => {
          const type = getMessageType(msg);
          return {
            sessionId,
            chatId: msg.key!.remoteJid!,
            messageId: msg.key!.id!,
            fromMe: msg.key!.fromMe ?? false,
            body: extractMessageText(msg),
            type,
            timestamp: Number(msg.messageTimestamp) || 0,
            senderName: msg.pushName || null,
            rawMessage: MEDIA_TYPES.has(type) ? JSON.stringify(msg) : null,
          };
        })
      )
      .onConflictDoUpdate({
        target: [messagesTable.sessionId, messagesTable.messageId],
        set: {
          rawMessage: sql`CASE WHEN ${messagesTable.rawMessage} IS NULL THEN EXCLUDED.raw_message ELSE ${messagesTable.rawMessage} END`,
        },
      })
      .catch((err: unknown) => logger.error({ err }, "Failed to batch-save messages"));
  }
}

function saveChatToDB(
  sessionId: string,
  chatId: string,
  name?: string | null,
  lastMsg?: proto.IWebMessageInfo | null,
  unreadCount?: number
) {
  if (chatId === "status@broadcast" || chatId.endsWith("@broadcast")) return;
  const isGroup = chatId.endsWith("@g.us");
  const phone = isGroup ? null : chatId.split(":")[0].split("@")[0];
  const lastMessage = lastMsg ? extractMessageText(lastMsg) : undefined;
  const lastMessageTime =
    lastMsg?.messageTimestamp
      ? new Date(Number(lastMsg.messageTimestamp) * 1000)
      : undefined;

  db.insert(chatsTable)
    .values({
      sessionId,
      chatId,
      name: name || null,
      phone,
      isGroup,
      lastMessage: lastMessage ?? null,
      lastMessageTime: lastMessageTime ?? null,
      unreadCount: unreadCount ?? 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [chatsTable.sessionId, chatsTable.chatId],
      set: {
        name: sql`COALESCE(EXCLUDED.name, ${chatsTable.name})`,
        lastMessage: sql`COALESCE(EXCLUDED.last_message, ${chatsTable.lastMessage})`,
        lastMessageTime: sql`GREATEST(COALESCE(EXCLUDED.last_message_time, '1970-01-01'), COALESCE(${chatsTable.lastMessageTime}, '1970-01-01'))`,
        unreadCount: sql`EXCLUDED.unread_count`,
        updatedAt: sql`EXCLUDED.updated_at`,
      },
    })
    .catch((err: unknown) => logger.error({ err }, "Failed to save chat to DB"));
}

async function saveChatsBatch(
  sessionId: string,
  chats: Array<{ id: string; name?: string | null; lastMessage?: proto.IWebMessageInfo | null; unreadCount?: number }>
) {
  const CHUNK = 100;
  const valid = chats.filter((c) => c.id && c.id !== "status@broadcast" && !c.id.endsWith("@broadcast"));
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    await db
      .insert(chatsTable)
      .values(
        chunk.map((c) => ({
          sessionId,
          chatId: c.id,
          name: c.name || null,
          phone: c.id.endsWith("@g.us") ? null : c.id.split(":")[0].split("@")[0],
          isGroup: c.id.endsWith("@g.us"),
          lastMessage: c.lastMessage ? extractMessageText(c.lastMessage) : null,
          lastMessageTime: c.lastMessage?.messageTimestamp
            ? new Date(Number(c.lastMessage.messageTimestamp) * 1000)
            : null,
          unreadCount: c.unreadCount ?? 0,
          updatedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: [chatsTable.sessionId, chatsTable.chatId],
        set: {
          name: sql`COALESCE(EXCLUDED.name, ${chatsTable.name})`,
          lastMessage: sql`COALESCE(EXCLUDED.last_message, ${chatsTable.lastMessage})`,
          lastMessageTime: sql`GREATEST(COALESCE(EXCLUDED.last_message_time, '1970-01-01'), COALESCE(${chatsTable.lastMessageTime}, '1970-01-01'))`,
          unreadCount: sql`EXCLUDED.unread_count`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      })
      .catch((err: unknown) => logger.error({ err }, "Failed to batch-save chats"));
  }
}

async function saveContactsBatch(sessionId: string, contacts: Contact[]) {
  const CHUNK = 200;
  const valid = contacts.filter((c) => c.id && (c.name || c.verifiedName || c.notify));
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    await db
      .insert(contactsTable)
      .values(
        chunk.map((c) => ({
          sessionId,
          jid: c.id,
          name: c.name || null,
          verifiedName: c.verifiedName || null,
          notify: c.notify || null,
          updatedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: [contactsTable.sessionId, contactsTable.jid],
        set: {
          name: sql`COALESCE(EXCLUDED.name, ${contactsTable.name})`,
          verifiedName: sql`COALESCE(EXCLUDED.verified_name, ${contactsTable.verifiedName})`,
          notify: sql`COALESCE(EXCLUDED.notify, ${contactsTable.notify})`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      })
      .catch((err: unknown) => logger.error({ err }, "Failed to batch-save contacts"));
  }
}

async function loadContactsFromDB(sessionId: string): Promise<Map<string, Contact>> {
  const rows = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.sessionId, sessionId))
    .catch(() => []);
  const map = new Map<string, Contact>();
  for (const row of rows) {
    map.set(row.jid, {
      id: row.jid,
      name: row.name ?? undefined,
      verifiedName: row.verifiedName ?? undefined,
      notify: row.notify ?? undefined,
    } as Contact);
  }
  return map;
}

// ── Reconnect with exponential backoff ────────────────────────────────────────

function scheduleReconnect(sessionId: string, immediateMs?: number): void {
  if (stoppedSessions.has(sessionId)) return;
  // Prevent stacking duplicate reconnect timers
  if (pendingReconnects.has(sessionId)) return;

  const attempts = reconnectAttempts.get(sessionId) ?? 0;
  // Backoff: 2s, 4s, 8s, 16s, 30s … capped at 30s for faster recovery
  const delay = immediateMs ?? Math.min(2000 * Math.pow(2, attempts), 30_000);
  reconnectAttempts.set(sessionId, attempts + 1);
  pendingReconnects.add(sessionId);
  logger.info({ sessionId, attempt: attempts + 1, delayMs: delay }, "Scheduling reconnect");
  setTimeout(() => {
    pendingReconnects.delete(sessionId);
    if (stoppedSessions.has(sessionId)) return;
    startSession(sessionId).catch((err) =>
      logger.error({ err, sessionId }, "Reconnect attempt failed")
    );
  }, delay);
}

// ── Watchdog: detects silent WebSocket deaths ─────────────────────────────────

function startWatchdog(sessionId: string, session: ActiveSession): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (stoppedSessions.has(sessionId)) {
      clearInterval(session.watchdogTimer!);
      return;
    }
    if (session.status !== "connected") return;

    const ws = (session.socket as unknown as { ws?: { readyState: number } }).ws;
    const wsState = ws?.readyState;

    // WebSocket.OPEN = 1; anything else while "connected" is a silent death
    if (wsState !== undefined && wsState !== 1) {
      logger.warn({ sessionId, wsState }, "Watchdog: WebSocket not OPEN — forcing reconnect");
      clearInterval(session.watchdogTimer!);
      session.watchdogTimer = null;
      session.status = "disconnected";
      activeSessions.delete(sessionId);

      db.update(sessionsTable)
        .set({ status: "disconnected", updatedAt: new Date() })
        .where(eq(sessionsTable.id, sessionId))
        .catch(() => {});

      scheduleReconnect(sessionId, 2_000);
    }
  }, 30_000); // Check every 30 seconds
}

// ── Database-backed auth state ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function useDatabaseAuthState(sessionId: string): Promise<{ state: any; saveCreds: () => Promise<void> }> {
  const [row] = await db
    .select({ authData: sessionsTable.authData })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .catch(() => []);

  const creds = row?.authData
    ? JSON.parse(row.authData, BufferJSON.reviver)
    : initAuthCreds();

  const keys = {
    async get(type: string, ids: string[]) {
      if (!ids.length) return {};
      const rows = await db
        .select()
        .from(authKeysTable)
        .where(
          and(
            eq(authKeysTable.sessionId, sessionId),
            eq(authKeysTable.keyType, type),
            inArray(authKeysTable.keyId, ids),
          ),
        )
        .catch(() => []);
      const result: Record<string, unknown> = {};
      for (const r of rows) {
        result[r.keyId] = JSON.parse(r.keyData, BufferJSON.reviver);
      }
      return result;
    },

    async set(data: Record<string, Record<string, unknown>>) {
      const toInsert: Array<{ sessionId: string; keyType: string; keyId: string; keyData: string }> = [];
      const toDelete: Array<[string, string]> = [];

      for (const [type, typeData] of Object.entries(data)) {
        for (const [id, value] of Object.entries(typeData)) {
          if (value != null) {
            toInsert.push({
              sessionId,
              keyType: type,
              keyId: id,
              keyData: JSON.stringify(value, BufferJSON.replacer),
            });
          } else {
            toDelete.push([type, id]);
          }
        }
      }

      if (toInsert.length) {
        await db
          .insert(authKeysTable)
          .values(toInsert)
          .onConflictDoUpdate({
            target: [authKeysTable.sessionId, authKeysTable.keyType, authKeysTable.keyId],
            set: { keyData: sql`EXCLUDED.key_data` },
          })
          .catch(() => {});
      }

      for (const [type, id] of toDelete) {
        await db
          .delete(authKeysTable)
          .where(
            and(
              eq(authKeysTable.sessionId, sessionId),
              eq(authKeysTable.keyType, type),
              eq(authKeysTable.keyId, id),
            ),
          )
          .catch(() => {});
      }
    },
  };

  const saveCreds = async () => {
    await db
      .update(sessionsTable)
      .set({ authData: JSON.stringify(creds, BufferJSON.replacer), updatedAt: new Date() })
      .where(eq(sessionsTable.id, sessionId))
      .catch(() => {});
  };

  return { state: { creds, keys }, saveCreds };
}

async function clearAuthFromDB(sessionId: string): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ authData: null, updatedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId))
    .catch(() => {});
  await db
    .delete(authKeysTable)
    .where(eq(authKeysTable.sessionId, sessionId))
    .catch(() => {});
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

export async function startSession(sessionId: string): Promise<void> {
  // Don't start if explicitly stopped
  if (stoppedSessions.has(sessionId)) return;

  const { state, saveCreds } = await useDatabaseAuthState(sessionId);
  const { version } = await fetchLatestBaileysVersion();

  const baileysLogger = logger.child({ sessionId, level: "silent" });

  const socket = makeWASocket({
    version,
    auth: state,
    logger: baileysLogger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    // Full history: WhatsApp sends ALL past messages when linking a new device
    syncFullHistory: true,
    markOnlineOnConnect: false,
    // Send WebSocket ping every 25s so NAT/firewalls don't kill the connection
    keepAliveIntervalMs: 25_000,
    // Retry failed message sends up to 5 times with 2s between each
    retryRequestDelayMs: 2_000,
    maxMsgRetryCount: 5,
    // Connect timeout
    connectTimeoutMs: 60_000,
  });

  // Pre-populate contacts from DB so names show correctly after server restarts
  const savedContacts = await loadContactsFromDB(sessionId);

  const session: ActiveSession = {
    socket,
    qrCode: null,
    pairingCode: null,
    status: "pending",
    phone: null,
    chats: new Map(),
    messages: new Map(),
    contacts: savedContacts,
    lidToJid: new Map(),
    watchdogTimer: null,
    lastHeartbeat: Date.now(),
  };

  activeSessions.set(sessionId, session);

  socket.ev.on("creds.update", saveCreds);

  // ── Connection state ────────────────────────────────────────────────────────
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        session.qrCode = qrDataUrl;
        session.status = "pending";
        await db
          .update(sessionsTable)
          .set({ qrCode: qrDataUrl, status: "pending", updatedAt: new Date() })
          .where(eq(sessionsTable.id, sessionId));
      } catch (err) {
        logger.error({ err, sessionId }, "Failed to generate QR code");
      }
    }

    if (connection === "open") {
      // Successful connection — reset backoff counter and pending timer
      reconnectAttempts.delete(sessionId);
      pendingReconnects.delete(sessionId);
      session.status = "connected";
      session.qrCode = null;
      session.lastHeartbeat = Date.now();
      const phone = socket.user?.id?.split(":")[0] || null;
      session.phone = phone;
      logger.info({ sessionId, phone }, "WhatsApp session connected");

      await db
        .update(sessionsTable)
        .set({ status: "connected", phone, qrCode: null, updatedAt: new Date() })
        .where(eq(sessionsTable.id, sessionId));

      // Start watchdog to detect silent disconnections
      if (session.watchdogTimer) clearInterval(session.watchdogTimer);
      session.watchdogTimer = startWatchdog(sessionId, session);
    }

    if (connection === "close") {
      // Stop watchdog immediately
      if (session.watchdogTimer) {
        clearInterval(session.watchdogTimer);
        session.watchdogTimer = null;
      }

      const boom = lastDisconnect?.error as Boom | undefined;
      const statusCode = boom?.output?.statusCode;
      session.status = "disconnected";
      session.qrCode = null;
      activeSessions.delete(sessionId);

      logger.info({ sessionId, statusCode }, "WhatsApp connection closed");

      await db
        .update(sessionsTable)
        .set({ status: "disconnected", qrCode: null, updatedAt: new Date() })
        .where(eq(sessionsTable.id, sessionId))
        .catch(() => {});

      if (stoppedSessions.has(sessionId)) return;

      if (statusCode && PERMANENT_DISCONNECT_CODES.has(statusCode)) {
        // Clear the now-invalid auth — credentials are no longer valid
        await clearAuthFromDB(sessionId);

        // Check if this session is locked — if so, re-queue it to show a fresh QR
        const [row] = await db.select({ locked: sessionsTable.locked }).from(sessionsTable).where(eq(sessionsTable.id, sessionId)).catch(() => []);
        if (row?.locked) {
          logger.warn({ sessionId, statusCode }, "Locked session disconnected — clearing auth and re-queuing for re-link");
          await db
            .update(sessionsTable)
            .set({ status: "pending", phone: null, qrCode: null, updatedAt: new Date() })
            .where(eq(sessionsTable.id, sessionId))
            .catch(() => {});
          scheduleReconnect(sessionId, 2_000);
          return;
        }

        logger.warn({ sessionId, statusCode }, "Not reconnecting — session ended permanently (logged out or banned)");
        await db
          .update(sessionsTable)
          .set({ status: "disconnected", phone: null, qrCode: null, updatedAt: new Date() })
          .where(eq(sessionsTable.id, sessionId))
          .catch(() => {});
        return;
      }

      if (statusCode && CLEAR_AUTH_CODES.has(statusCode)) {
        logger.warn({ sessionId, statusCode }, "Corrupt session — clearing auth and re-linking");
        await clearAuthFromDB(sessionId);
        await db
          .update(sessionsTable)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(sessionsTable.id, sessionId))
          .catch(() => {});
        // Reconnect immediately to show QR code
        scheduleReconnect(sessionId, 1_000);
        return;
      }

      // For restartRequired, connectionReplaced, timedOut, connectionClosed, etc.:
      // reconnect with a short delay on first attempt
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;
      scheduleReconnect(sessionId, isRestartRequired ? 1_000 : undefined);
    }
  });

  // ── Contact events ──────────────────────────────────────────────────────────
  function upsertContact(c: Contact) {
    session.contacts.set(c.id, c);
    if (c.lid) {
      const lidVal = c.lid.toString().split(":")[0].split("@")[0];
      session.lidToJid.set(lidVal, c.id);
    }
  }

  // Debounced batch-save so bulk contact.set doesn't spam DB
  let contactSaveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleContactSave() {
    if (contactSaveTimer) return;
    contactSaveTimer = setTimeout(async () => {
      contactSaveTimer = null;
      await saveContactsBatch(sessionId, Array.from(session.contacts.values()));
    }, 2000);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket.ev as any).on("contacts.set", ({ contacts }: { contacts: Contact[] }) => {
    for (const c of contacts) upsertContact(c);
    scheduleContactSave();
  });
  socket.ev.on("contacts.upsert", (contacts) => {
    for (const c of contacts) upsertContact(c);
    scheduleContactSave();
  });
  socket.ev.on("contacts.update", (updates) => {
    for (const u of updates) {
      if (!u.id) continue;
      const existing = session.contacts.get(u.id) ?? ({ id: u.id } as Contact);
      upsertContact({ ...existing, ...u } as Contact);
    }
    scheduleContactSave();
  });

  // ── Chat events ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket.ev as any).on("chats.set", ({ chats }: { chats: Array<{ id?: string | null; name?: string | null; unreadCount?: number | null }> }) => {
    for (const chat of chats) {
      if (!chat.id) continue;
      session.chats.set(chat.id, {
        id: chat.id,
        name: chat.name ?? undefined,
        unreadCount: chat.unreadCount ?? 0,
        lastMessage: null,
      });
    }
    saveChatsBatch(sessionId, chats.filter((c) => !!c.id).map((c) => ({ id: c.id!, name: c.name, unreadCount: c.unreadCount ?? 0 }))).catch(() => {});
  });

  socket.ev.on("chats.upsert", (chats) => {
    for (const chat of chats) {
      if (!chat.id) continue;
      const existing = session.chats.get(chat.id);
      session.chats.set(chat.id, {
        id: chat.id,
        name: chat.name ?? existing?.name,
        unreadCount: chat.unreadCount ?? existing?.unreadCount ?? 0,
        lastMessage: existing?.lastMessage ?? null,
      });
      saveChatToDB(sessionId, chat.id, chat.name ?? null, null, chat.unreadCount ?? 0);
    }
  });

  // ── Full history sync ────────────────────────────────────────────────────────
  //
  // Fires repeatedly (newest→oldest) when a device is newly linked.
  // With syncFullHistory=true this delivers ALL messages ever sent/received.
  // Each batch is saved immediately — if the connection drops mid-sync, any
  // already-saved batches remain in the DB and won't be re-downloaded.
  socket.ev.on("messaging-history.set", async ({ chats, contacts, messages, isLatest, progress }) => {
    logger.info(
      { sessionId, chatCount: chats.length, msgCount: messages.length, isLatest, progress },
      "History batch received"
    );

    for (const c of contacts) upsertContact(c);
    if (contacts.length > 0) {
      await saveContactsBatch(sessionId, contacts as Contact[]).catch(() => {});
    }

    for (const chat of chats) {
      if (!chat.id) continue;
      const existing = session.chats.get(chat.id);
      if (!existing) {
        session.chats.set(chat.id, {
          id: chat.id,
          name: chat.name ?? undefined,
          unreadCount: chat.unreadCount ?? 0,
          lastMessage: null,
        });
      }
    }

    if (chats.length > 0) {
      await saveChatsBatch(
        sessionId,
        chats.filter((c) => !!c.id).map((c) => ({ id: c.id!, name: c.name, unreadCount: c.unreadCount ?? 0 }))
      ).catch(() => {});
    }

    // Keep raw proto in memory for media; persist text to DB
    for (const msg of messages) {
      const chatId = msg.key.remoteJid;
      if (!chatId) continue;
      const existing = session.messages.get(chatId) ?? [];
      existing.push(msg);
      session.messages.set(chatId, existing);
    }

    if (messages.length > 0) {
      await saveMessagesBatch(sessionId, messages).catch(() => {});

      // Update each chat's lastMessage from this batch
      const latestByChat = new Map<string, proto.IWebMessageInfo>();
      for (const msg of messages) {
        const chatId = msg.key.remoteJid;
        if (!chatId || chatId === "status@broadcast" || chatId.endsWith("@broadcast")) continue;
        const existing = latestByChat.get(chatId);
        if (!existing || Number(msg.messageTimestamp) > Number(existing.messageTimestamp)) {
          latestByChat.set(chatId, msg);
        }
      }
      for (const [chatId, msg] of latestByChat) {
        saveChatToDB(sessionId, chatId, undefined, msg, undefined);
      }
    }

    if (isLatest) {
      logger.info({ sessionId }, "Full history sync complete — all messages saved to DB");
    }
  });

  // ── Real-time message events ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket.ev as any).on("messages.set", ({ messages: msgs }: { messages: proto.IWebMessageInfo[] }) => {
    for (const msg of msgs) {
      const chatId = msg.key?.remoteJid;
      if (!chatId) continue;
      const existing = session.messages.get(chatId) ?? [];
      existing.push(msg);
      session.messages.set(chatId, existing);
      const chat = session.chats.get(chatId);
      if (chat) chat.lastMessage = msg;
      saveMessageToDB(sessionId, chatId, msg);
    }
  });

  socket.ev.on("messages.upsert", ({ messages: msgs }) => {
    for (const msg of msgs) {
      const chatId = msg.key.remoteJid;
      if (!chatId) continue;

      // Update heartbeat on any incoming message
      session.lastHeartbeat = Date.now();

      const existing = session.messages.get(chatId) ?? [];
      existing.push(msg);
      session.messages.set(chatId, existing);
      saveMessageToDB(sessionId, chatId, msg);

      if (chatId === "status@broadcast") continue;

      let chat = session.chats.get(chatId);
      if (!chat) {
        const isGroup = chatId.endsWith("@g.us");
        const name =
          !msg.key.fromMe && msg.pushName
            ? msg.pushName
            : isGroup
            ? "Group"
            : chatId.split("@")[0];
        chat = { id: chatId, name, unreadCount: msg.key.fromMe ? 0 : 1, lastMessage: msg };
        session.chats.set(chatId, chat);
      } else {
        if (!msg.key.fromMe && msg.pushName && !chat.name) chat.name = msg.pushName;
        chat.lastMessage = msg;
        if (!msg.key.fromMe) chat.unreadCount = (chat.unreadCount ?? 0) + 1;
      }
      saveChatToDB(sessionId, chatId, chat.name, msg, chat.unreadCount);
      broadcastSse(sessionId, "message", { chatId });
      broadcastSse(sessionId, "chat", { chatId });
    }
  });
}

export async function stopSession(sessionId: string): Promise<void> {
  // Mark as permanently stopped so reconnect logic never fires
  stoppedSessions.add(sessionId);
  reconnectAttempts.delete(sessionId);

  const session = activeSessions.get(sessionId);
  if (session) {
    if (session.watchdogTimer) {
      clearInterval(session.watchdogTimer);
      session.watchdogTimer = null;
    }
    try { await session.socket.logout(); } catch { /* ignore */ }
    try { session.socket.end(undefined); } catch { /* ignore */ }
    activeSessions.delete(sessionId);
  }

  await clearAuthFromDB(sessionId);
  await db.delete(chatsTable).where(eq(chatsTable.sessionId, sessionId)).catch(() => {});
  await db.delete(messagesTable).where(eq(messagesTable.sessionId, sessionId)).catch(() => {});
  await db.delete(contactsTable).where(eq(contactsTable.sessionId, sessionId)).catch(() => {});
  const mediaCacheDir = path.join(MEDIA_CACHE_DIR, sessionId);
  if (fs.existsSync(mediaCacheDir)) fs.rmSync(mediaCacheDir, { recursive: true, force: true });
}

export function getSessionStatus(sessionId: string): {
  status: "pending" | "connected" | "disconnected";
  qrCode: string | null;
  pairingCode: string | null;
  phone: string | null;
} {
  const session = activeSessions.get(sessionId);
  if (!session) return { status: "disconnected", qrCode: null, pairingCode: null, phone: null };
  return {
    status: session.status,
    qrCode: session.qrCode,
    pairingCode: session.pairingCode,
    phone: session.phone,
  };
}

export async function requestPairingCode(
  sessionId: string,
  phoneNumber: string
): Promise<string | null> {
  // Close any existing socket so we can start fresh — requestPairingCode must
  // be called before WhatsApp sends the first QR event, and the only reliable
  // way to guarantee that ordering is to restart the socket here.
  const existing = activeSessions.get(sessionId);
  if (existing) {
    try { existing.socket.end(undefined); } catch { /* */ }
    if (existing.watchdogTimer) clearInterval(existing.watchdogTimer);
    activeSessions.delete(sessionId);
  }
  stoppedSessions.delete(sessionId);
  reconnectAttempts.delete(sessionId);

  // Fresh socket with all event handlers via startSession
  await startSession(sessionId);

  // Give the socket ~800 ms to connect to WA servers, then call requestPairingCode
  // before the server has a chance to emit the QR event (~1-2 s after connect).
  await new Promise<void>((r) => setTimeout(r, 800));

  const session = activeSessions.get(sessionId);
  if (!session) return null;

  try {
    const code = await session.socket.requestPairingCode(phoneNumber);
    const formatted = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
    session.pairingCode = formatted;
    return formatted;
  } catch (err) {
    logger.error({ err, sessionId }, "Failed to request pairing code");
    return null;
  }
}

// ── Contact name resolution ───────────────────────────────────────────────────

function resolveContactInfo(
  chatId: string,
  chatName: string | undefined | null,
  session: ActiveSession | null
): { name: string; phone: string | null } {
  const isGroup = chatId.endsWith("@g.us");
  const isLid = chatId.endsWith("@lid");

  if (isGroup) return { name: chatName ?? "Group", phone: null };

  let resolvedJid: string | null = null;
  if (isLid) {
    const lidVal = chatId.split(":")[0].split("@")[0];
    resolvedJid = session?.lidToJid.get(lidVal) ?? null;
  } else {
    resolvedJid = chatId;
  }

  const contact = session
    ? ((resolvedJid ? session.contacts.get(resolvedJid) : null) ??
       session.contacts.get(chatId) ??
       null)
    : null;

  const phone = resolvedJid
    ? resolvedJid.split(":")[0].split("@")[0]
    : isLid
    ? null
    : chatId.split("@")[0];

  const name =
    contact?.name ||
    contact?.verifiedName ||
    chatName ||
    contact?.notify ||
    phone ||
    chatId.split("@")[0];

  return { name, phone };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getChats(sessionId: string): Promise<ChatInfo[]> {
  const session = activeSessions.get(sessionId) ?? null;

  const dbChats = await db
    .select()
    .from(chatsTable)
    .where(eq(chatsTable.sessionId, sessionId));

  const resultMap = new Map<string, ChatInfo>();

  for (const dbChat of dbChats) {
    if (dbChat.chatId === "status@broadcast" || dbChat.chatId.endsWith("@broadcast")) continue;
    const { name, phone } = resolveContactInfo(dbChat.chatId, dbChat.name, session);
    resultMap.set(dbChat.chatId, {
      id: dbChat.chatId,
      name,
      phone,
      lastMessage: dbChat.lastMessage,
      lastMessageTime: dbChat.lastMessageTime?.toISOString() ?? null,
      unreadCount: 0,
      isGroup: dbChat.isGroup,
      profilePicture: null,
    });
  }

  if (session) {
    for (const [chatId, chat] of session.chats) {
      if (chatId === "status@broadcast" || chatId.endsWith("@broadcast")) continue;
      const { name, phone } = resolveContactInfo(chatId, chat.name, session);

      let lastMessage: string | null = null;
      let lastMessageTime: string | null = null;

      if (chat.lastMessage) {
        lastMessage = extractMessageText(chat.lastMessage);
        lastMessageTime = chat.lastMessage.messageTimestamp
          ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
          : null;
      } else {
        const dbEntry = resultMap.get(chatId);
        if (dbEntry) {
          lastMessage = dbEntry.lastMessage;
          lastMessageTime = dbEntry.lastMessageTime;
        }
      }

      resultMap.set(chatId, {
        id: chatId,
        name,
        phone,
        lastMessage,
        lastMessageTime,
        unreadCount: chat.unreadCount ?? 0,
        isGroup: chatId.endsWith("@g.us"),
        profilePicture: null,
      });
    }
  }

  return Array.from(resultMap.values()).sort((a, b) => {
    if (!a.lastMessageTime && !b.lastMessageTime) return 0;
    if (!a.lastMessageTime) return 1;
    if (!b.lastMessageTime) return -1;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });
}

export async function getMessages(
  sessionId: string,
  chatId: string,
  limit = 50,
  before?: string
): Promise<MessageInfo[]> {
  const conditions: Parameters<typeof and>[0][] = [
    eq(messagesTable.sessionId, sessionId),
    eq(messagesTable.chatId, chatId),
  ];

  if (before) {
    const [pivot] = await db
      .select({ ts: messagesTable.timestamp })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.sessionId, sessionId),
          eq(messagesTable.messageId, before)
        )
      )
      .limit(1);
    if (pivot) conditions.push(lt(messagesTable.timestamp, pivot.ts));
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(and(...conditions))
    .orderBy(desc(messagesTable.timestamp))
    .limit(limit);

  return rows.reverse().map((m: typeof rows[number]) => ({
    id: m.messageId,
    body: m.body,
    fromMe: m.fromMe,
    timestamp: m.timestamp,
    senderName: m.senderName,
    type: m.type as MessageInfo["type"],
  }));
}

export async function sendMessage(
  sessionId: string,
  chatId: string,
  text: string
): Promise<MessageInfo | null> {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== "connected") return null;

  const sent = await session.socket.sendMessage(chatId, { text });
  if (!sent) return null;

  if (sent.key.id) {
    saveMessageToDB(sessionId, chatId, sent);
    saveChatToDB(sessionId, chatId, undefined, sent, 0);
  }

  return {
    id: sent.key.id || "",
    body: text,
    fromMe: true,
    timestamp: Number(sent.messageTimestamp) || Math.floor(Date.now() / 1000),
    senderName: null,
    type: "text",
  };
}

export async function sendVoiceNote(
  sessionId: string,
  chatId: string,
  audioBase64: string,
  mimetype: string
): Promise<MessageInfo | null> {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== "connected") return null;

  const audioBuffer = Buffer.from(audioBase64, "base64");

  const sent = await session.socket.sendMessage(chatId, {
    audio: audioBuffer,
    mimetype: mimetype || "audio/ogg; codecs=opus",
    ptt: true,
  });

  if (!sent) return null;

  if (sent.key.id) {
    saveMessageToDB(sessionId, chatId, sent);
    saveChatToDB(sessionId, chatId, undefined, sent, 0);
  }

  return {
    id: sent.key.id || "",
    body: "[Voice Note]",
    fromMe: true,
    timestamp: Number(sent.messageTimestamp) || Math.floor(Date.now() / 1000),
    senderName: null,
    type: "audio",
  };
}

export async function getStatuses(
  sessionId: string,
  fromMe?: boolean
): Promise<StatusInfo[]> {
  const session = activeSessions.get(sessionId);
  if (!session) return [];

  const statusMsgs = session.messages.get("status@broadcast") ?? [];
  const filtered =
    fromMe !== undefined
      ? statusMsgs.filter((m) => (m.key?.fromMe ?? false) === fromMe)
      : statusMsgs.filter((m) => !m.key?.fromMe);

  const byParticipant = new Map<string, proto.IWebMessageInfo[]>();
  for (const msg of filtered) {
    const participant = msg.key?.participant || msg.key?.remoteJid || "";
    if (!participant) continue;
    const arr = byParticipant.get(participant) ?? [];
    arr.push(msg);
    byParticipant.set(participant, arr);
  }

  const result: StatusInfo[] = [];
  for (const [participant, msgs] of byParticipant) {
    msgs.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp));
    for (const msg of msgs) {
      result.push({
        id: msg.key?.id || "",
        messageId: msg.key?.id || "",
        participantJid: participant,
        participantName: msg.pushName || null,
        type: getMessageType(msg),
        body: extractMessageText(msg),
        timestamp: Number(msg.messageTimestamp) || 0,
      });
    }
  }

  const latestByParticipant = new Map<string, number>();
  for (const s of result) {
    const cur = latestByParticipant.get(s.participantJid) ?? 0;
    if (s.timestamp > cur) latestByParticipant.set(s.participantJid, s.timestamp);
  }
  result.sort(
    (a, b) =>
      (latestByParticipant.get(b.participantJid) ?? 0) -
      (latestByParticipant.get(a.participantJid) ?? 0)
  );
  return result;
}

export async function downloadMedia(
  sessionId: string,
  chatId: string,
  messageId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // ── 1. Check disk cache first ───────────────────────────────────────────────
  const cacheBase = mediaCachePath(sessionId, messageId);
  const existing = fs.readdirSync(path.dirname(cacheBase))
    .find((f) => f.startsWith(path.basename(cacheBase) + "."));
  if (existing) {
    const ext = existing.split(".").pop() ?? "bin";
    const extToMime: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
      gif: "image/gif", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4",
      mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", bin: "application/octet-stream",
    };
    const mimeType = extToMime[ext] ?? "application/octet-stream";
    const buffer = fs.readFileSync(path.join(path.dirname(cacheBase), existing));
    return { buffer, mimeType };
  }

  // ── 2. Find the raw proto — in-memory first, then DB ───────────────────────
  const session = activeSessions.get(sessionId) ?? null;
  let rawMsg: proto.IWebMessageInfo | null = null;

  if (session) {
    const msgs = session.messages.get(chatId) ?? [];
    rawMsg = msgs.find((m) => m.key?.id === messageId) ?? null;
  }

  if (!rawMsg) {
    const [row] = await db
      .select({ rawMessage: messagesTable.rawMessage })
      .from(messagesTable)
      .where(and(eq(messagesTable.sessionId, sessionId), eq(messagesTable.messageId, messageId)))
      .limit(1)
      .catch(() => []);
    if (row?.rawMessage) {
      try { rawMsg = JSON.parse(row.rawMessage) as proto.IWebMessageInfo; } catch { /* ignore */ }
    }
  }

  if (!rawMsg?.message) return null;

  const message = rawMsg.message;
  let mimeType = "application/octet-stream";

  if (message.imageMessage) mimeType = message.imageMessage.mimetype ?? "image/jpeg";
  else if (message.videoMessage) mimeType = message.videoMessage.mimetype ?? "video/mp4";
  else if (message.audioMessage) mimeType = (message.audioMessage.mimetype ?? "audio/ogg").split(";")[0].trim();
  else if (message.documentMessage) mimeType = message.documentMessage.mimetype ?? "application/octet-stream";
  else if (message.stickerMessage) mimeType = message.stickerMessage.mimetype ?? "image/webp";
  else return null;

  // ── 3. Download and cache to disk ──────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await downloadMediaMessage(rawMsg as any, "buffer", {});
    const buffer = stream as Buffer;
    const ext = mimeToExt(mimeType);
    fs.writeFileSync(`${cacheBase}.${ext}`, buffer);
    return { buffer, mimeType };
  } catch (err) {
    logger.error({ err, sessionId, chatId, messageId }, "Failed to download media");
    return null;
  }
}

/**
 * Manually trigger a reconnect for a session that is currently disconnected.
 * Clears the stoppedSessions guard so it can reconnect, then calls startSession.
 */
export async function reconnectSession(sessionId: string): Promise<void> {
  // Remove from stopped set so reconnect logic can fire
  stoppedSessions.delete(sessionId);
  // Reset backoff so the first attempt is fast
  reconnectAttempts.delete(sessionId);

  await db
    .update(sessionsTable)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId))
    .catch(() => {});

  await startSession(sessionId);
}

// ── Global session health check ────────────────────────────────────────────────
// Runs every 90 seconds. Finds sessions that have credentials in the DB but are
// not currently active (not connecting, not stopping), and revives them.
// This is the last-resort safety net for sessions that fell through the cracks.

async function runHealthCheck(): Promise<void> {
  try {
    const sessions = await db
      .select({ id: sessionsTable.id, authData: sessionsTable.authData })
      .from(sessionsTable);

    for (const session of sessions) {
      // Skip permanently stopped sessions
      if (stoppedSessions.has(session.id)) continue;
      // Skip sessions already active (pending or connected)
      if (activeSessions.has(session.id)) continue;
      // Skip sessions with a reconnect already queued
      if (pendingReconnects.has(session.id)) continue;
      // Only reconnect sessions that have saved credentials (i.e. have been linked before)
      if (!session.authData) continue;

      logger.info({ sessionId: session.id }, "Health check: reviving inactive linked session");
      // Reset backoff so health-check-triggered reconnects are fast
      reconnectAttempts.delete(session.id);
      startSession(session.id).catch((err) => {
        logger.error({ err, sessionId: session.id }, "Health check reconnect failed");
      });
    }
  } catch (err) {
    logger.error({ err }, "Session health check failed");
  }
}

// Start the health check loop after a short boot delay so restoreAllSessions runs first
setTimeout(() => {
  setInterval(runHealthCheck, 90_000);
}, 30_000);

export async function restoreAllSessions(): Promise<void> {
  try {
    const sessions = await db.select().from(sessionsTable);
    for (const session of sessions) {
      // A session is restorable if it has saved auth data in the DB,
      // or if it was pending (not yet linked — show QR again)
      const hasAuth = session.authData !== null;
      const shouldRestore =
        session.status === "connected" ||
        session.status === "pending" ||
        (session.status === "disconnected" && hasAuth);

      if (shouldRestore) {
        await db
          .update(sessionsTable)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(sessionsTable.id, session.id))
          .catch(() => {});

        await startSession(session.id).catch((err) => {
          logger.error({ err, sessionId: session.id }, "Failed to restore session");
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to restore sessions");
  }
}
