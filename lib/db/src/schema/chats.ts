import { pgTable, text, boolean, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const chatsTable = pgTable(
  "chats",
  {
    sessionId: text("session_id").notNull(),
    chatId: text("chat_id").notNull(),
    name: text("name"),
    phone: text("phone"),
    isGroup: boolean("is_group").notNull().default(false),
    lastMessage: text("last_message"),
    lastMessageTime: timestamp("last_message_time", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.chatId] })]
);

export type Chat = typeof chatsTable.$inferSelect;
export type InsertChat = typeof chatsTable.$inferInsert;
