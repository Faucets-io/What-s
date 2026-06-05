import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";

export const authKeysTable = pgTable(
  "auth_keys",
  {
    sessionId: text("session_id").notNull(),
    keyType: text("key_type").notNull(),
    keyId: text("key_id").notNull(),
    keyData: text("key_data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.keyType, t.keyId] })],
);
