-- Extend persona status/state enums and add metadata for pending flags

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE personas
DROP CONSTRAINT IF EXISTS personas_status_check;

ALTER TABLE personas
ADD CONSTRAINT personas_status_check
CHECK (status IN ('active', 'inactive', 'suspended', 'deleted', 'pending'));

ALTER TABLE crm_personas
DROP CONSTRAINT IF EXISTS crm_personas_persona_state_check;

ALTER TABLE crm_personas
ADD CONSTRAINT crm_personas_persona_state_check
CHECK (persona_state IN ('anonymous', 'pseudonymous', 'identifiable', 'pending'));
