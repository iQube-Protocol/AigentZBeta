-- User iQube (dev-first) for canonical auth-profile to persona grants.
-- This table is intentionally simple to bootstrap safer persona visibility.

CREATE TABLE IF NOT EXISTS user_iqubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_profile_id TEXT NOT NULL,
  emails TEXT[] NOT NULL DEFAULT '{}',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  allowed_tenant_ids TEXT[] NOT NULL DEFAULT '{}',
  persona_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_persona_by_tenant JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_iqubes_auth_profile_id
  ON user_iqubes (auth_profile_id);

CREATE INDEX IF NOT EXISTS idx_user_iqubes_status
  ON user_iqubes (status);
