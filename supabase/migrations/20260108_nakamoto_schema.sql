-- Auto-generated Nakamoto schema mirror
-- Source: https://ysykvckvggaqykhhntyo.supabase.co
-- Generated at: 2026-01-04T11:56:39.962Z

CREATE TABLE IF NOT EXISTS public."nakamoto_agent_branches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agent_site_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "display_name" text NOT NULL,
  "short_summary" text,
  "long_context_md" text,
  "values_json" jsonb NOT NULL,
  "tone" text,
  "audience" text,
  "safety_notes_md" text,
  "system_prompt_template_md" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_agent_sites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "site_slug" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "branding_json" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "seeded_at" timestamptz,
  "seed_status" text DEFAULT 'pending',
  "display_name" text NOT NULL,
  "brand_identity" jsonb,
  "is_master" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_aigents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agent_site_id" uuid NOT NULL,
  "name" text NOT NULL,
  "agent_kind" text DEFAULT 'custom' NOT NULL,
  "is_system_agent" boolean DEFAULT false NOT NULL,
  "is_mutable" boolean DEFAULT true NOT NULL,
  "system_prompt_md" text DEFAULT '' NOT NULL,
  "runtime_prefs_json" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_asset_policies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "rights" text[] NOT NULL,
  "price_amount" numeric DEFAULT 0,
  "price_asset" text DEFAULT 'QCT',
  "pay_to_did" text NOT NULL,
  "tokenqube_template" text,
  "visibility" text DEFAULT 'private',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "table_name" text NOT NULL,
  "record_id" uuid NOT NULL,
  "action" text NOT NULL,
  "old_values" jsonb,
  "new_values" jsonb,
  "user_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "agent_site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_blak_qubes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "Profession" text DEFAULT '' NOT NULL,
  "Web3-Interests" text[] NOT NULL,
  "Local-City" text DEFAULT '' NOT NULL,
  "Email" text DEFAULT '' NOT NULL,
  "EVM-Public-Key" text DEFAULT '' NOT NULL,
  "BTC-Public-Key" text DEFAULT '' NOT NULL,
  "Tokens-of-Interest" text[] NOT NULL,
  "Chain-IDs" text[] NOT NULL,
  "Wallets-of-Interest" text[] NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "LinkedIn-ID" text DEFAULT '',
  "LinkedIn-Profile-URL" text DEFAULT '',
  "Twitter-Handle" text DEFAULT '',
  "Telegram-Handle" text DEFAULT '',
  "Discord-Handle" text DEFAULT '',
  "Instagram-Handle" text DEFAULT '',
  "GitHub-Handle" text DEFAULT '',
  "First-Name" text DEFAULT '',
  "Last-Name" text DEFAULT '',
  "Qrypto-ID" text DEFAULT '',
  "ThirdWeb-Public-Key" text DEFAULT '',
  "YouTube-ID" text DEFAULT '',
  "Facebook-ID" text DEFAULT '',
  "TikTok-Handle" text DEFAULT '',
  "KNYT-ID" text DEFAULT '',
  "Phone-Number" text DEFAULT '',
  "Age" text DEFAULT '',
  "Address" text DEFAULT '',
  "OM-Member-Since" text DEFAULT '',
  "OM-Tier-Status" text DEFAULT '',
  "Metaiye-Shares-Owned" text DEFAULT '',
  "KNYT-COYN-Owned" text DEFAULT '',
  "MetaKeep-Public-Key" text DEFAULT '',
  "Motion-Comics-Owned" text DEFAULT '',
  "Paper-Comics-Owned" text DEFAULT '',
  "Digital-Comics-Owned" text DEFAULT '',
  "KNYT-Posters-Owned" text DEFAULT '',
  "KNYT-Cards-Owned" text DEFAULT '',
  "Characters-Owned" text DEFAULT '',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_chat_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_data" jsonb,
  "last_message_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_content_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "strand" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "order_index" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "agent_site_id" uuid,
  "pillar_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_content_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "strand" text NOT NULL,
  "category_id" uuid,
  "tags" text[],
  "type" text NOT NULL,
  "status" text DEFAULT 'draft',
  "publish_at" timestamptz,
  "featured" boolean DEFAULT false,
  "pinned" boolean DEFAULT false,
  "cover_image_id" uuid,
  "owner_id" uuid NOT NULL,
  "social_source" text,
  "social_url" text,
  "social_embed_html" text,
  "og_json" jsonb,
  "has_captions" boolean DEFAULT false,
  "has_transcript" boolean DEFAULT false,
  "views_count" integer DEFAULT 0,
  "completions_count" integer DEFAULT 0,
  "l2e_points" integer DEFAULT 0,
  "l2e_quiz_url" text,
  "l2e_cta_label" text,
  "l2e_cta_url" text,
  "iqube_policy_json" jsonb,
  "content_qube_id" text,
  "token_qube_ref" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "agent_site_id" uuid,
  "pillar_id" uuid,
  "accessibility_json" jsonb NOT NULL,
  "analytics_json" jsonb NOT NULL,
  "contentqube_id" text,
  "tokenqube_ref" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_conversation_summaries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "conversation_type" text NOT NULL,
  "summary_text" text NOT NULL,
  "included_interaction_ids" text[] NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_crm_interactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agent_site_id" uuid NOT NULL,
  "profile_id" uuid,
  "kind" text NOT NULL,
  "item_id" uuid,
  "pillar_id" uuid,
  "score_delta" integer DEFAULT 0 NOT NULL,
  "data_json" jsonb NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_crm_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agent_site_id" uuid NOT NULL,
  "user_id" uuid,
  "email" text,
  "handle" text,
  "segments" text[] NOT NULL,
  "consents_json" jsonb NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_did_identities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "did" text NOT NULL,
  "kybe_did" text,
  "agent_handle" text,
  "user_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_email_batches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" text NOT NULL,
  "total_emails" integer NOT NULL,
  "emails_sent" integer DEFAULT 0 NOT NULL,
  "emails_failed" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_entitlements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "x402_id" uuid,
  "asset_id" uuid NOT NULL,
  "holder_did" text NOT NULL,
  "holder_user_id" uuid,
  "rights" text[] NOT NULL,
  "tokenqube_id" text,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_invitation_signup_stats" (
  "invitation_date" timestamptz,
  "persona_type" text,
  "total_invitations" bigint,
  "completed_signups" bigint,
  "emails_sent" bigint,
  "pending_signups" bigint,
  "conversion_rate_percent" numeric
);

