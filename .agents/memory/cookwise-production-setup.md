---
name: CookWise production-readiness constraints
description: Hard-won constraints and decisions from the production-readiness pass on CookWise (API server + Expo mobile app).
---

## Netinfo version lock
`@react-native-community/netinfo` must stay at **11.4.1** for Expo SDK 54 / React Native 0.81.5. v12 installs but triggers an Expo compatibility warning and may behave unexpectedly in Expo Go.

**Why:** Expo SDK 54 pins this package to 11.4.1 in its peer dependency table.

**How to apply:** When upgrading Expo, check the new SDK's expected netinfo version before bumping.

## Trust proxy required for rate limiting
`app.set("trust proxy", 1)` must be set **before** any `express-rate-limit` middleware in `app.ts`.

**Why:** Replit (and most PaaS) sits behind a reverse proxy. Without trust proxy, `req.ip` resolves to the proxy address and all users share one rate-limit bucket — causing incorrect throttling and DoS risk.

**How to apply:** Any time rate limiting is added or reconfigured, verify trust proxy is set first in middleware order.

## Error message policy
Global error handler in `app.ts` gates message detail on `NODE_ENV`: production returns generic messages for 5xx, development returns `err.message`. 4xx messages (validation errors) are always returned verbatim since they're client-safe.

## Dark mode color key
Both `light` and `dark` palettes live in `constants/colors.ts`. The `useColors()` hook in `hooks/useColors.ts` returns `colors.dark` directly (type `typeof colors.light`) — no unsafe cast needed.

## Zod validation pattern for Express routes
Use `Schema.safeParse(req.body)` and return 400 with `{ error, details: parsed.error.flatten() }` on failure. Pass errors to `next(err)` rather than throwing, so the global error handler catches them. Both meal routes (`/recommend`, `/weekly-plan`) follow this pattern.
