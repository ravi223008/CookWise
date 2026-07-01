import app from "./app";
import { logger } from "./lib/logger";

// ── Port validation ───────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Optional env warnings ─────────────────────────────────────────────────────
if (!process.env["OPENAI_API_KEY"]) {
  logger.warn(
    "OPENAI_API_KEY is not set — AI meal recommendations will use built-in fallback data",
  );
}
if (!process.env["YOUTUBE_API_KEY"]) {
  logger.warn(
    "YOUTUBE_API_KEY is not set — YouTube recipe video links will be disabled",
  );
}

// ── Process-level safety nets ─────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — shutting down");
  process.exit(1);
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
