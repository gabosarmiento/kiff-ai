-- Token & Cost Observability Schema
-- Source of truth: Postgres

-- usage_event: immutable ledger of LLM usage per logical call
CREATE TABLE IF NOT EXISTS usage_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NULL,
  workspace_id TEXT NULL,
  session_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  parent_step_id TEXT NULL,
  agent_name TEXT NULL,
  tool_name TEXT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  model_version TEXT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  token_breakdown JSONB NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  retries INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok','error')),
  error_code TEXT NULL,
  source TEXT NOT NULL CHECK (source IN ('provider','estimated')),
  redaction_applied BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_digest TEXT NULL,
  completion_digest TEXT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_event_ts ON usage_event (ts);
CREATE INDEX IF NOT EXISTS idx_usage_event_tenant_ts ON usage_event (tenant_id, ts);
CREATE INDEX IF NOT EXISTS idx_usage_event_session ON usage_event (session_id);
CREATE INDEX IF NOT EXISTS idx_usage_event_run ON usage_event (run_id);
CREATE INDEX IF NOT EXISTS idx_usage_event_step ON usage_event (step_id);
CREATE INDEX IF NOT EXISTS idx_usage_event_provider_model ON usage_event (provider, model);
CREATE INDEX IF NOT EXISTS idx_usage_event_status ON usage_event (status);

-- tenant_budget: budgets and state per period
CREATE TABLE IF NOT EXISTS tenant_budget (
  tenant_id TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily','monthly')),
  period_start DATE NOT NULL,
  soft_limit_usd NUMERIC NOT NULL,
  hard_limit_usd NUMERIC NOT NULL,
  usage_to_date_usd NUMERIC NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('ok','soft_exceeded','hard_blocked')) DEFAULT 'ok',
  PRIMARY KEY (tenant_id, period, period_start)
);

-- model_pricing: effective pricing per model/version window
CREATE TABLE IF NOT EXISTS model_pricing (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_per_1k NUMERIC NOT NULL,
  output_per_1k NUMERIC NOT NULL,
  reasoning_per_1k NUMERIC NULL,
  cache_discount NUMERIC NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, model, effective_from)
);

-- Materialized views
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cost_by_tenant_day AS
SELECT
  tenant_id,
  date_trunc('day', ts) AS day,
  SUM(cost_usd) AS cost_usd,
  COUNT(*) AS requests
FROM usage_event
GROUP BY 1,2;
CREATE INDEX IF NOT EXISTS idx_mv_cost_by_tenant_day ON mv_cost_by_tenant_day (tenant_id, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_model_mix_day AS
SELECT
  date_trunc('day', ts) AS day,
  provider,
  model,
  COUNT(*) AS requests,
  SUM(cost_usd) AS cost_usd,
  AVG(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float AS cache_hit_rate
FROM usage_event
GROUP BY 1,2,3;
CREATE INDEX IF NOT EXISTS idx_mv_model_mix_day ON mv_model_mix_day (day, provider, model);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_p95_tokens_by_route_day AS
SELECT
  date_trunc('day', ts) AS day,
  COALESCE(agent_name, tool_name, 'unknown') AS route,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_tokens) AS p50_tokens,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_tokens) AS p95_tokens
FROM usage_event
GROUP BY 1,2;
CREATE INDEX IF NOT EXISTS idx_mv_p95_tokens_day ON mv_p95_tokens_by_route_day (day, route);

-- Refresh helper function (optional)
CREATE OR REPLACE FUNCTION refresh_observability_materialized_views() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cost_by_tenant_day;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_mix_day;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_p95_tokens_by_route_day;
END;
$$ LANGUAGE plpgsql;
