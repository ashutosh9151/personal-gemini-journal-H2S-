# Personal Gemini Journal

An authenticated Gemini journaling space with Firebase Auth, Firestore isolation, and private Insight Cards.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/personal-gemini-journal run dev` — run the journal web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Server env: `GEMINI_API_KEY` from Google Secret Manager and Firebase Application Default Credentials
- Web env: `VITE_FIREBASE_*` public Firebase web configuration values

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/personal-gemini-journal` — React/Vite app and journal experience
- `artifacts/api-server/src/lib/firebase.ts` — Firebase Admin initialization
- `artifacts/api-server/src/lib/journal-store.ts` — user-scoped Firestore repository
- `artifacts/api-server/src/lib/gemini.ts` — server-only Gemini client
- `artifacts/api-server/src/middlewares/firebase-auth.ts` — Firebase ID token verification
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `firestore.rules` — defense-in-depth Firestore client isolation
- `docs/AI_STUDIO_CUSTOM_INSTRUCTIONS.md` — paste-ready security constitution
- `README.md` — local setup, Cloud Run deployment, and submission checklist

## Architecture decisions

- Firebase Admin verifies the bearer ID token on every private route; the client never chooses an owner ID.
- Firestore records live under `users/{uid}/...`; Admin SDK access still uses the same user-scoped paths.
- Gemini is only called from the API server, with its key injected by Cloud Run Secret Manager.
- The included container serves the built web app and `/api` together for a single Cloud Run service.
- Insight Cards are the original enhancement: private, tagged, open/done takeaways saved from any Gemini response.

## Product

Users sign in with Firebase, create private journals, continue multi-turn Gemini conversations, save useful model responses as Insight Cards, and manage their own data.

## Gotchas

- `PORT` and `BASE_PATH` are supplied by the managed web workflow; ad hoc Vite builds need them explicitly.
- `GEMINI_API_KEY` must never be exposed as a `VITE_` variable or bundled into the browser.
- Firestore rules must be deployed from the root `firestore.rules` file before enabling direct client access.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
