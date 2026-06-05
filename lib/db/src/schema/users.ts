import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("app_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passkeyHash: text("passkey_hash").notNull(),
  salt: text("salt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSessionsTable = pgTable("app_user_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AppUser = typeof usersTable.$inferSelect;
export type UserSession = typeof userSessionsTable.$inferSelect;
