# Level 1 — High-level overview and current operation

This backend (Kiff AI Backend Lite v2) is a FastAPI-based service optimized for a multi-tenant workflow and a knowledge-first (RAG) development approach with fast generation.

## Key components

- **Main application**: `app/main.py`
  - Registers middlewares and routers: `auth`, `generate`, `status`, `preview`, `account`, `apis`, `providers`, `sitemap`, `extract`, `kb`, `kiffs`, `models`, `users`, `tokens`.
  - CORS and GZip enabled.

- **Tenant middleware**: `app/middleware/tenant.py`
  - Requires `X-Tenant-ID` header (exact case). Configurable fallback to `DEFAULT_TENANT_ID`.
  - Injects `request.state.tenant_id` to scope endpoints.

- **Lightweight sessions**: `app/util/session.py`
  - Cookie/Authorization signed with HMAC, configurable TTL.
  - Used to identify the user's `email` (key for metering).

- **Ephemeral state**:
  - `app/state/memory.py`: in-memory store for generation jobs/results.
  - `app/state/users.py`: mock in-memory users (testing).
  - `app/state/tokens.py`: (New) token consumption meter per tenant/user with events, balances, and USD/1K pricing.

- **Relevant routes**:
  - `app/routes/generate.py`: creates a sample project, stores the result, and records estimated token consumption.
  - `app/routes/tokens.py`: API for consumption/balance/events/pricing.
  - `app/routes/extract.py`: extraction utilities and token/cost estimation helpers.

## Operational considerations

- Recurring issue: always send `X-Tenant-ID` from the frontend (exact case) to avoid "Tenant not specified" errors.
- Knowledge-first (RAG): priority API documentation is pre-indexed for more informed future generations.
