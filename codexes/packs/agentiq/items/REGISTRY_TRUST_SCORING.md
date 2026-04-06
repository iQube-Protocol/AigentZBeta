# Registry Trust Scoring — Operator Reference

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06  
**Audience:** AgentiQ operators, contributors, integration reviewers

---

## Overview

Every asset in the Registry carries a **trust score** — a numeric 0–100 composite and a derived **Trust Band** (L1–L5). Trust scoring answers the question: *how much can the platform safely rely on this asset?*

Scores are computed automatically when validation completes. Operators can re-run validation at any time from the iQube Registry → Asset Detail → Validation tab.

---

## Trust Bands

| Band | Numeric range | Meaning | Permitted use |
|------|--------------|---------|--------------|
| **L1 Experimental** | 0 – 29 | Unverified, community-submitted, limited provenance | Sandboxed testing only |
| **L2 Verified Community** | 30 – 54 | Basic provenance confirmed, some validation passed | Non-critical compositions |
| **L3 Production Candidate** | 55 – 74 | Good provenance, most validation passed, known deps | Standard Studio compositions |
| **L4 Production Approved** | 75 – 89 | Strong across all factors, full validation passed | Production experiences |
| **L5 Core Sovereign** | 90 – 100 | Platform-core, maximum isolation, zero dep risk | Platform-level components |

Trust bands are enforced as **hard ceilings** — validation artifacts can cap an asset below its scored band (e.g. a failed secret scan forces a ceiling of L2 regardless of the numeric score).

---

## The 8 Trust Factors

Trust is computed as a weighted composite of 8 factors. Each factor is a value from 0.0 to 1.0.

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| `provenanceQuality` | **15%** | Is the origin known and verifiable? Does the manifest include a repository URL and author? |
| `licenseClarity` | **20%** | Is the license clearly identified and compatible? Was a `license_check` validation artifact produced and passed? |
| `maintenancePosture` | **10%** | Is the source actively maintained? Is a version pinned in the manifest? |
| `dependencyRisk` | **10%** | How well are dependencies managed? Inverted: 1.0 = zero deps (lowest risk) |
| `privilegeFootprint` | **15%** | How minimal is the privilege requirement? Inverted: `read_only` = 1.0, `human_approval_required` = 0.3 |
| `validationPassQuality` | **20%** | What fraction of validation stages passed? |
| `reproducibility` | **5%** | Is execution deterministic? Was a `reproducibility` validation artifact produced? |
| `wrapperIsolationQuality` | **5%** | How well is the asset isolated in its wrapper? `cli_container`/`skill` = 0.9, `http` = 0.7, `browser` = 0.6 |

**Formula:**

```
numericScore = Σ (factor_value × factor_weight × 100)
             = (pQ × 15) + (lC × 20) + (mP × 10) + (dR × 10)
             + (pF × 15) + (vPQ × 20) + (r × 5) + (wIQ × 5)
```

---

## Factor reference values

### `provenanceQuality`
| Condition | Value |
|-----------|-------|
| Repository + author both present in manifest | 1.0 |
| One of repository or author present | 0.6 |
| Neither present | 0.2 |

### `licenseClarity`
| Condition | Value |
|-----------|-------|
| `license_check` artifact present and passed | 1.0 |
| `license_check` artifact present but failed | 0.0 |
| No license check run | 0.3 |

### `maintenancePosture`
| Condition | Value |
|-----------|-------|
| Version pinned in manifest | 0.7 |
| No version in manifest | 0.3 |

### `dependencyRisk` (inverted — lower deps = higher score)
| Dependency count | Value |
|-----------------|-------|
| 0 dependencies | 1.0 |
| 1 – 5 | 0.8 |
| 6 – 20 | 0.6 |
| 21+ | 0.4 |

### `privilegeFootprint` (inverted — lower privilege = higher score)
| Policy class | Value |
|-------------|-------|
| `read_only` | 1.0 |
| `network_limited` | 0.8 |
| `sandbox_exec` | 0.6 |
| `browser_operator` | 0.5 |
| `secret_bound` | 0.4 |
| `human_approval_required` | 0.3 |

