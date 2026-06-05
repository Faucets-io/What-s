import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { restoreAllSessions } from "./lib/whatsapp-manager";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production (Docker / Render), serve the built frontend from the same server.
// This avoids CORS issues and means one service handles everything.
if (process.env.NODE_ENV === "production") {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  // The frontend build output lands at artifacts/whatsapp-monitor/dist/public
  // relative to the workspace root. From artifacts/api-server/dist/ we go up 3 levels.
  const frontendDir = path.resolve(thisDir, "../../../artifacts/whatsapp-monitor/dist/public");

  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    // SPA fallback: any non-/api path returns index.html
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDir, "index.html"));
    });
    logger.info({ frontendDir }, "Serving frontend static files");
  } else {
    logger.warn({ frontendDir }, "Frontend dist not found — skipping static serving");
  }
}

restoreAllSessions().catch((err) => {
  logger.error({ err }, "Failed to restore WhatsApp sessions on startup");
});

export default app;
