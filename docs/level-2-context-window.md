# Level 2 — Context Window

This captures the active constraints, current state, and references guiding immediate work on the Frontend Lite UI.

## Source of Truth
- Storybook is canonical for visuals and interaction (API Gallery interactive demo; Account default). Any app vs. Storybook discrepancy must resolve in favor of Storybook.

## Current State
- Pages: Dashboard (intro), API Gallery (standalone), Account (email-only; Delete confirmation with exact phrase).
- Sidebar: `Dashboard → API Gallery → Account`.
- API Gallery: provider cards, category chips, search input, provider-count pill, Added badge, expandable "View APIs" section.
- CSS: global tokens/utilities. Theme preserved (original blue); light-mode background specificity fixed.
- Shared UI: `@kiff/ui@0.1.0` consumed by app and Storybook for 1:1 visuals.
- Storybook: `storybookv0/` runs at :6006 with Vite alias `@ → frontend-lite/src`.

## Key Constraints / Requirements
- Pixel-perfect alignment with Storybook (spacing, radii, shadow, typography, pill colors, grid).
- Tenancy headers: all requests must include `X-Tenant-ID` (fallback for local: `4485db48-71b7-47b0-8128-c6dca5be352d`).
- Theme constraints: do not alter the original blue palette; only fix specificity issues (light-mode background already addressed).
- Keep codebase minimal, modular, and Vercel-ready.

## Backend Architecture (Lite v2)
- Framework: FastAPI (`backend-lite-v2/app/`).
- Routers:
  - Providers/APIs: `routes/apis.py` (store: `data/apis.json`).
  - Models (LLMs/pricing): `routes/models.py` (store: `data/models.json`).
  - Extraction: `routes/extract.py` (computes tokens, chunks, duration, costs from Models store).
  - Sitemap: `routes/sitemap.py`.
  - KB/Kiffs: `routes/kb.py`, `routes/kiffs.py`.
- Env mapping for model selection:
  - `KIFF_MODEL_FAST` (default `llama-3.1-8b-instant`).
  - `KIFF_MODEL_AGENTIC` (default `kimi-k2-1t-128k`).
- Costs are computed server-side from `models.json` fields `price_per_1k_input` and `price_per_1k_output`.

### Extractor contract
- Endpoint: `POST /api/extract/preview`
- Request body:
  - `api_id` or `urls[]`
  - `mode`: `fast | agentic`
  - `strategy`: `fixed | document` (others fallback to fixed until implemented)
  - `chunk_size`, `chunk_overlap`, `include_metadata`
- Response body:
  - `chunks[]`: `{ text, url, index, tokens_est, metadata? }`
  - `totals`: `{ chunks, tokens_est, duration_ms }`
  - `per_url`: `{ [url]: { chunks, tokens_est } }`
  - `config`: includes `mode, model, strategy, effective_strategy, chunk_size, chunk_overlap, include_metadata, source`
  - `logs[]`
  - `costs`: `{ model, price_per_1k_input, price_per_1k_output, tokens_est, embed_tokens_est, est_usd }`

## Storybook References (Extractor)
- `storybookv0/src/components/ui/APIExtractionTesterPage.tsx`
- `storybookv0/src/components/ui/ApiExtractionLoading.tsx`
- `storybookv0/src/components/ui/ApiExtractionPreviewTabs.stories.tsx`

## Open Risks / Watchouts
- Subtle card misalignments (header height from badges; footer spacing) can regress; enforce consistent layout primitives.
- Tenant header regressions across components; centralize header insertion.
- Divergence from Storybook tokens if copied values are approximate; prefer importing/centralizing tokens.
- Storybook import resolution: ensure alias and shared UI remain in sync as files move.

## Environment
- Next.js 14.2.x (App Router), React 18, TypeScript.
- Local dev via Docker (Node 20, npm ≥ 11). Named volume for `node_modules` to speed installs.
- Vercel-ready: `frontend-lite/vercel.json` (Next) and `storybookv0/vercel.json` (static).
- Backend: AWS App Runner base URL via `NEXT_PUBLIC_API_BASE_URL`; strict `X-Tenant-ID` required.

## Dev Workflow (quick reference)
- Install + run app:
  - Use Docker image `node:20-bullseye` and upgrade to npm@11 in-container.
  - Workspace install at repo root: `npm ci --workspaces --include-workspace-root`.
  - Run Next on 3000: `npm run dev -- --port 3000 --hostname 0.0.0.0` in `frontend-lite/`.
- Run Storybook on 6006: `npx storybook dev -p 6006 --host 0.0.0.0 --no-open` in `storybookv0/`.
- Shared UI: `@kiff/ui@0.1.0` pinned; Next transpiles it via `transpilePackages`.
