-- Server-Driven User Preferences and Flags Schema
-- Replaces localStorage-based flags with server-driven state management

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('feature_flag', 'ui_preference', 'consent', 'workflow')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id, key),
    CONSTRAINT user_preferences_user_id_not_empty CHECK (length(user_id) > 0),
    CONSTRAINT user_preferences_key_not_empty CHECK (length(key) > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON user_preferences(category);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at);

-- User Sessions Table (for anonymous/unauthenticated users)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT,
    persona_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    
    -- Constraints
    CONSTRAINT user_sessions_session_id_not_empty CHECK (length(session_id) > 0)
);

-- Indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_persona_id ON user_sessions(persona_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active);

-- Preference Change Audit Trail
CREATE TABLE IF NOT EXISTS user_preferences_audit (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    category TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT DEFAULT 'web', -- web, mobile, api, admin
    session_id TEXT,
    
    -- Constraints
    CONSTRAINT user_preferences_audit_user_id_not_empty CHECK (length(user_id) > 0),
    CONSTRAINT user_preferences_audit_key_not_empty CHECK (length(key) > 0)
);

-- Indexes for audit trail
CREATE INDEX IF NOT EXISTS idx_user_preferences_audit_user_id ON user_preferences_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_audit_key ON user_preferences_audit(key);
CREATE INDEX IF NOT EXISTS idx_user_preferences_audit_changed_at ON user_preferences_audit(changed_at);

-- Row Level Security (RLS) Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT USING (
        auth.uid()::text = user_id OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "Users can modify own preferences" ON user_preferences
    FOR ALL USING (
        auth.uid()::text = user_id OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Policy: Service role full access to sessions
CREATE POLICY "Service role full access to user_sessions" ON user_sessions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can view own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (
        auth.uid()::text = user_id OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Policy: Service role access to audit trail
CREATE POLICY "Service role access to preferences audit" ON user_preferences_audit
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Functions for preference management

-- Function to get user preferences with defaults
CREATE OR REPLACE FUNCTION get_user_preferences_with_defaults(
    p_user_id TEXT,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    key TEXT,
    value JSONB,
    category TEXT,
    has_custom_value BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.key,
        COALESCE(up.value, get_default_preference_value(up.key, up.category)) as value,
        up.category,
        up.value IS NOT NULL as has_custom_value
    FROM user_preferences up
    WHERE up.user_id = p_user_id
    AND (p_category IS NULL OR up.category = p_category)
    ORDER BY up.category, up.key;
END;
$$ LANGUAGE plpgsql;

-- Function to get default preference values
CREATE OR REPLACE FUNCTION get_default_preference_value(
    p_key TEXT,
    p_category TEXT
)
RETURNS JSONB AS $$
BEGIN
    -- Return default values for known preferences
    CASE p_key
        WHEN 'x402_alias_consent' THEN RETURN 'false'::jsonb;
        WHEN 'theme' THEN RETURN '"dark"'::jsonb;
        WHEN 'density' THEN RETURN '"wide"'::jsonb;
        WHEN 'copilot_open' THEN RETURN 'false'::jsonb;
        WHEN 'feature_solana_ops' THEN RETURN 'true'::jsonb;
        WHEN 'feature_tier3_batching' THEN RETURN 'false'::jsonb;
        ELSE RETURN 'null'::jsonb;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to migrate localStorage data
CREATE OR REPLACE FUNCTION migrate_local_storage_data(
    p_user_id TEXT,
    p_local_data JSONB
)
RETURNS TABLE (
    migrated_keys TEXT[],
    errors TEXT[]
) AS $$
DECLARE
    migrated_keys TEXT[] := '{}';
    errors TEXT[] := '{}';
    pref_key TEXT;
    pref_value JSONB;
    pref_category TEXT;
BEGIN
    -- Iterate through localStorage data
    FOR pref_key IN SELECT jsonb_object_keys(p_local_data)
    LOOP
        BEGIN
            pref_value := p_local_data -> pref_key;
            pref_category := CASE 
                WHEN pref_key LIKE '%consent%' THEN 'consent'
                WHEN pref_key LIKE 'feature_%' OR pref_key LIKE '%flag%' THEN 'feature_flag'
                WHEN pref_key LIKE '%theme%' OR pref_key LIKE '%layout%' OR pref_key LIKE '%drawer%' THEN 'ui_preference'
                ELSE 'workflow'
            END;
            
            -- Insert or update preference
            INSERT INTO user_preferences (user_id, key, value, category, updated_at)
            VALUES (p_user_id, pref_key, pref_value, pref_category, NOW())
            ON CONFLICT (user_id, key) 
            DO UPDATE SET 
                value = EXCLUDED.value,
                category = EXCLUDED.category,
                updated_at = NOW();
            
            migrated_keys := migrated_keys || pref_key;
            
        EXCEPTION WHEN OTHERS THEN
            errors := errors || 'Failed to migrate ' || pref_key || ': ' || SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT migrated_keys, errors;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old sessions
CREATE OR REPLACE FUNCTION cleanup_old_sessions(
    retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    cutoff_time TIMESTAMP WITH TIME ZONE;
    deleted_count INTEGER;
BEGIN
    cutoff_time := NOW() - (retention_days || ' days')::INTERVAL;
    
    DELETE FROM user_sessions 
    WHERE last_active < cutoff_time 
    AND user_id IS NULL; -- Only clean up anonymous sessions
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for audit logging

CREATE OR REPLACE FUNCTION log_preference_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log preference changes
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO user_preferences_audit (user_id, key, old_value, new_value, category, changed_at)
        VALUES (
            NEW.user_id,
            NEW.key,
            OLD.value,
            NEW.value,
            NEW.category,
            NOW()
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO user_preferences_audit (user_id, key, old_value, new_value, category, changed_at)
        VALUES (
            NEW.user_id,
            NEW.key,
            NULL,
            NEW.value,
            NEW.category,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for preference audit logging
DROP TRIGGER IF EXISTS preference_audit_trigger ON user_preferences;
CREATE TRIGGER preference_audit_trigger
    AFTER INSERT OR UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION log_preference_change();

-- Function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_sessions 
    SET last_active = NOW()
    WHERE session_id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to service role and authenticated users
GRANT ALL ON user_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO authenticated;
GRANT ALL ON user_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated;
GRANT ALL ON user_preferences_audit TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON get_user_preferences_with_defaults TO authenticated;
