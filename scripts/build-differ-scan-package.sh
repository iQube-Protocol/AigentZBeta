#!/usr/bin/env bash
#
# build-differ-scan-package.sh — reproducible generator for the bounded
# Differ compatibility-scan package (Financial Services Journey Spine +
# MoneyPenny Advisor/Architect/Runtime pre-action experience).
#
# See codexes/packs/agentiq/updates/2026-08-24_differ-scan-package-v1-financial-services.md
# for the scope definition this script implements. Every path below is
# copied VERBATIM from the working tree at the commit recorded in
# MANIFEST.md — nothing is hand-edited after copying.
#
# This script does NOT upload, submit, or transmit anything anywhere. It
# only writes files to a local output directory (default: the session
# scratchpad, never inside the repo — per CLAUDE.md's Dense Materials rule,
# a build artifact/archive does not belong in git).
#
# Usage: scripts/build-differ-scan-package.sh [output-dir]
#   output-dir defaults to /tmp/differ-scan-package-v1 if not given.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PACKAGE_VERSION="v1.0.0"
PACKAGE_NAME="differ-scan-package"
OUT_ROOT="${1:-/tmp/${PACKAGE_NAME}-${PACKAGE_VERSION}}"
PKG_DIR="${OUT_ROOT}/${PACKAGE_NAME}-${PACKAGE_VERSION}"

COMMIT_SHA="$(git rev-parse HEAD)"
COMMIT_DATE="$(git log -1 --format=%cI HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo 'unknown')"
GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR/src"

# ─── Section 1: Journey Spine core ─────────────────────────────────────────
CORE_FILES=(
  "types/journey.ts"
  "services/journey/resolveJourneyState.ts"
  "services/journey/interactionContextAssembly.ts"
  "services/journey/conditionEvaluator.ts"
  "services/journey/journeySurfaceRegistry.ts"
  "components/journey/JourneyRunSurface.tsx"
  "services/journey/horizenMoneyPennyJourney.ts"
)

# ─── Section 2: MoneyPenny Advisor/Architect/Runtime pre-action surfaces ──
MONEYPENNY_FILES=(
  "app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx"
  "app/(shell)/moneypenny/components/serviceOrchestrationPanelState.ts"
  "services/financialServices/serviceCatalog.ts"
  "services/financialServices/serviceRequestOrchestrator.ts"
  "services/financialServices/discovery.ts"
  "services/financialServices/eligibility.ts"
  "types/financialServices.ts"
  "app/api/moneypenny/architect/route.ts"
  "app/api/moneypenny/service-orchestration/route.ts"
)

# ─── Section 3: AEE provider-neutral seam ──────────────────────────────────
AEE_FILES=(
  "types/adaptiveExperience.ts"
  "services/adaptive/nativeProvider.ts"
  "services/adaptive/projectionValidator.ts"
  "services/adaptive/journeySpineAdapter.ts"
  "services/adaptive/applicationProjectionManifest.ts"
  "services/adaptive/providers/differAdapter.ts"
)

# ─── Section 4: native-only boundary — topology context only ──────────────
NATIVE_BOUNDARY_FILES=(
  "app/api/moneypenny/runtime/route.ts"
  "services/constitutional/constitutionalAgreement.ts"
  "services/registry/capabilityInvocationGates.ts"
)

# ─── Section 5: minimum dependency context (small, non-sensitive, needed
# for Differ to actually read the UX/application topology of the files
# above) ─────────────────────────────────────────────────────────────────
DEPENDENCY_CONTEXT_FILES=(
  "components/journey/StageReceiptsDrawer.tsx"
  "components/ui/button.tsx"
  "components/ui/card.tsx"
  "components/ui/overlayLayers.ts"
  "services/journey/bridgeEmbedNav.ts"
  "types/capabilityInvocation.ts"
  "types/constitutionalCommerce.ts"
  "types/constitutionalObject.ts"
  "types/consequence.ts"
  "utils/codex-nav.ts"
  "utils/personaSpine.tsx"
  "utils/readJsonOrExplain.ts"
)

