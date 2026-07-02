import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Proxy trust ───────────────────────────────────────────────────────────────
// Replit (and most PaaS hosts) sit behind a reverse proxy. This tells Express
// to trust the X-Forwarded-For header so rate-limiters see real client IPs
// instead of collapsing all users to the same proxy address.
app.set("trust proxy", 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Must come before helmet so CORS headers are present on all responses,
// including preflight OPTIONS. helmet's crossOriginResourcePolicy would
// otherwise block cross-origin fetches from the Expo web client.
app.use(cors());

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow cross-origin fetches (Expo web app is on a different subdomain).
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // CSP disabled for the API — it serves JSON, not HTML pages.
    contentSecurityPolicy: false,
  }),
);

// ── Request logging ───────────────────────────────────────────────────────────
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

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Stricter limit for LLM endpoints — controls OpenAI cost
const llmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please wait a moment before trying again." },
});

app.use(generalLimiter);
app.use("/api/meals/recommend", llmLimiter);
app.use("/api/meals/weekly-plan", llmLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────────────────
// Must be defined after routes. The unused `_next` is required by Express to
// recognise this as a 4-arity error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof (err as any)?.status === "number"
      ? (err as any).status
      : typeof (err as any)?.statusCode === "number"
        ? (err as any).statusCode
        : 500;

  // In production, hide internal error details to avoid information disclosure.
  // In development, surface the real message for faster debugging.
  const message =
    process.env["NODE_ENV"] === "production"
      ? status < 500
        ? (err instanceof Error ? err.message : "Bad request")
        : "An unexpected error occurred"
      : err instanceof Error
        ? err.message
        : "An unexpected error occurred";

  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  res.status(status).json({ error: message });
});

export default app;
