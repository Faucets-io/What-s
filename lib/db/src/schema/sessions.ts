import { pgTable, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionStatusEnum = pgEnum("session_status", ["pending", "connected", "disconnected"]);

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  status: sessionStatusEnum("status").notNull().default("pending"),
  qrCode: text("qr_code"),
  authData: text("auth_data"),
  locked: boolean("locked").notNull().default(false),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
