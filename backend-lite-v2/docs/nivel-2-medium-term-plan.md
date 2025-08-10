# Level 2 — Expanded vision and medium-term plan

## Expanded vision

Evolve Kiff AI into a conversational, knowledge-driven development platform (Claude Code-like), while keeping:
- Fast generation
- Optional 3-column layout with live preview
- Secure multi-tenant architecture

## AGNO integration (Agent + Tools)

Target tools:
- `KnowledgeRAG`
- `APIPatternAnalyzer`
- `DocumentationRetriever`
- `ProjectAnalyzer`
- `FileModifier`
- `TodoEvolutionTracker`
- `PreviewGenerator`
- `DependencyManager`

Core flow:
1. API Documentation → 2. Vector indexing → 3. Knowledge Base (RAG) → 4. Agent → 5. Contextual code generation

## Conversation and history

- Modular conversation history with `conversation_history` feature flag (tenant/user scoped), ready for testing.
- Chat-style UI with sidebar, search, pinning, and management.

## Medium-term backend plan

- Metering persistence: store token balances/events in DB (SQLAlchemy + migrations), keep in-memory fallback.
- Quotas and guardrails: per-tenant monthly limits, 402 responses, alerts.
- Observability: daily aggregations per tenant/user, costs by action/model, reporting endpoints.
- RAG endpoints: controlled access to indices and metadata filters (tenant, user, session, document_type).
- Security/roles: protect pricing and admin with roles (admin/user) and feature flags.
- Full integration with AGNO Agent and tools, following official docs.

## Notes

- Enforce strict `X-Tenant-ID` header pattern on all frontend calls.
- Default price: `USD_PER_1K_TOKENS = 0.20`, adjustable via API.
