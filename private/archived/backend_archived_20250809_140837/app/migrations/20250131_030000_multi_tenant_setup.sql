-- Migration: 20250131_030000_multi_tenant_setup
-- Created: 2025-01-31T03:00:00
-- Description: Set up multi-tenant architecture with schema-per-tenant isolation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tenant management table in master database
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    tier VARCHAR(20) NOT NULL DEFAULT 'starter',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    resource_limits JSONB DEFAULT '{}',
    billing_info JSONB DEFAULT '{}',
    contact_email VARCHAR(255),
    admin_user_id INTEGER,
    
    CONSTRAINT chk_tenant_status CHECK (status IN ('active', 'suspended', 'migrating', 'archived')),
    CONSTRAINT chk_tenant_tier CHECK (tier IN ('starter', 'professional', 'enterprise', 'custom')),
    CONSTRAINT chk_schema_name_format CHECK (schema_name ~ '^tenant_[a-z0-9_]+$')
);

-- Create tenant users mapping table
CREATE TABLE IF NOT EXISTS tenant_users (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    permissions JSONB DEFAULT '[]',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id),
    CONSTRAINT chk_tenant_user_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

-- Create tenant analytics table
CREATE TABLE IF NOT EXISTS tenant_analytics (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);

CREATE INDEX IF NOT EXISTS idx_tenant_analytics_tenant_date ON tenant_analytics(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_tenant_analytics_date ON tenant_analytics(date);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tenants table
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to validate tenant schema name
CREATE OR REPLACE FUNCTION validate_tenant_schema_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure schema name is unique and valid
    IF NEW.schema_name !~ '^tenant_[a-z0-9_]+$' THEN
        RAISE EXCEPTION 'Invalid schema name format: %', NEW.schema_name;
    END IF;
    
    -- Check if schema already exists
    IF EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = NEW.schema_name
    ) AND TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Schema already exists: %', NEW.schema_name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for schema name validation
DROP TRIGGER IF EXISTS validate_tenant_schema ON tenants;
CREATE TRIGGER validate_tenant_schema
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION validate_tenant_schema_name();

-- Create function to automatically create tenant analytics record
CREATE OR REPLACE FUNCTION create_tenant_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Create initial analytics record for new tenant
    INSERT INTO tenant_analytics (tenant_id, date, metrics)
    VALUES (
        NEW.id,
        CURRENT_DATE,
        jsonb_build_object(
            'users_created', 0,
            'sandboxes_created', 0,
            'api_calls', 0,
            'tokens_used', 0
        )
    )
    ON CONFLICT (tenant_id, date) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tenant analytics
DROP TRIGGER IF EXISTS create_tenant_analytics_trigger ON tenants;
CREATE TRIGGER create_tenant_analytics_trigger
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION create_tenant_analytics();