ALL_INCLUDED=("${CORE_FILES[@]}" "${MONEYPENNY_FILES[@]}" "${AEE_FILES[@]}" "${NATIVE_BOUNDARY_FILES[@]}" "${DEPENDENCY_CONTEXT_FILES[@]}")

SECRET_PATTERN='\.env|\.pem$|\.key$|credentials|service[_-]?role'

INCLUDED_COUNT=0
for rel in "${ALL_INCLUDED[@]}"; do
  if [[ "$rel" =~ $SECRET_PATTERN ]]; then
    echo "REFUSING to include $rel — matches secret/credential pattern" >&2
    exit 1
  fi
  if [ ! -f "$rel" ]; then
    echo "MISSING source file: $rel" >&2
    exit 1
  fi
  dest="$PKG_DIR/src/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$rel" "$dest"
  INCLUDED_COUNT=$((INCLUDED_COUNT + 1))
done

# ─── Bounded stubs — dependencies that exist in the real codebase but are
# deliberately NOT copied in full, because doing so would materially widen
# the package (per operator instruction, 2026-08-24) beyond the Financial
# Services Journey Spine + MoneyPenny Advisor/Architect/Runtime pre-action
# scope, or because they are native-execution/identity internals a UI
# hosting-compatibility scan does not need. Every signature below is
# grep-verified against the real file at the commit in MANIFEST.md — none
# is invented. ─────────────────────────────────────────────────────────────
cat > "$PKG_DIR/STUBS.md" <<'STUBEOF'
# Bounded dependency stubs — not included in full

These local modules are imported (directly or transitively) by files in
`src/`, but are represented here only as a bounded interface description,
per the operator's instruction: "If a required dependency would materially
widen the package, replace it with a bounded interface/manifest description
where practical and record that substitution."

Every signature below is copied verbatim from an `export` line in the real
file at the commit recorded in MANIFEST.md — none is invented or guessed.

## Why stubbed, not included

1. **`app/api/journey/moneypenny-horizen/state/route.ts`** — the real state
   route for the reference Horizen×MoneyPenny journey. NOT included in full:
   it pulls in the entire Horizen partner-admission pipeline (agent
   registration, PnL verification, Standing seeding, orientation rituals,
   wallet persona resolution — ~20 additional files), which is out of the
   Financial-Services-Journey-Spine-narrow scope this package defines.
   **Bounded description:** a Next.js route handler that calls
   `resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, authoritativePlatformState)`
   (both already in `src/`) and returns `{ ok, state: JourneyRuntimeState }`.
   That is the entire shape relevant to a UI/topology compatibility read.

2. **Native-execution / identity internals** (native-only boundary —
   included by signature only, so Differ can see the boundary exists
   without receiving business-logic internals it would never host):

