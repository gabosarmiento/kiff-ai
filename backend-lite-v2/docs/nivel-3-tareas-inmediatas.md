# Level 3 — Immediate tasks and executed log

## Immediate backlog (actionable)

- [ ] E2E metering tests: `POST /tokens/consume`, `GET /tokens/balance`, `GET /tokens/events` with `X-Tenant-ID` from the frontend.
- [ ] Integrate metering into more actions (chat/stream, real extraction/embedding) with `input_tokens`/`output_tokens` when applicable.
- [ ] Per-tenant limits/quotas and 402 responses (controlled pay-per-token).
- [ ] SQL persistence for balances and events (SQLAlchemy + migrations); keep in-memory fallback.
- [ ] Observability: daily summaries per tenant/user, cost dashboards, and top actions/models.
- [ ] Centralized frontend utility for `X-Tenant-ID` and tenant validation before requests.

## Done in this session

- [x] In-memory token system: `app/state/tokens.py` with `TokenEvent`, `TokenBalance`, pricing, and methods `record`, `list_balances`, `list_events`.
- [x] Tokens router: `app/routes/tokens.py` with `POST /tokens/consume`, `GET /tokens/balance`, `GET /tokens/events`, `GET/POST /tokens/pricing`.
- [x] Router registration in `app/main.py` (`app.include_router(tokens.router)`).
- [x] Metering integration in `app/routes/generate.py` with rough estimate (~4 chars/token) and `meta` including `job_id`.
- [x] Tenant scoping and `user_key` resolution via session/email or fallback to `"anonymous"`.

## Quick references

- Tenant middleware: `app/middleware/tenant.py`
- Sessions: `app/util/session.py`
- Generation: `app/routes/generate.py`
- Tokens (state): `app/state/tokens.py`
- Tokens (API): `app/routes/tokens.py`
- Main app: `app/main.py`