-- Create function to get tenant resource usage
CREATE OR REPLACE FUNCTION get_tenant_resource_usage(tenant_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    tenant_schema TEXT;
    usage_data JSONB;
    query_text TEXT;
BEGIN
    -- Get tenant schema name
    SELECT schema_name INTO tenant_schema
    FROM tenants WHERE id = tenant_uuid;
    
    IF tenant_schema IS NULL THEN
        RAISE EXCEPTION 'Tenant not found: %', tenant_uuid;
    END IF;
    
    -- Build dynamic query to get usage from tenant schema
    query_text := format('
        SELECT jsonb_build_object(
            ''users'', (SELECT COUNT(*) FROM %I.users),
            ''sandboxes'', (SELECT COUNT(*) FROM %I.trading_sandboxes),
            ''active_sandboxes'', (SELECT COUNT(*) FROM %I.trading_sandboxes WHERE status = ''running''),
            ''total_tokens'', COALESCE((SELECT SUM(tokens_used) FROM %I.usage_records), 0),
            ''total_api_calls'', COALESCE((SELECT SUM(api_calls) FROM %I.usage_records), 0)
        )', 
        tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema
    );
    
    EXECUTE query_text INTO usage_data;
    
    RETURN usage_data;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old tenant analytics
CREATE OR REPLACE FUNCTION cleanup_tenant_analytics(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tenant_analytics 
    WHERE date < CURRENT_DATE - retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to migrate existing data to default tenant
CREATE OR REPLACE FUNCTION migrate_to_default_tenant()
RETURNS VOID AS $$
DECLARE
    default_tenant_id UUID;
    default_schema TEXT := 'tenant_default';
BEGIN
    -- Check if default tenant already exists
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';
    
    IF default_tenant_id IS NULL THEN
        -- Create default tenant
        INSERT INTO tenants (name, slug, schema_name, tier, status, settings)
        VALUES (
            'Default Tenant',
            'default',
            default_schema,
            'enterprise',
            'active',
            jsonb_build_object('is_default', true)
        )
        RETURNING id INTO default_tenant_id;
        
        -- Create default tenant schema
        EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', default_schema);
        
        -- Copy existing tables to default tenant schema
        EXECUTE format('
            CREATE TABLE %I.users AS SELECT * FROM public.users;
            CREATE TABLE %I.api_keys AS SELECT * FROM public.api_keys;
            CREATE TABLE %I.usage_records AS SELECT * FROM public.usage_records;
            CREATE TABLE %I.market_data AS SELECT * FROM public.market_data;
            CREATE TABLE %I.trading_sandboxes AS SELECT * FROM public.trading_sandboxes;
            CREATE TABLE %I.backtest_results AS SELECT * FROM public.backtest_results;
            CREATE TABLE %I.user_management AS SELECT * FROM public.user_management;
            CREATE TABLE %I.billing_records AS SELECT * FROM public.billing_records;
        ', 
            default_schema, default_schema, default_schema, default_schema, 
            default_schema, default_schema, default_schema, default_schema
        );
        
        -- Create sequences and indexes in tenant schema
        EXECUTE format('
            CREATE SEQUENCE %I.users_id_seq OWNED BY %I.users.id;
            CREATE SEQUENCE %I.api_keys_id_seq OWNED BY %I.api_keys.id;
            CREATE SEQUENCE %I.usage_records_id_seq OWNED BY %I.usage_records.id;
            CREATE SEQUENCE %I.market_data_id_seq OWNED BY %I.market_data.id;
            CREATE SEQUENCE %I.backtest_results_id_seq OWNED BY %I.backtest_results.id;
            CREATE SEQUENCE %I.user_management_id_seq OWNED BY %I.user_management.id;
            CREATE SEQUENCE %I.billing_records_id_seq OWNED BY %I.billing_records.id;
        ', 
            default_schema, default_schema, default_schema, default_schema,
            default_schema, default_schema, default_schema, default_schema,
            default_schema, default_schema, default_schema, default_schema,
            default_schema, default_schema
        );
        
        -- Map existing users to default tenant
        INSERT INTO tenant_users (tenant_id, user_id, role)
        SELECT default_tenant_id, id, 'owner'
        FROM public.users
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
        
        RAISE NOTICE 'Created default tenant and migrated existing data';
    ELSE
        RAISE NOTICE 'Default tenant already exists';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to create tenant schema with all tables
CREATE OR REPLACE FUNCTION create_tenant_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Create all tables in tenant schema
    EXECUTE format('
        CREATE TABLE %I.users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            is_verified BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_login TIMESTAMP WITH TIME ZONE,
            email_verified_at TIMESTAMP WITH TIME ZONE,
            deletion_requested_at TIMESTAMP WITH TIME ZONE,
            deletion_reason TEXT,
            password_changed_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE TABLE %I.api_keys (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            key_name VARCHAR(100) NOT NULL,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_used TIMESTAMP WITH TIME ZONE,
            expires_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE TABLE %I.usage_records (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES %I.users(id) ON DELETE SET NULL,
            resource_type VARCHAR(50) NOT NULL,
            resource_name VARCHAR(100),
            tokens_used INTEGER DEFAULT 0,
            api_calls INTEGER DEFAULT 0,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            metadata JSONB DEFAULT ''''{}''''
        );
        
        CREATE TABLE %I.market_data (
            id SERIAL PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            open_price DECIMAL(20, 8),
            high_price DECIMAL(20, 8),
            low_price DECIMAL(20, 8),
            close_price DECIMAL(20, 8),
            volume DECIMAL(20, 8),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE %I.trading_sandboxes (
            sandbox_id VARCHAR(100) PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            config JSONB NOT NULL DEFAULT ''''{}'''',
            status VARCHAR(20) DEFAULT ''''stopped'''',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_activity TIMESTAMP WITH TIME ZONE,
            container_id VARCHAR(100),
            port INTEGER,
            logs TEXT
        );
        
        CREATE TABLE %I.backtest_results (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            strategy_name VARCHAR(100) NOT NULL,
            symbol VARCHAR(20) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            initial_capital DECIMAL(15, 2) NOT NULL,
            final_capital DECIMAL(15, 2) NOT NULL,
            total_return DECIMAL(10, 4) NOT NULL,
            max_drawdown DECIMAL(10, 4),
            sharpe_ratio DECIMAL(10, 4),
            total_trades INTEGER DEFAULT 0,
            winning_trades INTEGER DEFAULT 0,
            losing_trades INTEGER DEFAULT 0,
            results JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE %I.user_management (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT ''''active'''',
            subscription_plan VARCHAR(50) NOT NULL DEFAULT ''''free'''',
            monthly_token_limit INTEGER DEFAULT 10000,
            monthly_tokens_used INTEGER DEFAULT 0,
            monthly_api_calls_limit INTEGER DEFAULT 1000,
            monthly_api_calls_used INTEGER DEFAULT 0,
            sandbox_limit INTEGER DEFAULT 3,
            last_activity TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE %I.billing_records (
            id SERIAL PRIMARY KEY,
            user_management_id INTEGER NOT NULL REFERENCES %I.user_management(id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL,
            currency VARCHAR(3) DEFAULT ''''USD'''',
            billing_period_start DATE NOT NULL,
            billing_period_end DATE NOT NULL,
            payment_status VARCHAR(20) DEFAULT ''''pending'''',
            payment_method VARCHAR(50),
            transaction_id VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            paid_at TIMESTAMP WITH TIME ZONE
        );
    ', 
        schema_name, schema_name, schema_name, schema_name, schema_name, 
        schema_name, schema_name, schema_name, schema_name, schema_name,
        schema_name, schema_name, schema_name, schema_name
    );
    
    -- Create indexes for performance
    EXECUTE format('
        CREATE INDEX idx_%s_users_email ON %I.users(email);
        CREATE INDEX idx_%s_users_is_active ON %I.users(is_active);
        CREATE INDEX idx_%s_users_created_at ON %I.users(created_at);
        
        CREATE INDEX idx_%s_api_keys_user_id ON %I.api_keys(user_id);
        CREATE INDEX idx_%s_api_keys_is_active ON %I.api_keys(is_active);
        
        CREATE INDEX idx_%s_usage_records_user_id ON %I.usage_records(user_id);
        CREATE INDEX idx_%s_usage_records_timestamp ON %I.usage_records(timestamp);
        CREATE INDEX idx_%s_usage_records_resource_type ON %I.usage_records(resource_type);
        
        CREATE INDEX idx_%s_market_data_symbol ON %I.market_data(symbol);
        CREATE INDEX idx_%s_market_data_timestamp ON %I.market_data(timestamp);
        
        CREATE INDEX idx_%s_sandboxes_user_id ON %I.trading_sandboxes(user_id);
        CREATE INDEX idx_%s_sandboxes_status ON %I.trading_sandboxes(status);
        
        CREATE INDEX idx_%s_backtest_user_id ON %I.backtest_results(user_id);
        CREATE INDEX idx_%s_backtest_created_at ON %I.backtest_results(created_at);
        
        CREATE INDEX idx_%s_user_mgmt_user_id ON %I.user_management(user_id);
        CREATE INDEX idx_%s_user_mgmt_status ON %I.user_management(status);
        
        CREATE INDEX idx_%s_billing_user_mgmt_id ON %I.billing_records(user_management_id);
        CREATE INDEX idx_%s_billing_status ON %I.billing_records(payment_status);
    ', 
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name,
        replace(schema_name, 'tenant_', ''), schema_name
    );
    
    RAISE NOTICE 'Created tenant schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Create roles for multi-tenant access control
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_user') THEN
        CREATE ROLE tenant_user;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_admin') THEN
        CREATE ROLE tenant_admin;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'system_admin') THEN
        CREATE ROLE system_admin;
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO tenant_user, tenant_admin, system_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tenant_admin;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO tenant_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO system_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO tenant_admin, system_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO tenant_user;

-- Initialize with default tenant (optional - uncomment if needed)
-- SELECT migrate_to_default_tenant();

-- Create monitoring view for tenant health
CREATE OR REPLACE VIEW tenant_health_summary AS
SELECT 
    t.id,
    t.name,
    t.slug,
    t.status,
    t.tier,
    t.created_at,
    COALESCE(ta.metrics->>'users_created', '0')::integer as total_users,
    COALESCE(ta.metrics->>'sandboxes_created', '0')::integer as total_sandboxes,
    COALESCE(ta.metrics->>'api_calls', '0')::integer as monthly_api_calls,
    COALESCE(ta.metrics->>'tokens_used', '0')::integer as monthly_tokens,
    ta.date as last_analytics_date
FROM tenants t
LEFT JOIN tenant_analytics ta ON t.id = ta.tenant_id 
    AND ta.date = (
        SELECT MAX(date) 
        FROM tenant_analytics ta2 
        WHERE ta2.tenant_id = t.id
    )
ORDER BY t.created_at DESC;

-- Final verification
DO $$
BEGIN
    RAISE NOTICE 'Multi-tenant database setup completed successfully';
    RAISE NOTICE 'Created tables: tenants, tenant_users, tenant_analytics';
    RAISE NOTICE 'Created functions: create_tenant_schema, get_tenant_resource_usage, cleanup_tenant_analytics';
    RAISE NOTICE 'Created roles: tenant_user, tenant_admin, system_admin';
    RAISE NOTICE 'Created view: tenant_health_summary';
END
$$;
