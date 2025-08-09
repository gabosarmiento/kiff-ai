-- Fix Token Summary Trigger Migration
-- =======================================
-- 
-- Fixes the incorrect trigger on token_consumption_summaries table
-- that was trying to update a non-existent 'updated_at' column.

-- Drop the incorrect trigger
DROP TRIGGER IF EXISTS update_token_summaries_updated_at ON token_consumption_summaries;

-- Since we handle the last_updated timestamp in application code,
-- we don't need this trigger. But if we wanted one, it would be:
-- 
-- CREATE OR REPLACE FUNCTION update_last_updated_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.last_updated = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- CREATE TRIGGER update_token_summaries_last_updated
--     BEFORE UPDATE ON token_consumption_summaries
--     FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

-- For now, we'll just remove the problematic trigger since the app handles timestamps