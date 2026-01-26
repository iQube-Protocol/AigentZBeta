-- Add discoverability toggle for personas (canonical wallet personas table)
-- Default: NOT discoverable (owner-only visibility for fio_handle)

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS discoverable_within_tenant boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_personas_tenant_discoverable
  ON personas(tenant_id, discoverable_within_tenant)
  WHERE discoverable_within_tenant = true;

