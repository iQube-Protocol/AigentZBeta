-- Human Mobility Services PRD amendment: candidate agents gain a
-- human_mobility model (time horizons x top/bottom reference cases x
-- mobility domains x process-spine coverage). Additive — the existing
-- top_bottom_relevance column remains the Exec/Vulnerable UI source.

ALTER TABLE marketa.marketa_candidate_agents
  ADD COLUMN IF NOT EXISTS human_mobility JSONB NOT NULL DEFAULT
  '{"supportsShortTerm":false,"supportsMediumTerm":false,"supportsLongTerm":false,"supportsTopReferenceCase":false,"supportsBottomReferenceCase":false,"mobilityDomains":[],"processSpineSupport":[]}'::jsonb;

COMMENT ON COLUMN marketa.marketa_candidate_agents.human_mobility IS
  'Human Mobility Services model (PRD amendment): short/medium/long-term horizons, top (corporate/executive) and bottom (stateless/vulnerable) reference cases, mobility domains, shared process-spine support.';

-- Terminology refactor: mobility_residency_being -> human_mobility_services.
UPDATE marketa.marketa_candidate_agents
SET strategic_lanes = (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN lane = '"mobility_residency_being"'::jsonb
         THEN '"human_mobility_services"'::jsonb
         ELSE lane END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(strategic_lanes) AS lane
)
WHERE strategic_lanes @> '["mobility_residency_being"]'::jsonb;