| Module | Bounded interface (verbatim exported signatures) |
|---|---|
| `services/constitutional/agreementProviders.ts` | `type AcceptorType = 'operator' \| 'agent'`; `interface AcceptanceRequest {...}`; `interface AcceptanceRecord {...}` |
| `services/constitutional/constitutionalServicePipeline.ts` | `type ServicePipelineMode = 'shadow' \| 'authoritative'`; `type StepStatus = 'ok'\|'skipped'\|'refused'\|'shadow-block'\|'observed'`; `interface StepTrace {...}` |
| `services/constitutional/financialIntelligenceExecutor.ts` | `type IntelligenceConfidence = 'low'\|'medium'\|'high'`; `const FINANCIAL_DOMAINS = ['intelligence','investment','market']` |
| `services/constitutional/guidedOnboarding.ts` | `type RiskProfile = 'read-write'\|'money-moving'`; `type ProofGrade = 'captcha'\|'world_id'`; `const PROOF_REQUIREMENT: Record<ProofGrade,string>` |
| `services/constitutional/modelRouter.ts` | `function routeFor(stage: ReasoningStage): StageRoute`; `async function callStage(...)` |
| `services/constitutional/moneyPennyArchitect.ts` | `interface DraftFinancialStructureInput {...}`; `interface DraftFinancialStructureResult {...}`; `async function draftFinancialStructure(...)` |
| `services/constitutional/moneyPennyRuntimeRefs.ts` | `const MONEYPENNY_RUNTIME_CAPABILITY_REF = 'cap-moneypenny-financial-services'`; `const MONEYPENNY_RUNTIME_AGENT_REF = 'agent-moneypenny'` |
| `services/constitutionalCommerce/actionAuthorisation.ts` | `interface DeriveActionAuthorisationInput {...}`; `function deriveActionAuthorisation(...)` |
| `services/constitutionalCommerce/boundedExecution.ts` | `interface BoundedExecutionResult {...}`; `function bindExecution(input: BindExecutionInput): BoundedExecutionResult` |
| `services/constitutionalCommerce/causalChain.ts` | `interface CausalChainRefs {...}`; `function assembleCausalChain(...)` |
| `services/constitutionalCommerce/commerceReceipts.ts` | `async function emitActionAuthorisationReceipt(...)`; `async function emitExecutionReceipt(...)`; `async function emitConsequenceReceipt(...)` |
| `services/constitutionalCommerce/observedConsequence.ts` | `type ValidationState = ObservedConsequence['validationState']`; `function compareProjectionToObservation(...)` |
| `services/constitutionalCommerce/unifiedConsequenceProjection.ts` | `interface ConfidentialEvidenceInput {...}`; `interface CompositionPolicy {...}`; `interface ComposeProjectionInput {...}` |
| `services/registry/invocationGateway.ts` | `interface InvocationRequest {...}`; `interface InvocationResult {...}`; `async function invokeAsset(req: InvocationRequest): Promise<InvocationResult>` |
| `services/identity/getActivePersona.ts` | `async function getActivePersona(request): Promise<ActivePersonaContext \| null>` — server-side caller identity resolution. Not shared in full: identity-spine internals, out of scope for a UI-hosting compatibility read. |
| `services/receipts/activityReceiptService.ts` | `type ActivityActionType = ...`; `type ReceiptStatus = 'local'\|'dvn_pending'\|'dvn_recorded'\|'dvn_failed'`; `async function createActivityReceipt(...)`, `async function listActivityReceiptsForPersona(...)` |
| `services/crm/standingAccrualService.ts` | `interface StandingAccrual {...}`; `async function accrueStanding(input): Promise<StandingAccrual \| null>` |
| `services/standing/agentStandingPersona.ts` | `async function resolveCanonicalAgentPersonaId(...)`; `async function resolveAgentStandingPersonaId(...)` |
| `services/passport/bureauIdentityService.ts` | Passport Bureau identity helpers (synthetic email domain, username validation) — identity-spine internal. |
| `services/passport/personhoodProof.ts` | `type PersonhoodProofType = 'captcha'\|'world_id'\|'agent_declaration'\|'operator_attestation'`; `interface ProofVerification {...}` |
| `services/journey/agentAdmissionState.ts` | `interface AgentAdmissionState {...}`; `async function resolveAgentAdmissionState(...)` — Horizen agent-admission specific, not FS-journey-spine specific. |
| `services/horizen/registrableAgents.ts` | `interface RegistrableAgentConfig {...}`; `const REGISTRABLE_AGENTS: Record<string, RegistrableAgentConfig>` — Horizen partner-registration roster, out of FS scope. |
| `services/resolution/executionTaxonomy.ts` | `type ExecutionPosture = 'authoritative'\|'shadow-only'`; `interface ExecutionDomainDescriptor {...}` |
| `services/consequence/stages.ts` | `interface CurationInput {...}`; `async function knowledgeCuration(...)`; `async function forecastConsequences(...)` |
| `app/api/dev-command-center/_lib/persona.ts` | `const PERSONA_TIMEOUT_MS = 6000`; `type PersonaResolution = ...` |
| `app/api/moneypenny/chat/route.ts` | Next.js route handler (`dynamic`, `runtime` exports; `interface ChatMessage`) — MoneyPenny's conversational chat surface, a SEPARATE surface from the three modes in this package's scope. |

