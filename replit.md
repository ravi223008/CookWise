# CookWise

An AI-powered meal planning mobile app that recommends recipes, scans receipts to update your pantry, and manages shopping lists.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/cookwise run dev` — run the Expo mobile app (port 19983)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to the dev database (dev only)

## Required Secrets

- `DATABASE_URL` — Postgres connection string (Replit-managed, auto-provided)
- `OPENAI_API_KEY` — for AI meal suggestions
- `YOUTUBE_API_KEY` — for YouTube recipe video integration

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- **Mobile:** Expo (React Native), Expo Router, React 19, TanStack Query, Zod
- **API:** Express 5
- **DB:** PostgreSQL + Drizzle ORM
- **AI/External:** OpenAI SDK, YouTube Data API
- **API codegen:** Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- **Build:** esbuild (CJS bundle for API server)

## Where things live

- `artifacts/cookwise/` — Expo mobile app; entry at `app/_layout.tsx`
- `artifacts/api-server/` — Express API server; entry at `src/index.ts`
- `artifacts/mockup-sandbox/` — Vite + Radix UI sandbox for UI prototyping
- `lib/db/` — Drizzle ORM schema (source of truth: `src/schema/index.ts`)
- `lib/api-spec/` — OpenAPI spec (`openapi.yaml`) — source of truth for API contracts
- `lib/api-zod/` — Zod schemas generated from the OpenAPI spec
- `lib/api-client-react/` — TanStack Query hooks generated from the OpenAPI spec

## Architecture decisions

- API contracts are code-generated: edit `lib/api-spec/openapi.yaml`, then run `codegen` — never hand-edit `lib/api-client-react/` or `lib/api-zod/`
- Database schema lives in `lib/db/src/schema/index.ts`; push changes with `pnpm --filter @workspace/db run push`
- All API route inputs are validated with Zod (`RecommendSchema`, `WeeklyPlanSchema` in `routes/meals.ts`) — always parse with `.safeParse()`, never cast `req.body`
- Rate limiting uses two tiers: 200 req/15min general + 30 req/15min on LLM endpoints (`/meals/recommend`, `/meals/weekly-plan`) for cost control
- `app.set("trust proxy", 1)` is set so rate limiting works correctly behind Replit's reverse proxy
- Error handler returns sanitised messages in production, full messages in development
- Dark mode: both `light` and `dark` palettes are defined in `constants/colors.ts`; `useColors()` switches automatically based on device setting

## Gotchas

- Run `pnpm install` from the workspace root after pulling changes that modify `pnpm-lock.yaml`
- Any change to the OpenAPI spec requires running `pnpm --filter @workspace/api-spec run codegen` to keep generated types in sync
- `@react-native-community/netinfo` must stay at `11.4.1` — Expo 54 does not support v12

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
