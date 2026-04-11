-- AgentiQ Native Registry Assets seed
-- Seeds the 6 Studio Skills + 2 Studio Bundles shown in the Composer Workflows tab
-- as first-class registry_assets with full factory metadata and agentiq_native badge.
-- These are the canonical AgentiQ-native assets; all are pre-published at L3/L4.
--
-- Run AFTER 20260402010000_registry_ingestion_factory_v1.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- Studio Skills (SkillQube)
-- ─────────────────────────────────────────────────────────────────────────────

(
  'agentiq-native-image-openai',
  'platform',
  'SkillQube',
  'Image Generation — OpenAI',
  'agentiq-native-image-openai',
  'Generate portrait and landscape hero imagery via OpenAI DALL·E / gpt-image-1.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'http',
  '{"input": {"prompt": "string", "style": "string", "aspect_ratio": "string"}, "output": {"image_url": "string", "model": "string"}}',
  '[{"name": "image_generation", "scope": "editorial", "provider": "openai", "models": ["dall-e-3", "gpt-image-1"]}]',
  '["image", "openai", "editorial"]',
  '{"agentiq_native": true, "badge": "A", "trust_composite": 75, "source": "agentiq_studio_native", "studio_skill_id": "skill:image_openai", "wrapper_endpoint": "/api/generate/image", "provider": "openai"}',
  'agentiq-system'
),

(
  'agentiq-native-image-venice',
  'platform',
  'SkillQube',
  'Image Generation — Venice',
  'agentiq-native-image-venice',
  'Generate portrait and landscape imagery via Venice AI (venice-sd35, flux-2-pro).',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'http',
  '{"input": {"prompt": "string", "model": "string", "aspect_ratio": "string"}, "output": {"image_url": "string", "model": "string"}}',
  '[{"name": "image_generation", "scope": "editorial", "provider": "venice", "models": ["venice-sd35", "flux-2-pro"]}]',
  '["image", "venice", "editorial"]',
  '{"agentiq_native": true, "badge": "A", "trust_composite": 73, "source": "agentiq_studio_native", "studio_skill_id": "skill:image_venice", "wrapper_endpoint": "/api/generate/image", "provider": "venice"}',
  'agentiq-system'
),

(
  'agentiq-native-video-sora-curated',
  'platform',
  'SkillQube',
  'Video Generation — Sora (Curated)',
  'agentiq-native-video-sora-curated',
  'First-party curated OpenAI Sora video generation. Badge A, trust composite 79.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'network_limited',
  'http',
  '{"input": {"prompt": "string", "duration": "number", "aspect_ratio": "string"}, "output": {"video_url": "string", "model": "string"}}',
  '[{"name": "video_generation", "scope": "editorial", "provider": "openai", "model": "sora", "curated": true}]',
  '["video", "sora", "openai", "curated"]',
  '{"agentiq_native": true, "badge": "A", "trust_composite": 79, "source": "agentiq_studio_native", "studio_skill_id": "skill:video_sora_curated", "wrapper_endpoint": "/api/generate/video", "provider": "openai", "curation_level": "first_party"}',
  'agentiq-system'
),

(
  'agentiq-native-video-venice',
  'platform',
  'SkillQube',
  'Video Generation — Venice',
  'agentiq-native-video-venice',
  'Venice AI video generation skill. Badge A, trust composite 82.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'network_limited',
  'http',
  '{"input": {"prompt": "string", "duration": "number", "model": "string"}, "output": {"video_url": "string", "model": "string"}}',
  '[{"name": "video_generation", "scope": "editorial", "provider": "venice"}]',
  '["video", "venice"]',
  '{"agentiq_native": true, "badge": "A", "trust_composite": 82, "source": "agentiq_studio_native", "studio_skill_id": "skill:video_venice", "wrapper_endpoint": "/api/generate/video", "provider": "venice"}',
  'agentiq-system'
),

