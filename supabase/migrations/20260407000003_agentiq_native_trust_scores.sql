-- AgentiQ Native Trust Scores seed
-- Seeds registry_trust_scores for the 8 AgentiQ native assets.
-- Factors reflect first-party, known-good assets with no external validation pipeline.
-- Run AFTER 20260407000002_agentiq_native_registry_assets.sql

INSERT INTO registry_trust_scores (
  score_id, asset_id, validation_id, trust_band, numeric_score, factors, explanation, computed_by, created_at
) VALUES

-- Image Generation — OpenAI (L3, 72)
('score_agentiq_native_image_openai', 'agentiq-native-image-openai', NULL,
 'L3_PRODUCTION_CANDIDATE', 72.00,
 '{"provenanceQuality": 0.85, "licenseClarity": 0.55, "maintenancePosture": 0.85, "dependencyRisk": 0.95, "privilegeFootprint": 0.80, "validationPassQuality": 0.50, "reproducibility": 0.80, "wrapperIsolationQuality": 0.70}',
 'AgentiQ native first-party asset. Provenance known, no external license artifact, version pinned, no external deps, network_limited privilege, http wrapper.',
 'agentiq-system', now()),

-- Image Generation — Venice (L3, 69)
('score_agentiq_native_image_venice', 'agentiq-native-image-venice', NULL,
 'L3_PRODUCTION_CANDIDATE', 69.00,
 '{"provenanceQuality": 0.80, "licenseClarity": 0.50, "maintenancePosture": 0.80, "dependencyRisk": 0.95, "privilegeFootprint": 0.80, "validationPassQuality": 0.45, "reproducibility": 0.75, "wrapperIsolationQuality": 0.70}',
 'AgentiQ native first-party asset. Venice AI third-party provider reduces provenance and validation confidence slightly vs OpenAI.',
 'agentiq-system', now()),

-- Video Generation — Sora (Curated, L4, 79)
('score_agentiq_native_video_sora_curated', 'agentiq-native-video-sora-curated', NULL,
 'L4_PRODUCTION_APPROVED', 79.00,
 '{"provenanceQuality": 0.90, "licenseClarity": 0.70, "maintenancePosture": 0.90, "dependencyRisk": 1.00, "privilegeFootprint": 0.80, "validationPassQuality": 0.65, "reproducibility": 0.85, "wrapperIsolationQuality": 0.70}',
 'AgentiQ native first-party curated Sora asset. High curation quality, zero external deps, strong provenance. OpenAI-sourced.',
 'agentiq-system', now()),

-- Video Generation — Venice (L4, 82)
('score_agentiq_native_video_venice', 'agentiq-native-video-venice', NULL,
 'L4_PRODUCTION_APPROVED', 82.00,
 '{"provenanceQuality": 0.90, "licenseClarity": 0.75, "maintenancePosture": 0.90, "dependencyRisk": 1.00, "privilegeFootprint": 0.80, "validationPassQuality": 0.70, "reproducibility": 0.90, "wrapperIsolationQuality": 0.70}',
 'AgentiQ native Venice video generation. Strong isolation, no external deps, excellent reproducibility track record in production.',
 'agentiq-system', now()),

-- Video Generation — Sora (Community, L2, 52)
('score_agentiq_native_video_sora_community', 'agentiq-native-video-sora-community', NULL,
 'L2_VERIFIED_COMMUNITY', 52.00,
 '{"provenanceQuality": 0.45, "licenseClarity": 0.40, "maintenancePosture": 0.70, "dependencyRisk": 0.80, "privilegeFootprint": 0.60, "validationPassQuality": 0.35, "reproducibility": 0.60, "wrapperIsolationQuality": 0.70}',
 'Community-sourced Sora pipeline. Lower provenance certainty and validation coverage vs curated tier. Intentionally capped at L2.',
 'agentiq-system', now()),

-- Article / Story Generation (L3, 70)
('score_agentiq_native_article_generation', 'agentiq-native-article-generation', NULL,
 'L3_PRODUCTION_CANDIDATE', 70.00,
 '{"provenanceQuality": 0.85, "licenseClarity": 0.55, "maintenancePosture": 0.85, "dependencyRisk": 0.95, "privilegeFootprint": 0.80, "validationPassQuality": 0.50, "reproducibility": 0.80, "wrapperIsolationQuality": 0.70}',
 'AgentiQ native LLM article generation. Known origin, stable endpoint, no external deps, http wrapper with prompt isolation.',
 'agentiq-system', now()),

-- Image + Article Bundle (WorkflowQube, L3, 68)
('score_agentiq_native_image_article_bundle', 'agentiq-native-image-article-bundle', NULL,
 'L3_PRODUCTION_CANDIDATE', 68.00,
 '{"provenanceQuality": 0.85, "licenseClarity": 0.50, "maintenancePosture": 0.85, "dependencyRisk": 0.90, "privilegeFootprint": 0.80, "validationPassQuality": 0.45, "reproducibility": 0.75, "wrapperIsolationQuality": 0.80}',
 'AgentiQ native inline workflow bundle. Sequencing: image_first. Composed of image_generation + article_draft + deployment blocks. Workflow isolation high.',
 'agentiq-system', now()),

-- Video + Article Bundle (WorkflowQube, L3, 66)
('score_agentiq_native_video_article_bundle', 'agentiq-native-video-article-bundle', NULL,
 'L3_PRODUCTION_CANDIDATE', 66.00,
 '{"provenanceQuality": 0.85, "licenseClarity": 0.50, "maintenancePosture": 0.80, "dependencyRisk": 0.90, "privilegeFootprint": 0.80, "validationPassQuality": 0.40, "reproducibility": 0.70, "wrapperIsolationQuality": 0.80}',
 'AgentiQ native inline workflow bundle. Sequencing: video_first. Composed of video_generation + article_draft + deployment blocks. Workflow isolation high.',
 'agentiq-system', now())

ON CONFLICT (score_id) DO UPDATE SET
  trust_band    = EXCLUDED.trust_band,
  numeric_score = EXCLUDED.numeric_score,
  factors       = EXCLUDED.factors,
  explanation   = EXCLUDED.explanation;

-- Restore declared trust_band on assets in case validation runs overwrote them
UPDATE registry_assets SET trust_band = 'L3_PRODUCTION_CANDIDATE', updated_at = now()
  WHERE asset_id IN (
    'agentiq-native-image-openai',
    'agentiq-native-image-venice',
    'agentiq-native-article-generation',
    'agentiq-native-image-article-bundle',
    'agentiq-native-video-article-bundle'
  );
UPDATE registry_assets SET trust_band = 'L4_PRODUCTION_APPROVED', updated_at = now()
  WHERE asset_id IN (
    'agentiq-native-video-sora-curated',
    'agentiq-native-video-venice'
  );
UPDATE registry_assets SET trust_band = 'L2_VERIFIED_COMMUNITY', updated_at = now()
  WHERE asset_id = 'agentiq-native-video-sora-community';
