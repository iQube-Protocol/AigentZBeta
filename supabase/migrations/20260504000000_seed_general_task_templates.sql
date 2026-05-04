-- =============================================================================
-- Seed General task templates (Bring a Knight / Knight of Attention / Herald)
--
-- Phase 1 of the tasks/rewards/reputation integration plan
-- (codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md)
--
-- These three task families already have services + reward types defined in
-- services/rewards/{referralService.ts, engagementService.ts, rewardService.ts}.
-- Seeding the templates so the wallet UI can bind to them and surface progress
-- + claimable rewards through /api/wallet/tasks.
--
-- Universal — these tasks are open to every signed-in persona. NOT investor-gated.
-- =============================================================================

INSERT INTO crm_task_templates (
  tenant_id,
  slug,
  title,
  description,
  category,
  difficulty_level,
  expected_impact_level,
  verification_mode,
  reward_qct, reward_qoyn, reward_knyt,
  rep_weight_technical, rep_weight_creative,
  rep_weight_entrepreneurial, rep_weight_data_arch, rep_weight_community,
  schema_json,
  metadata,
  is_active
) VALUES

-- 1. Bring a Knight — referral task
(
  'knyt', 'knyt:bring-a-knight',
  'Bring a Knight',
  'Invite friends to join AigentZ. Earn 2 KNYT when each invited persona makes their first qualifying purchase.',
  'community', 2, 3, 'usage_based',
  0, 0, 2.0,
  0, 0, 0.4, 0, 0.6,
  '{
    "family": "general",
    "reward_task_type": "BringAKnightQualifiedReferral",
    "completion_signal": "qualified_referral_purchase",
    "service": "referralService",
    "primary_action": "share_invite",
    "deep_link": "wallet:tasks/bring-a-knight"
  }',
  '{
    "card_label": "Bring a Knight",
    "icon": "Users",
    "accent": "cyan",
    "reward_preview": "+2 KNYT per referral"
  }',
  true
),

-- 2. Knight of Attention — engagement / streak task
(
  'knyt', 'knyt:knight-of-attention',
  'Knight of Attention',
  'Complete episodes to earn rewards. Build weekly streaks for bonus KNYT.',
  'community', 1, 2, 'usage_based',
  0, 0, 0.5,
  0, 0.3, 0, 0, 0.7,
  '{
    "family": "general",
    "reward_task_type": "KnightOfAttentionEpisodeComplete",
    "streak_reward_task_type": "KnightOfAttentionWeeklyStreak",
    "streak_bonus_reward_task_type": "KnightOfAttentionStreakBonus",
    "completion_signal": "episode_complete",
    "service": "engagementService",
    "primary_action": "open_codex_scrolls",
    "deep_link": "knyt-codex:scrolls"
  }',
  '{
    "card_label": "Knight of Attention",
    "icon": "Flame",
    "accent": "purple",
    "reward_preview": "+0.5 KNYT per episode · streak bonuses",
    "weekly_target": 2
  }',
  true
),

-- 3. Herald of the Order — social sharing task
(
  'knyt', 'knyt:herald-of-the-order',
  'Herald of the Order',
  'Share content and earn rewards when others click, sign up, or purchase.',
  'community', 1, 2, 'usage_based',
  0, 0, 0.25,
  0, 0.2, 0.2, 0, 0.6,
  '{
    "family": "general",
    "reward_task_type": "HeraldCuriosityClicks",
    "signup_reward_task_type": "HeraldAudienceSignups",
    "conversion_reward_task_type": "HeraldConversionPayingUser",
    "completion_signal": "share_attribution",
    "service": "engagementService",
    "primary_action": "share_content",
    "deep_link": "wallet:tasks/herald"
  }',
  '{
    "card_label": "Herald of the Order",
    "icon": "Trophy",
    "accent": "amber",
    "reward_preview": "+0.25 KNYT per click · escalates with signups + conversions",
    "click_target": 10,
    "signup_target": 3
  }',
  true
)

ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title                 = EXCLUDED.title,
  description           = EXCLUDED.description,
  category              = EXCLUDED.category,
  difficulty_level      = EXCLUDED.difficulty_level,
  expected_impact_level = EXCLUDED.expected_impact_level,
  verification_mode     = EXCLUDED.verification_mode,
  reward_knyt           = EXCLUDED.reward_knyt,
  rep_weight_technical       = EXCLUDED.rep_weight_technical,
  rep_weight_creative        = EXCLUDED.rep_weight_creative,
  rep_weight_entrepreneurial = EXCLUDED.rep_weight_entrepreneurial,
  rep_weight_data_arch       = EXCLUDED.rep_weight_data_arch,
  rep_weight_community       = EXCLUDED.rep_weight_community,
  schema_json           = EXCLUDED.schema_json,
  metadata              = EXCLUDED.metadata,
  is_active             = EXCLUDED.is_active,
  updated_at            = now();