CREATE TABLE IF NOT EXISTS public."nakamoto_invited_users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "invitation_token" text DEFAULT (gen_random_uuid()) NOT NULL,
  "persona_type" text NOT NULL,
  "persona_data" jsonb NOT NULL,
  "invited_at" timestamptz DEFAULT now() NOT NULL,
  "invited_by" text,
  "signup_completed" boolean DEFAULT false NOT NULL,
  "completed_at" timestamptz,
  "expires_at" timestamptz DEFAULT (now() + '30 days'::interval) NOT NULL,
  "email_sent" boolean DEFAULT false NOT NULL,
  "email_sent_at" timestamptz,
  "batch_id" text,
  "send_attempts" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_knyt_persona_rewards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "linkedin_connected" boolean DEFAULT false,
  "metamask_connected" boolean DEFAULT false,
  "data_completed" boolean DEFAULT false,
  "reward_claimed" boolean DEFAULT false,
  "reward_amount" integer DEFAULT 2800,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_knyt_personas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "First-Name" text DEFAULT '',
  "Last-Name" text DEFAULT '',
  "KNYT-ID" text DEFAULT '',
  "Profession" text DEFAULT '',
  "Local-City" text DEFAULT '',
  "Email" text DEFAULT '',
  "Phone-Number" text DEFAULT '',
  "Age" text DEFAULT '',
  "Address" text DEFAULT '',
  "EVM-Public-Key" text DEFAULT '',
  "BTC-Public-Key" text DEFAULT '',
  "ThirdWeb-Public-Key" text DEFAULT '',
  "MetaKeep-Public-Key" text DEFAULT '',
  "Chain-IDs" text[],
  "Web3-Interests" text[],
  "Tokens-of-Interest" text[],
  "LinkedIn-ID" text DEFAULT '',
  "LinkedIn-Profile-URL" text DEFAULT '',
  "Twitter-Handle" text DEFAULT '',
  "Telegram-Handle" text DEFAULT '',
  "Discord-Handle" text DEFAULT '',
  "Instagram-Handle" text DEFAULT '',
  "YouTube-ID" text DEFAULT '',
  "Facebook-ID" text DEFAULT '',
  "TikTok-Handle" text DEFAULT '',
  "OM-Member-Since" text DEFAULT '',
  "OM-Tier-Status" text DEFAULT '',
  "Metaiye-Shares-Owned" text DEFAULT '',
  "KNYT-COYN-Owned" text DEFAULT '',
  "Motion-Comics-Owned" text DEFAULT '',
  "Paper-Comics-Owned" text DEFAULT '',
  "Digital-Comics-Owned" text DEFAULT '',
  "KNYT-Posters-Owned" text DEFAULT '',
  "KNYT-Cards-Owned" text DEFAULT '',
  "Characters-Owned" text DEFAULT '',
  "Total-Invested" text DEFAULT '',
  "Wallets-of-Interest" text[],
  "profile_image_url" text DEFAULT '',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_master_site_updates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "source_site_id" uuid NOT NULL,
  "update_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "entity_data" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "target_sites" uuid[],
  "created_by" uuid NOT NULL,
  "approved_by" uuid,
  "pushed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "notes" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_media_assets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "content_item_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "storage_path" text,
  "external_url" text,
  "oembed_html" text,
  "duration_seconds" integer,
  "width" integer,
  "height" integer,
  "transcript_path" text,
  "caption_path" text,
  "checksum" text,
  "filesize_bytes" bigint,
  "mime_type" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_media_content" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "content_type" text NOT NULL,
  "category" text NOT NULL,
  "file_url" text,
  "thumbnail_url" text,
  "duration" integer,
  "difficulty_level" integer,
  "reward_points" integer DEFAULT 0,
  "is_featured" boolean DEFAULT false,
  "is_published" boolean DEFAULT false,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_mission_pillars" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agent_site_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "short_summary" text,
  "long_context_md" text,
  "goals_json" jsonb NOT NULL,
  "kpis_json" jsonb NOT NULL,
  "default_utilities_json" jsonb NOT NULL,
  "iqube_policy_json" jsonb,
  "contentqube_id" text,
  "tokenqube_ref" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_mm_super_admins" (
  "user_id" uuid,
  "email" text,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."nakamoto_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "first_name" text,
  "last_name" text,
  "avatar_url" text,
  "total_points" integer DEFAULT 0,
  "level" integer DEFAULT 1,
  "preferences" jsonb,
  "civic_status" text DEFAULT 'not_verified',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "email" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_qripto_personas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "First-Name" text DEFAULT '',
  "Last-Name" text DEFAULT '',
  "Qripto-ID" text DEFAULT '',
  "Profession" text DEFAULT '',
  "Local-City" text DEFAULT '',
  "Email" text DEFAULT '',
  "EVM-Public-Key" text DEFAULT '',
  "BTC-Public-Key" text DEFAULT '',
  "Chain-IDs" text[],
  "Wallets-of-Interest" text[],
  "Web3-Interests" text[],
  "Tokens-of-Interest" text[],
  "LinkedIn-ID" text DEFAULT '',
  "LinkedIn-Profile-URL" text DEFAULT '',
  "Twitter-Handle" text DEFAULT '',
  "Telegram-Handle" text DEFAULT '',
  "Discord-Handle" text DEFAULT '',
  "Instagram-Handle" text DEFAULT '',
  "GitHub-Handle" text DEFAULT '',
  "YouTube-ID" text DEFAULT '',
  "Facebook-ID" text DEFAULT '',
  "TikTok-Handle" text DEFAULT '',
  "profile_image_url" text DEFAULT '',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_role_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "target_user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "role" text NOT NULL,
  "agent_site_id" uuid,
  "details" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_security_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "event_type" text NOT NULL,
  "event_data" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_setup_drafts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "setup_state" jsonb NOT NULL,
  "current_step" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_social_connections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "connected" boolean DEFAULT false,
  "account_handle" text,
  "oauth_meta" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_connections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "service" text NOT NULL,
  "connected_at" timestamptz DEFAULT now() NOT NULL,
  "connection_data" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_content_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "content_item_id" uuid NOT NULL,
  "status" text DEFAULT 'started',
  "progress_percentage" integer DEFAULT 0,
  "completed_at" timestamptz,
  "score" integer,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_interactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "query" text NOT NULL,
  "response" text NOT NULL,
  "interaction_type" text NOT NULL,
  "metadata" jsonb,
  "summarized" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_name_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "persona_type" text NOT NULL,
  "name_source" text NOT NULL,
  "custom_first_name" text,
  "custom_last_name" text,
  "linkedin_first_name" text,
  "linkedin_last_name" text,
  "invitation_first_name" text,
  "invitation_last_name" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "content_id" uuid NOT NULL,
  "progress_percentage" integer DEFAULT 0,
  "completed_at" timestamptz,
  "rewards_earned" integer DEFAULT 0,
  "quiz_scores" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "agent_site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_user_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "device_info" jsonb,
  "active" boolean DEFAULT true NOT NULL,
  "session_end" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_utilities_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "agent_site_id" uuid NOT NULL,
  "content_creation_on" boolean DEFAULT true NOT NULL,
  "teaching_on" boolean DEFAULT false NOT NULL,
  "commercial_on" boolean DEFAULT false NOT NULL,
  "social_on" boolean DEFAULT true NOT NULL,
  "teaching_opts_json" jsonb NOT NULL,
  "commercial_opts_json" jsonb NOT NULL,
  "social_opts_json" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."nakamoto_x402_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "buyer_did" text NOT NULL,
  "seller_did" text NOT NULL,
  "asset_id" uuid NOT NULL,
  "amount" numeric NOT NULL,
  "asset_symbol" text NOT NULL,
  "src_chain" text,
  "dest_chain" text,
  "status" text DEFAULT 'initiated',
  "request_id" text NOT NULL,
  "facilitator_ref" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);
