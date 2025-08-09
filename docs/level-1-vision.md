# Level 1 — Higher Vision

Build a minimal, modular, pixel-perfect Kiff Dev “Frontend Lite” that showcases the chat-driven app creation UX. The UI must exactly match Storybook (visual source of truth) while remaining simple to iterate and deploy (Vercel-ready). Priorities:

- Pixel-perfect alignment to Storybook for Dashboard, API Gallery, and Account
- Fast iteration with a clean, modular architecture (SOLID boundaries)
- Strict tenancy handling on all requests (`X-Tenant-ID` required)
- Strong UX safety for destructive actions (typed confirmations)
- Preserve the original blue theme exactly; only fix specificity issues

Inspiration: bolt.new and lovable.dev (chat + live preview flow), adapted to Kiff Dev.

## Current Achievements (Baseline Ready)
- Monorepo workspaces set with shared UI: `packages/ui` exported as `@kiff/ui` (Button, Card, Input, etc.).
- Shared Tailwind preset (`packages/ui/tailwind.preset.cjs`) consumed by `frontend-lite` and Storybook for exact blue theme parity.
- `frontend-lite` configured with `transpilePackages: ['@kiff/ui']` and Tailwind preset extension.
- Auth pages (login/signup) refactored to use shared components; visual parity work staged in Storybook.
- Linting stabilized: config files excluded/overridden; no build-blocking ESLint errors.
- Storybook isolated in `storybookv0/`, consuming `@kiff/ui`; Vite alias to reuse app code where needed.
- Vercel-ready: `frontend-lite/vercel.json` and `storybookv0/vercel.json` added; Next.js and static Storybook builds.
- Backend-lite-v2 live on AWS App Runner; FE wired via `NEXT_PUBLIC_API_BASE_URL` and strict `X-Tenant-ID` handling.

## Deployment Readiness
- Frontend deploy target: Vercel project with Root Directory `frontend-lite/`.
- Environment variables: set `NEXT_PUBLIC_API_BASE_URL` and default tenant fallback.
- Backend health verified (`/` and `/health` return OK). CORS + cookie settings to allow Vercel origins.

## Backend Separation & Models Pricing

Kiff is a full-stack system. The Python backend (`backend-lite-v2/`) owns data, pricing, and orchestration logic. The Next.js app renders and drives the UX.

- Providers (APIs) and Models (LLMs/pricing) are separate domains.
  - Providers CRUD: `app/routes/apis.py` + `app/data/apis.json`.
  - Models CRUD: `app/routes/models.py` + `app/data/models.json`.
  - Extraction pricing is computed server-side from Models store, never in the frontend.
- Mode→Model mapping via env: `KIFF_MODEL_FAST`, `KIFF_MODEL_AGENTIC`.
- Tenancy enforced on every backend route; FE must always send `X-Tenant-ID`.

## Extractor UI North Star
- Pixel-perfect two-column layout from Storybook.
- Auto-fetch URLs on API select; single primary Extract CTA.
- Processing state mirrors Storybook loader.
- Result shows content tabs (Text/Markdown/Raw) plus analysis tabs (Chunks/Metadata/Costs/Logs).
- Right panel shows run stats (duration, tokens, chunks, est. cost) and context.
- Ingest to LanceDB and create a Kiff follow-ups.

## North Star
- Storybook is the visual source of truth. The app must remain in lockstep with Storybook components and tokens to ensure pixel-perfect UX across Dashboard, API Gallery, and Account.