(
  'agentiq-native-video-sora-community',
  'platform',
  'SkillQube',
  'Video Generation — Sora (Community)',
  'agentiq-native-video-sora-community',
  'Community-sourced Sora video generation. Badge C, trust composite 52.',
  '1.0.0',
  'L2_VERIFIED_COMMUNITY',
  'published',
  'network_limited',
  'http',
  '{"input": {"prompt": "string", "duration": "number"}, "output": {"video_url": "string", "model": "string"}}',
  '[{"name": "video_generation", "scope": "community", "provider": "openai", "model": "sora", "curated": false}]',
  '["video", "sora", "community"]',
  '{"agentiq_native": true, "badge": "C", "trust_composite": 52, "source": "agentiq_studio_native", "studio_skill_id": "skill:video_sora_community", "wrapper_endpoint": "/api/generate/video", "provider": "openai", "curation_level": "community"}',
  'agentiq-system'
),

(
  'agentiq-native-article-generation',
  'platform',
  'SkillQube',
  'Article / Story Generation',
  'agentiq-native-article-generation',
  'AI-authored editorial article and story drafts with takeaways, glossary, and sections.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'http',
  '{"input": {"topic": "string", "context": "string", "tone": "string", "sections": "array"}, "output": {"title": "string", "body": "string", "takeaways": "array", "glossary": "array"}}',
  '[{"name": "text_generation", "scope": "editorial", "output_format": "article", "provider": "llm"}]',
  '["article", "editorial", "copy"]',
  '{"agentiq_native": true, "badge": "A", "trust_composite": 75, "source": "agentiq_studio_native", "studio_skill_id": "skill:article_generation", "wrapper_endpoint": "/api/generate/article"}',
  'agentiq-system'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- Studio Bundles (WorkflowQube)
-- ─────────────────────────────────────────────────────────────────────────────

(
  'agentiq-native-image-article-bundle',
  'platform',
  'WorkflowQube',
  'Image + Article Bundle',
  'agentiq-native-image-article-bundle',
  'Lock hero imagery first, then layer editorial copy. Deploys as an article experience with visual context.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'workflow',
  '{"input": {"topic": "string", "image_prompt": "string", "tone": "string"}, "output": {"experience_id": "string", "image_url": "string", "article": "object"}}',
  '[{"name": "bundled_experience", "blocks": ["image_generation", "article_draft", "deployment"], "engine": "inline", "sequencing": "image_first"}]',
  '["image generation", "article draft", "deployment"]',
  '{"agentiq_native": true, "source": "agentiq_studio_native", "studio_skill_id": "workflow:image_article_bundle", "engine": "inline", "preset_id": "image_article_bundle", "block_sequence": ["image_generation", "article_draft", "deployment"], "component_skill_ids": ["skill:image_openai", "skill:image_venice", "skill:article_generation"]}',
  'agentiq-system'
),

(
  'agentiq-native-video-article-bundle',
  'platform',
  'WorkflowQube',
  'Video + Article Bundle',
  'agentiq-native-video-article-bundle',
  'Motion-led generation with editorial support for Make-oriented watch experiences.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'workflow',
  '{"input": {"topic": "string", "video_prompt": "string", "tone": "string"}, "output": {"experience_id": "string", "video_url": "string", "article": "object"}}',
  '[{"name": "bundled_experience", "blocks": ["video_generation", "article_draft", "deployment"], "engine": "inline", "sequencing": "video_first"}]',
  '["video generation", "article draft", "deployment"]',
  '{"agentiq_native": true, "source": "agentiq_studio_native", "studio_skill_id": "workflow:video_article_bundle", "engine": "inline", "preset_id": "video_article_bundle", "block_sequence": ["video_generation", "article_draft", "deployment"], "component_skill_ids": ["skill:video_sora_curated", "skill:video_venice", "skill:video_sora_community", "skill:article_generation"]}',
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
