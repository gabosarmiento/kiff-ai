# Level 3 — Immediate Todos

These are the concrete next actions to complete the current milestone.

## Pixel-perfect API Gallery
- [ ] Match Storybook spacings exactly (card padding, chip gaps, grid gap, min card width).
- [ ] Lock pill/badge colors, radii, and shadows to Storybook tokens.
- [ ] Verify header height with badges; pin footer rows; expand/collapse keeps equal heights.
- [ ] Ensure "View APIs" details panel mirrors Storybook (content, styles, spacing).

## Sidebar and Navigation
- [ ] Confirm order and focus/hover states match Storybook.
- [ ] Keyboard nav: ensure tab order and focus rings are consistent.

## Account Page
- [ ] Verify removal of name field everywhere; only email remains.
- [ ] Delete Account modal: enforce exact-case phrase `DELETE MY ACCOUNT`; disabled state + error copy match Storybook.

## Tenancy & API Utilities
- [ ] Create shared API utility that always injects `X-Tenant-ID` (exact case) with fallback `4485db48-71b7-47b0-8128-c6dca5be352d`.
- [ ] Validate tenant presence before each call; surface descriptive errors.
- [ ] Add dev logging for missing/invalid tenant; ensure no null/undefined headers.
- [ ] Add tests/mocks to prevent regressions.

## Theming
- [ ] Preserve original blue palette; check light-mode background edge cases do not regress.

## Documentation
- [ ] Keep Level 1/2 docs updated as constraints evolve.
- [ ] Add screenshots or Storybook references for acceptance criteria.
- [ ] Document Docker workflows (ports 3000/6006, npm@11 in-container, named node_modules volume).

## Deployment
- [ ] Set Vercel envs for `frontend-lite/`: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_DEFAULT_TENANT_ID`.
- [ ] Deploy `frontend-lite` to Vercel and verify SSR/edge logs are clean.
- [ ] Optional: deploy `storybookv0` static site to Vercel; confirm visual parity.
- [ ] Confirm backend CORS/cookies allow Vercel domains.

## Backend Integration Checks
- [ ] Ensure all API calls include `X-Tenant-ID` and hit AWS App Runner base URL.
- [ ] Verify auth flow wiring (login/signup/logout/me) with cookies if enabled.

## Models & Pricing (Backend)
- [ ] Expose `/api/models` CRUD in backoffice UI (list/create/edit/delete).
- [ ] Seed `models.json` with Kimi K2, Llama 3.1 8B Instant, Llama 3.3 70B Versatile (with speeds and per-1k pricing).
- [ ] Configure env mapping: `KIFF_MODEL_FAST`, `KIFF_MODEL_AGENTIC`.
- [ ] Verify `/api/extract/preview` returns `config.model` and `costs.*` computed from `models.json`.
- [ ] Add embedding pricing model if embeddings are introduced; surface `embed_tokens_est` rate.

## Extractor Storybook Parity
- [ ] Ensure result view has both content tabs (Text/Markdown/Raw) and analysis tabs (Chunks/Metadata/Costs/Logs).
- [ ] Confirm right-side Run stats (duration, tokens, chunks, est. cost) match Storybook layout.
- [ ] Auto-fetch URLs on API selection; remove explicit fetch button.
- [ ] Keep single primary “Extract” CTA and processing bar identical to Storybook.

## QA Checklist
- [ ] Cross-browser check (Chrome, Safari) for card alignment.
- [ ] Resize test to ensure grid wraps without misalignment.
- [ ] Verify lint passes and no console warnings.
- [ ] Run Storybook alongside Next (3000 + 6006) to compare UI live; no deviations.
