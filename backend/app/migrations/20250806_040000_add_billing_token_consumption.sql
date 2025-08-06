-- Migration: Add billing token consumption tracking
-- Date: 2025-08-06 04:00:00
-- Description: Create tables for billing-cycle-based token consumption tracking

-- Create billing_cycles table
CREATE TABLE IF NOT EXISTS billing_cycles (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    
    -- Billing cycle period
    cycle_start TIMESTAMPTZ NOT NULL,
    cycle_end TIMESTAMPTZ NOT NULL,
    cycle_type VARCHAR DEFAULT 'monthly',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_completed BOOLEAN DEFAULT false,
    
    -- Metadata
    plan_type VARCHAR DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for billing_cycles
CREATE INDEX IF NOT EXISTS idx_billing_cycles_tenant_user ON billing_cycles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_active ON billing_cycles(tenant_id, user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_period ON billing_cycles(cycle_start, cycle_end);

-- Create token_consumptions table
CREATE TABLE IF NOT EXISTS token_consumptions (
    id BIGSERIAL PRIMARY KEY,
    
    -- User identification
    tenant_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    session_id VARCHAR,
    
    -- Billing cycle reference
    billing_cycle_id INTEGER NOT NULL REFERENCES billing_cycles(id) ON DELETE CASCADE,
    
    -- Token metrics (from AGNO native metrics)
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    cached_tokens BIGINT DEFAULT 0,
    reasoning_tokens BIGINT DEFAULT 0,
    audio_tokens BIGINT DEFAULT 0,
    cache_write_tokens BIGINT DEFAULT 0,
    cache_read_tokens BIGINT DEFAULT 0,
    
    -- Consumption metadata
    operation_type VARCHAR,
    operation_id VARCHAR,
    
    -- Source tracking
    model_name VARCHAR,
    provider VARCHAR DEFAULT 'groq',
    
    -- Additional metadata
    extra_data JSONB,
    
    -- Timestamps
    consumed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for token_consumptions
CREATE INDEX IF NOT EXISTS idx_token_consumptions_tenant_user ON token_consumptions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_token_consumptions_billing_cycle ON token_consumptions(billing_cycle_id);
CREATE INDEX IF NOT EXISTS idx_token_consumptions_session ON token_consumptions(session_id);
CREATE INDEX IF NOT EXISTS idx_token_consumptions_operation ON token_consumptions(operation_type);
CREATE INDEX IF NOT EXISTS idx_token_consumptions_provider ON token_consumptions(provider);
CREATE INDEX IF NOT EXISTS idx_token_consumptions_consumed_at ON token_consumptions(consumed_at);

-- Create token_consumption_summaries table
CREATE TABLE IF NOT EXISTS token_consumption_summaries (
    id SERIAL PRIMARY KEY,
    
    -- User identification
    tenant_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    
    -- Billing cycle reference (unique constraint)
    billing_cycle_id INTEGER NOT NULL UNIQUE REFERENCES billing_cycles(id) ON DELETE CASCADE,
    
    -- Aggregated totals
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    total_cached_tokens BIGINT DEFAULT 0,
    total_reasoning_tokens BIGINT DEFAULT 0,
    total_audio_tokens BIGINT DEFAULT 0,
    total_cache_write_tokens BIGINT DEFAULT 0,
    total_cache_read_tokens BIGINT DEFAULT 0,
    
    -- Operation breakdowns
    generation_tokens BIGINT DEFAULT 0,
    chat_tokens BIGINT DEFAULT 0,
    api_indexing_tokens BIGINT DEFAULT 0,
    other_tokens BIGINT DEFAULT 0,
    
    -- Provider breakdowns
    groq_tokens BIGINT DEFAULT 0,
    openai_tokens BIGINT DEFAULT 0,
    other_provider_tokens BIGINT DEFAULT 0,
    
    -- Timestamps
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for token_consumption_summaries
CREATE INDEX IF NOT EXISTS idx_token_summaries_tenant_user ON token_consumption_summaries(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_token_summaries_billing_cycle ON token_consumption_summaries(billing_cycle_id);
CREATE INDEX IF NOT EXISTS idx_token_summaries_total_tokens ON token_consumption_summaries(total_tokens);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_billing_cycles_updated_at ON billing_cycles;
CREATE TRIGGER update_billing_cycles_updated_at
    BEFORE UPDATE ON billing_cycles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_token_summaries_updated_at ON token_consumption_summaries;
CREATE TRIGGER update_token_summaries_updated_at
    BEFORE UPDATE ON token_consumption_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert comment for migration tracking
COMMENT ON TABLE billing_cycles IS 'Billing cycle management for token consumption tracking - Migration 20250806_040000';
COMMENT ON TABLE token_consumptions IS 'Individual token consumption records within billing cycles - Migration 20250806_040000';
COMMENT ON TABLE token_consumption_summaries IS 'Aggregated token consumption summaries per billing cycle - Migration 20250806_040000';