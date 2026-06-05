import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { usersTable, userSessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const router = Router();

const MASTER_PASSKEY = process.env.MASTER_PASSKEY || "150051";
const MASTER_USER_ID = "__master__";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashPasskey(passkey: string, salt: string): string {
  return createHash("sha256").update(salt + passkey).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function createSessionToken(userId: string): Promise<string> {
  // Clean up expired tokens first
  await db.delete(userSessionsTable).where(lt(userSessionsTable.expiresAt, new Date())).catch(() => {});

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(userSessionsTable).values({ token, userId, expiresAt });
  return token;
}

export async function verifyToken(token: string): Promise<{ userId: string; isMaster: boolean } | null> {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.token, token))
    .catch(() => []);
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(userSessionsTable).where(eq(userSessionsTable.token, token)).catch(() => {});
    return null;
  }
  return { userId: row.userId, isMaster: row.userId === MASTER_USER_ID };
}

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  const { username, passkey } = req.body;
  if (!passkey || typeof passkey !== "string") {
    res.status(400).json({ error: "passkey is required" });
    return;
  }

  // Master passkey — always works regardless of username
  if (passkey === MASTER_PASSKEY) {
    const token = await createSessionToken(MASTER_USER_ID);
    res.json({ token, isMaster: true, username: "Master", userId: MASTER_USER_ID });
    return;
  }

  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim().toLowerCase()))
    .catch(() => []);

  if (!user) {
    res.status(401).json({ error: "Invalid username or passkey" });
    return;
  }

  const expected = hashPasskey(passkey, user.salt);
  if (expected !== user.passkeyHash) {
    res.status(401).json({ error: "Invalid username or passkey" });
    return;
  }

  const token = await createSessionToken(user.id);
  res.json({ token, isMaster: false, username: user.username, userId: user.id });
});

// POST /auth/signup
router.post("/auth/signup", async (req, res) => {
  const { username, passkey } = req.body;
  if (!username || typeof username !== "string" || username.trim().length < 2) {
    res.status(400).json({ error: "Username must be at least 2 characters" });
    return;
  }
  if (!passkey || typeof passkey !== "string" || passkey.length < 4) {
    res.status(400).json({ error: "Passkey must be at least 4 characters" });
    return;
  }

  // Prevent using the master passkey as a user passkey
  if (passkey === MASTER_PASSKEY) {
    res.status(400).json({ error: "That passkey is reserved" });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, cleanUsername))
    .catch(() => []);

  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const salt = randomBytes(16).toString("hex");
  const passkeyHash = hashPasskey(passkey, salt);
  const id = uuidv4();

  await db.insert(usersTable).values({ id, username: cleanUsername, passkeyHash, salt });
  const token = await createSessionToken(id);
  res.status(201).json({ token, isMaster: false, username: cleanUsername, userId: id });
});

// GET /auth/me
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const session = await verifyToken(token);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (session.isMaster) {
    res.json({ userId: MASTER_USER_ID, username: "Master", isMaster: true });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .catch(() => []);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({ userId: user.id, username: user.username, isMaster: false });
});

// GET /auth/users — returns all app users with their session counts (master use)
router.get("/auth/users", async (req, res) => {
  const { usersTable: ut, userSessionsTable: ust } = await import("@workspace/db");
  const users = await db
    .select({ id: ut.id, username: ut.username, createdAt: ut.createdAt })
    .from(ut)
    .catch(() => []);

  // Count sessions per user from the sessions table
  const { sessionsTable } = await import("@workspace/db");
  const allSessions = await db.select({ id: sessionsTable.id, userId: sessionsTable.userId, status: sessionsTable.status }).from(sessionsTable).catch(() => [] as Array<{ id: string; userId: string | null; status: string }>);

  const result = users.map((u) => {
    const userSessions = allSessions.filter((s) => s.userId === u.id);
    const connectedCount = userSessions.filter((s) => s.status === "connected").length;
    return {
      id: u.id,
      username: u.username,
      sessionCount: userSessions.length,
      connectedCount,
      createdAt: u.createdAt.toISOString(),
    };
  });

  res.json(result);
});

// POST /auth/logout
router.post("/auth/logout", async (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    await db.delete(userSessionsTable).where(eq(userSessionsTable.token, token)).catch(() => {});
  }
  res.json({ success: true });
});

export default router;
