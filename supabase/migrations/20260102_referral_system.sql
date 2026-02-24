ALTER TABLE personas ADD COLUMN IF NOT EXISTS referred_by_persona_id UUID;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS referral_locked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_persona_id UUID NOT NULL,
  referee_persona_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  reward_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_share_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID,
  content_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  reward_earned DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL,
  reward_type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  dvn_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