### `wrapperIsolationQuality`
| Wrapper strategy | Value |
|-----------------|-------|
| `cli_container` | 0.9 |
| `skill` | 0.9 |
| `workflow` | 0.8 |
| `http` | 0.7 |
| `mcp` | 0.7 |
| `browser` | 0.6 |

---

## Validation stages

The pipeline runs these stages in order. Each stage can produce an artifact that caps the trust band.

| Stage | What it checks | Cap on fail |
|-------|---------------|------------|
| `license_check` | License detected and OSS-compatible | L2 ceiling |
| `dependency_inventory` | Dependencies catalogued, no known vulnerabilities | L3 ceiling |
| `secret_scan` | No credentials or secrets in source | L2 ceiling |
| `sandbox_smoke` | Asset executes without crashing in sandbox | L3 ceiling |
| `interface_conformance` | Input/output schema matches declared manifest | L3 ceiling |
| `reproducibility` | Same input produces same output twice | L4 ceiling |

---

## AgentiQ native assets

AgentiQ native assets (badged `AgentiQ native` in the Registry browser) are first-party platform assets seeded directly into `registry_assets` without passing through the external ingestion pipeline.

Their trust scores are seeded by the platform team (`computed_by: agentiq-system`) rather than derived from external validation artifacts. The factor profiles reflect:

- **provenanceQuality**: High (0.8–0.9) — known AgentiQ origin
- **licenseClarity**: Moderate (0.5–0.75) — no OSS license artifact (proprietary)
- **dependencyRisk**: High (0.9–1.0) — zero or minimal external dependencies
- **validationPassQuality**: Moderate (0.4–0.7) — reflects curation level

Native assets are identifiable by `metadata.agentiq_native = true` in the asset record.

**Alpha native asset trust bands:**

| Asset | Band | Score | Notes |
|-------|------|-------|-------|
| Video Generation — Venice | L4 Production Approved | 82 | Best isolation + reproducibility |
| Video Generation — Sora (Curated) | L4 Production Approved | 79 | First-party curation |
| Image Generation — OpenAI | L3 Production Candidate | 72 | Strong provenance, http wrapper |
| Article / Story Generation | L3 Production Candidate | 70 | LLM endpoint, no external deps |
| Image Generation — Venice | L3 Production Candidate | 69 | Third-party provider reduces confidence |
| Image + Article Bundle | L3 Production Candidate | 68 | Inline workflow, good isolation |
| Video + Article Bundle | L3 Production Candidate | 66 | Inline workflow |
| Video Generation — Sora (Community) | L2 Verified Community | 52 | Community tier, intentional ceiling |

---

## Running validation as an operator

1. Open `/registry` → click any asset → **Trust** tab
2. The Trust tab shows current band, numeric score, factor breakdown, and explanation
3. To re-run: click **Validation** tab → **Run Validation**
4. The pipeline recomputes all 8 factors based on current source artifacts
5. If validation passes new stages, trust band may increase
6. If a stage fails, the artifact cap is applied and band is constrained

**API:**
```
POST /api/registry/assets/{assetId}/validate
Body: { "triggeredBy": "operator-persona-id" }

Response: { ok, data: { validationId, overallResult, trustBandCap, score } }
```

---

## Codebase references

| Concern | Location |
|---------|----------|
| Trust scorer logic | `services/registry/trustScorerService.ts` |
| Factor computation | `trustScorerService.ts` → `computeFactors()` |
| Band assignment | `types/registryIngestion.ts` → `trustBandFromScore()` |
| Trust score persistence | `services/registry/persistence.ts` → `createTrustScore()` |
| Trust API | `app/api/registry/assets/[assetId]/trust/route.ts` |
| Validation pipeline | `services/registry/validatorService.ts` |
| Trust UI component | `components/registry/TrustPanel.tsx` |
| Registry supply browser | `app/triad/components/codex/tabs/RegistrySupplyTab.tsx` |
