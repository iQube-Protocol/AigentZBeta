ALTER TABLE persona ADD COLUMN IF NOT EXISTS referred_by_persona_id UUID;
ALTER TABLE persona ADD COLUMN IF NOT EXISTS referrer_persona_id UUID;
ALTER TABLE persona ADD COLUMN IF NOT EXISTS ref_campaign_id TEXT;
ALTER TABLE persona ADD COLUMN IF NOT EXISTS first_paid_purchase_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_persona_referred_by ON persona(referred_by_persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_referrer ON persona(referrer_persona_id);