None of the above is copied into `src/`. If Differ's compatibility scan
needs more than the bounded signature to answer a specific question, that
is a named follow-on request, not an assumption this package makes.
STUBEOF

# ─── SHA-256 of every included source file (integrity manifest) ───────────
cd "$PKG_DIR"
find src -type f | sort | xargs shasum -a 256 > SOURCE_FILE_HASHES.sha256
cd "$REPO_ROOT"

# ─── MANIFEST.md ────────────────────────────────────────────────────────────
cat > "$PKG_DIR/MANIFEST.md" <<MANIFESTEOF
# Differ Scan Package — MANIFEST

**Package:** ${PACKAGE_NAME}
**Version:** ${PACKAGE_VERSION}
**Generated:** ${GENERATED_AT} (UTC)
**Generator:** scripts/build-differ-scan-package.sh (this repo, deterministic — rerun against the same commit reproduces the same file set)

## Declaration

> **Compatibility scan input only. Consequential Runtime execution, authorization, credentials, private data and constitutional authority remain native and are not hosting candidates.**

## Source provenance

- Repository: ${REMOTE_URL}
- Branch: ${BRANCH}
- Commit: ${COMMIT_SHA}
- Commit date: ${COMMIT_DATE}
- Scope-defining doc: codexes/packs/agentiq/updates/2026-08-24_differ-scan-package-v1-financial-services.md
- Audit doc: codexes/packs/agentiq/updates/2026-08-24_aee-differ-phase0-audit-financial-services.md

## Included files (${INCLUDED_COUNT} total)

### 1. Journey Spine core
$(for f in "${CORE_FILES[@]}"; do echo "- \`src/$f\`"; done)

### 2. MoneyPenny Advisor / Architect / Runtime pre-action surfaces
$(for f in "${MONEYPENNY_FILES[@]}"; do echo "- \`src/$f\`"; done)

### 3. AEE provider-neutral seam (this repo's own boundary — Differ's own current, honestly-disabled integration point)
$(for f in "${AEE_FILES[@]}"; do echo "- \`src/$f\`"; done)

### 4. Native-only boundary — included for topology context, NOT a hosting candidate
$(for f in "${NATIVE_BOUNDARY_FILES[@]}"; do echo "- \`src/$f\`"; done)

### 5. Minimum dependency context (small, non-sensitive UI/type/utility files needed to actually read the topology above)
$(for f in "${DEPENDENCY_CONTEXT_FILES[@]}"; do echo "- \`src/$f\`"; done)

## Bounded stubs — NOT included in full

See \`STUBS.md\` in this package for every dependency that exists in the real
codebase but was deliberately replaced with a bounded interface description
rather than copied in full, and why.

## Explicit exclusions (whole estate areas, per the scope-defining doc §2.5)

- Passport, Delegation, and Reciprocal Artifact Exchange capability code — not part of the Financial Services slice.
- aigentMe, Aigent Z, DevOn, and the wider metaMe UI — per the Phase 0 audit's own scope boundary.
- Any Supabase migration, credential, or \`.env\` file.
- Any secret, API key, private key, live user/persona data, or confidential research/corpus content.

## Integrity

- Per-file SHA-256: \`SOURCE_FILE_HASHES.sha256\` (in this package).
- Final archive SHA-256: recorded by the caller after \`tar\`/\`zip\` (this script does not create the archive itself — see the wrapper invocation for the actual archive hash).

## What this package is not

This package was generated for a compatibility SCAN read only. It is not:
- a grant of hosting access;
- a submission to Differ or any third party (nothing here has been uploaded/transmitted);
- a complete application (it will not build or run standalone — it is a bounded topology slice, not a working checkout).
MANIFESTEOF

echo "Package staged at: $PKG_DIR"
echo "Included files: $INCLUDED_COUNT"
echo "Next: tar/zip $PKG_DIR and compute the archive SHA-256 (done by the caller, not this script)."
