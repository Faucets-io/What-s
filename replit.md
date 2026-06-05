# WhatsApp Monitor

## Overview

Mobile-first WhatsApp monitoring web app. Link multiple WhatsApp accounts via QR or phone pairing code, view all chats, full conversation history with media rendering, status viewing, and replying.

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React + Vite + Tailwind CSS (`artifacts/whatsapp-monitor` at `/`)
- **Backend**: Express 5 (`artifacts/api-server` at `/api`)
- **WhatsApp**: @whiskeysockets/baileys v7.0.0-rc.9
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Architecture

### WhatsApp Sessions (`artifacts/api-server/src/lib/whatsapp-manager.ts`)

- Sessions stored in PostgreSQL (`sessionsTable`) and auth files on disk (`whatsapp-sessions/`)
- Each session has in-memory Maps for chats, messages, contacts, lidToJid
- **Full history sync**: `syncFullHistory: true` — when a device is newly linked, WhatsApp sends ALL past messages through `messaging-history.set` events (batched to DB in chunks of 200)
- **Keep-alive**: `keepAliveIntervalMs: 25_000` pings WhatsApp every 25s
- **Watchdog**: 30s interval checks `ws.readyState`; if not OPEN while "connected", forces reconnect
- **Exponential backoff reconnect**: 2s → 4s → 8s … 60s cap; retries forever for transient errors
- **Permanent disconnect**: codes 401 (loggedOut) and 403 (forbidden) stop reconnect, clear auth files so user can re-link fresh
- **stoppedSessions Set**: tracks explicitly deleted sessions so they never reconnect
- **reconnectSession()**: manually re-enables a session (clears stoppedSessions guard)

### Disconnect Reason Handling

| Code | Reason | Action |
|------|--------|--------|
| 401 | loggedOut | Clear auth files, mark disconnected, no reconnect |
| 403 | forbidden | Clear auth files, mark disconnected, no reconnect |
| 500 | badSession | Clear auth files, reconnect immediately (shows fresh QR) |
| 515 | restartRequired | Reconnect with 1s delay |
| All others | timedOut, connectionClosed, etc. | Exponential backoff reconnect |

### Database Schema

- `sessionsTable` — session CRUD (id, name, phone, status, qrCode, authData)
- `chatsTable` — composite PK (sessionId + chatId), stores lastMessage, unreadCount
- `messagesTable` — unique on (sessionId + messageId), stores body, type, timestamp, senderName

### Conversation History

- `getMessages()` reads from DB with cursor pagination (`before` param using timestamp pivot)
- `ConversationPage.tsx` shows last 50 messages + "Load older messages" button that prepends with scroll preservation
- Date separators (Today, Yesterday, full date) inserted between messages

## Deployment (Render)

Files created for deploying to Render:
- `Dockerfile` — multi-stage build: deps → builder (frontend + API) → runner (prod)
- `render.yaml` — one web service (Docker) + managed PostgreSQL + 10GB persistent disk
- `.dockerignore` — excludes node_modules, dist, sessions, git, etc.

### How it works in production

The API server (`artifacts/api-server`) serves:
1. `/api/*` — all API routes
2. `/*` — React frontend static files from `artifacts/whatsapp-monitor/dist/public`

This single-service approach avoids CORS and simplifies deployment.

### Deploy steps

1. Push to GitHub
2. Create a Render "Blueprint" pointing to `render.yaml`
3. Add `SESSION_SECRET` env var (or let Render generate it)
4. Mount a 10GB disk at `/app/artifacts/api-server/whatsapp-sessions`
5. After deploy, link WhatsApp accounts through the UI

## Full History Sync — How It Works

WhatsApp's protocol only sends full history **during initial device linking**. Once a device is linked:
- `messaging-history.set` fires multiple times (newest→oldest batches)
- Each batch is saved to DB immediately (survives disconnects mid-sync)
- `isLatest: true` signals the full dump is complete
- After that, only new messages arrive in real-time

**To get full history from day 1:** tap the Re-link button (↺) next to a disconnected account, or add a new account and scan the QR code. WhatsApp will send everything.
