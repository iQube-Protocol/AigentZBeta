-- Know1 Alpha SkillQube Assets
-- Publishes the 8 curated internal skills Know1 draws from in the KNYT cartridge context.
-- Source: scripts/skills/know1-knyt-skills.skill.json
-- Each skill is registered as a SkillQube in registry_assets, trust_band L1_COMMUNITY.
--
-- Run AFTER 20260415030000_aigentqube_add_aigent_know1.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES

-- 1. Information Value Interpreter
(
  'skillqube-kn0w1-information-value-interpret',
  'platform',
  'SkillQube',
  'Information Value Interpreter',
  'kn0w1-information-value-interpret',
  'Frame what a piece of knowledge or content is worth inside the KNYT system. Surfaces value signals without overstating.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"content_ref": "string", "context": "object"}, "output": {"value_framing": "string", "trust_signal": "string"}}',
  '[{"name": "information_value_interpret", "scope": "content"}]',
  '["know1", "knyt", "knowledge", "value", "interpretation"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": true, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 2. Risk Frame Humanizer
(
  'skillqube-kn0w1-risk-frame-humanize',
  'platform',
  'SkillQube',
  'Risk Frame Humanizer',
  'kn0w1-risk-frame-humanize',
  'Translate risk and uncertainty into plain language without minimising or alarming. Used when explaining provisional states, economic volatility, or uncertain outcomes.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"risk_context": "object"}, "output": {"plain_language_framing": "string"}}',
  '[{"name": "risk_frame_humanize", "scope": "content"}]',
  '["know1", "knyt", "risk", "plain-language", "provisional"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": false, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 3. Pricing Logic Explainer
(
  'skillqube-kn0w1-pricing-logic-explain',
  'platform',
  'SkillQube',
  'Pricing Logic Explainer',
  'kn0w1-pricing-logic-explain',
  'Explain how Qc pricing works for skills, sessions, and actions inside the stack. Makes the economic grammar legible to humans.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"action_type": "string", "session_context": "object"}, "output": {"pricing_explanation": "string"}}',
  '[{"name": "pricing_logic_explain", "scope": "analytics"}]',
  '["know1", "knyt", "pricing", "qc", "economic-grammar"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": false, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 4. KNYT Treasury Explainer
(
  'skillqube-kn0w1-knyt-treasury-explain',
  'platform',
  'SkillQube',
  'KNYT Treasury Explainer',
  'kn0w1-knyt-treasury-explain',
  'Explain the KNYT Treasury clearly and honestly — what it is, what it holds, how it sustains the cartridge economy, what flows in and out.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"user_context": "object", "treasury_state": "object"}, "output": {"treasury_explanation": "string"}}',
  '[{"name": "knyt_treasury_explain", "scope": "analytics"}]',
  '["know1", "knyt", "treasury", "economy", "cartridge"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": true, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 5. KNYT Rewards Explainer
(
  'skillqube-kn0w1-knyt-rewards-explain',
  'platform',
  'SkillQube',
  'KNYT Rewards Explainer',
  'kn0w1-knyt-rewards-explain',
  'Explain the KNYT rewards model — what meaningful participation earns, how rewards are recognised, the difference between provisional and finalised state.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"user_stage": "string", "participation_history": "array"}, "output": {"rewards_explanation": "string", "provisional_status": "object"}}',
  '[{"name": "knyt_rewards_explain", "scope": "analytics"}]',
  '["know1", "knyt", "rewards", "participation", "provisional"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": true, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 6. Qc vs $KNYT Distinction Explainer
(
  'skillqube-kn0w1-qc-vs-knyt-explain',
  'platform',
  'SkillQube',
  'Qc vs $KNYT Distinction Explainer',
  'kn0w1-qc-vs-knyt-explain',
  'Explain the Qc / $KNYT distinction cleanly every time it is needed. Governing rule: Qc helps KNYT operate. $KNYT helps KNYT express and reward native value. These must not be conflated.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"user_question": "string"}, "output": {"distinction_explanation": "string"}}',
  '[{"name": "qc_vs_knyt_explain", "scope": "analytics"}]',
  '["know1", "knyt", "qc", "distinction", "economic-grammar"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": false, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 7. 21 Sats Structure Explainer
(
  'skillqube-kn0w1-21sats-structure-explain',
  'platform',
  'SkillQube',
  '21 Sats Structure Explainer',
  'kn0w1-21sats-structure-explain',
  'Explain what 21 Sats is, how it sits inside KNYT as the community world, what coordination means here, and the feeder path toward AVS.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"user_context": "object"}, "output": {"structure_explanation": "string"}}',
  '[{"name": "21sats_structure_explain", "scope": "content"}]',
  '["know1", "knyt", "21sats", "coordination", "avs"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": false, "authorityRequired": "none"}',
  'agentiq-system'
),

-- 8. Opportunity Shaper
(
  'skillqube-kn0w1-opportunity-shape',
  'platform',
  'SkillQube',
  'Opportunity Shaper',
  'kn0w1-opportunity-shape',
  'Help a participant see and articulate their next real move inside the KNYT system. Surfaces venture pathways, contribution opportunities, and progression steps without pushing.',
  '0.1.0',
  'L1_COMMUNITY',
  'published',
  'open',
  'skill',
  '{"input": {"user_stage": "string", "interests": "array", "participation_history": "array"}, "output": {"opportunity_framing": "string", "suggested_next_move": "object"}}',
  '[{"name": "opportunity_shape", "scope": "tasks"}]',
  '["know1", "knyt", "opportunity", "venture", "progression"]',
  '{"agentId": "aigent-kn0w1", "cartridge": "knyt", "pricingQc": 0, "receiptEmitted": true, "authorityRequired": "none"}',
  'agentiq-system'
)

ON CONFLICT (asset_id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  trust_band         = EXCLUDED.trust_band,
  publication_status = EXCLUDED.publication_status,
  capabilities       = EXCLUDED.capabilities,
  tags               = EXCLUDED.tags,
  metadata           = EXCLUDED.metadata,
  updated_at         = now();
