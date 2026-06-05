import { pgTable, text, boolean, bigint, timestamp, serial, unique } from "drizzle-orm/pg-core";

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    chatId: text("chat_id").notNull(),
    messageId: text("message_id").notNull(),
    fromMe: boolean("from_me").notNull().default(false),
    body: text("body").notNull().default(""),
    type: text("type").notNull().default("text"),
    timestamp: bigint("timestamp", { mode: "number" }).notNull().default(0),
    senderName: text("sender_name"),
    rawMessage: text("raw_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("messages_session_message_unique").on(t.sessionId, t.messageId)]
);

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
