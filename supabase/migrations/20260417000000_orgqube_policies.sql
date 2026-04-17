-- ============================================================================
-- OrgQube Policy Pack
-- Machine-readable institutional governance envelope for agents, skills,
-- cartridges, authority classes, budgets, trust requirements, and receipts.
--
-- Per doc 14: 14-orgqube-policy-pack-spec.md
-- One policy row per org. Upsert on org_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orgqube_policies (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                 text NOT NULL UNIQUE,
  policy_name            text,
  allowed_agents         text[]  DEFAULT '{}',
  allowed_skills         text[]  DEFAULT '{}',
  allowed_cartridges     text[]  DEFAULT '{}',
  authority_classes      jsonb   DEFAULT '{}',
  trust_threshold_min    integer DEFAULT 0,         -- 0–100; maps to TrustBand
  skill_budget_posture   text    DEFAULT 'open'
                         CHECK (skill_budget_posture IN ('open', 'conservative', 'strict')),
  native_asset_exposure  text    DEFAULT 'none'
                         CHECK (native_asset_exposure IN ('none', 'limited', 'full')),
  required_receipts      text[]  DEFAULT '{}',
  escalation_behavior    jsonb   DEFAULT '{}',
  active                 boolean DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orgqube_policies_org ON public.orgqube_policies(org_id);

ALTER TABLE public.orgqube_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgqube_policies_read_all"
  ON public.orgqube_policies FOR SELECT USING (true);

CREATE POLICY "orgqube_policies_write_service"
  ON public.orgqube_policies FOR ALL USING (auth.role() = 'service_role');

-- Default alpha policy for the nakamoto org
INSERT INTO public.orgqube_policies (
  org_id,
  policy_name,
  allowed_agents,
  allowed_skills,
  allowed_cartridges,
  trust_threshold_min,
  skill_budget_posture,
  native_asset_exposure,
  required_receipts
) VALUES (
  'nakamoto',
  'Nakamoto Alpha Policy',
  ARRAY['aigent-z', 'aigent-c', 'aigent-kn0w1', 'aigent-marketa', 'metame'],
  ARRAY['*'],
  ARRAY['knyt', 'qriptopian', 'agentiq', 'metame'],
  0,
  'open',
  'none',
  ARRAY[]::text[]
) ON CONFLICT (org_id) DO NOTHING;
