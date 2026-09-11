-- 20260905030000_aigentqube_factor_aegis_registry_assets.sql
--
-- Factor + Aegis 0.1 (GJR-FAC-001) canonical identity provisioning, operator
-- directive 2026-09-05. Mirrors the exact registry_assets + iqube_id_map
-- pattern already established for MoneyPenny/Nakamoto/Kn0w1
-- (20260930000400_aigentqube_moneypenny_registry_asset.sql and siblings) —
-- one asset_id per agent, no wallet address ever stored here (agent_keys is
-- the sole custody path; this row is read-projected at hydrate time by
-- services/registry/adapters/aigentQubeAdapter.ts), a matching iqube_id_map
-- row in the SAME migration (the MoneyPenny pass was the first to close that
-- gap for a new agent; do not regress to the earlier four agents' pattern of
-- skipping it).
--
-- Honesty on maturity (operator: "publication state appropriate to its
-- actual maturity"): NEITHER agent has been through an admission decision,
-- a ratified Aegis assessment, or a confirmed Horizen registration yet —
-- both are seeded 'draft' / 'L1_EXPERIMENTAL', never MoneyPenny's
-- 'published' / 'L4_PRODUCTION_APPROVED'. Capabilities are drawn from the
-- ratified Factor/Aegis PRD (GJR-FAC-001) and from the real service
-- surfaces built in the Phase 1/2 passes (services/factor/*,
-- services/aegis/*, app/api/moneypenny/factor/*, app/api/moneypenny/aegis/*)
-- — never invented.
--
-- Factor carries an external_registry_bindings entry (status
-- 'pending-registration', network 'base-sepolia', identity_registry_contract
-- from services/horizen/identity.ts's HORIZEN_NETWORK_FACTS — the same real
-- contract address MoneyPenny/Nakamoto/Kn0w1's own bindings use) because it
-- is a registrableAgents.ts entry undergoing the Horizen Register/Verify/
-- Claim journey. Aegis carries NO such binding — it is an independent
-- assessor, never itself a Horizen-registrable candidate agent (operator,
-- 2026-09-05: "Aegis needs a canonical owner/control EVM wallet for
-- identity, signing and its MetaMe wallet projection" only — no mention of
-- Horizen registration, unlike Factor's explicit "initial Horizen network /
-- status" identifiers). Fabricating a pending-registration claim Aegis will
-- never pursue would misrepresent its actual role.

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES
(
  'aigentqube-factor',
  'platform',
  'AigentQube',
  'Factor',
  'aigent-factor',
  'Factor 0.1 (GJR-FAC-001) — MoneyPenny''s candidate-intake pipeline agent. Factor resolves whether a candidate agent already has a case, walks its evidence checklist (capability declarations, endpoints, code provenance), requests an independent Aegis assessment once evidence is complete, and may PROPOSE a standing event for an admitted agent. Factor structurally CANNOT decide admission — that is MoneyPenny''s sole authority (services/moneypenny/admissionAuthority.ts); Factor also cannot assess a candidate it is itself the subject of. Factor is a bounded Agent Participant, never a principal: every consequential act requires human/MoneyPenny approval.',
  '0.1.0',
  'L1_EXPERIMENTAL',
  'draft',
  'human_approval_required',
  'skill',
  '{"input": {"caseId": "string", "candidateIdentityKey": "string"}, "output": {"case": "object", "evidence": "array", "receipts": "array"}}',
  '[{"name": "candidate_intake", "scope": "system"}, {"name": "evidence_checklist_management", "scope": "system"}, {"name": "standing_event_proposal", "scope": "system"}]',
  '["moneypenny", "candidate-intake", "journey-facilitation", "delegate", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "F",
    "source": "agentiq_core",
    "metaMePosture": "standard",
    "skillCount": 3,
    "cannotDecideAdmission": true,
    "cannotSelfAssess": true,
    "external_registry_bindings": [
      {
        "protocol": "erc-8004",
        "registry": "horizen",
        "network": "base-sepolia",
        "identity_registry_contract": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        "token_id": null,
        "registry_alias": null,
        "status": "pending-registration",
        "agent_card_url": "/api/agents/factor/agent-card.json"
      }
    ]
  }',
  'agentiq-system'
),
(
  'aigentqube-aegis',
  'platform',
  'AigentQube',
  'Aegis',
  'aigent-aegis',
  'Aegis 0.1 (GJR-FAC-001) — the independent assessment and assurance agent for MoneyPenny''s candidate-intake pipeline. Aegis produces evidence-bound, versioned, immutable findings per assessment dimension and may recommend admissibility, but structurally CANNOT decide admission (services/moneypenny/admissionAuthority.ts is the sole authority) and CANNOT assess a candidate that is itself the requester (enforced in application code AND by a DB CHECK constraint, chk_aegis_assessments_not_self_assessed). A single critical failed finding overrides an otherwise-passing aggregate score. Aegis is an assessor, not a financial execution agent — it receives no trading or settlement wallet.',
  '0.1.0',
  'L1_EXPERIMENTAL',
  'draft',
  'human_approval_required',
  'skill',
  '{"input": {"subjectType": "string", "subjectRef": "string", "evidenceSnapshot": "object"}, "output": {"assessment": "object", "findings": "array"}}',
  '[{"name": "independent_assessment", "scope": "system"}, {"name": "evidence_bound_findings", "scope": "system"}]',
  '["moneypenny", "independent-assessment", "assurance", "delegate", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "A",
    "source": "agentiq_core",
    "metaMePosture": "standard",
    "skillCount": 2,
    "cannotDecideAdmission": true,
    "cannotSelfAssess": true
  }',
  'agentiq-system'
)

-- Idempotent re-run guard, mirroring the identical MoneyPenny/Nakamoto
-- pattern: a blind overwrite would erase a confirmed on-chain
-- registration (Factor's token_id) once one exists.
ON CONFLICT (asset_id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  trust_band         = EXCLUDED.trust_band,
  publication_status = EXCLUDED.publication_status,
  capabilities       = EXCLUDED.capabilities,
  tags               = EXCLUDED.tags,
  metadata           = CASE
    WHEN registry_assets.metadata #>> '{external_registry_bindings,0,token_id}' IS NOT NULL
      THEN EXCLUDED.metadata || jsonb_build_object(
             'external_registry_bindings',
             registry_assets.metadata -> 'external_registry_bindings')
    ELSE EXCLUDED.metadata
  END,
  updated_at         = now();

INSERT INTO iqube_id_map (source, source_id, primitive_type, synthetic, notes)
VALUES
  ('registry_asset', 'aigentqube-factor', 'AigentQube', false,
   'GJR-FAC-001 — Factor''s canonical AigentQube, backing its Horizen ERC-8004 external-registry binding'),
  ('registry_asset', 'aigentqube-aegis', 'AigentQube', false,
   'GJR-FAC-001 — Aegis''s canonical AigentQube. No Horizen binding: Aegis is an independent assessor, not a Horizen-registrable candidate agent.')
ON CONFLICT (source, source_id) DO NOTHING;
