import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const contactsTable = pgTable(
  "contacts",
  {
    sessionId: text("session_id").notNull(),
    jid: text("jid").notNull(),
    name: text("name"),
    verifiedName: text("verified_name"),
    notify: text("notify"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.jid] })]
);

export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = typeof contactsTable.$inferInsert;
