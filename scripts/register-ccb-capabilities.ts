/**
 * register-ccb-capabilities.ts
 *
 * Constitutional Acceptance (CFS-032 §4) for the three capabilities this
 * workstream produced a Constitutional Capability Brief (CFS-049) for:
 * metaMe Companion, the Financial Services Capability Suite, and MoneyPenny's
 * Constitutional Runtime — plus a fourth, added 2026-07-24 per the mySoftware
 * "broaden to Capability Registry" decision (SPEC-MMC-002 §6.2 amendment):
 * the Constitutional Video/Audio pipeline, which shipped without ever going
 * through the narrow softwarePilot/artifact_records path (see that amendment
 * for why `artifact_records` alone can't surface real feature work like this)
 * and so had no way to appear in mySoftware until registered here. No CCB
 * exists yet for this fourth capability — `briefUrl` is honestly omitted
 * rather than pointing at a document that doesn't exist.
 *
 * Calls the existing `registerCapability()` service once per capability —
 * idempotent, safe to re-run — closing the "Registered" line on each CCB's
 * Completion Receipt (for the first three) and making the fourth visible in
 * mySoftware's registry-backed section for the first time.
 *
 * Usage:
 *   npx tsx scripts/register-ccb-capabilities.ts --personaId=<your-persona-uuid>
 *   npx tsx scripts/register-ccb-capabilities.ts --personaId=<...> --dry-run
 *
 * personaId is required — it's the operator persona the acceptance receipt
 * is attributed to (mirrors the admin API route's `g.persona.personaId`,
 * which this script bypasses since it runs outside a request). A receipt
 * failure (e.g. an unrecognised personaId) does not block registration
 * itself — `registerCapability`'s own contract.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { registerCapability, type RegisterCapabilityInput } from "../services/constitutional/capabilityRegistry";

const DRY_RUN = process.argv.includes("--dry-run");
const personaIdArg = process.argv.find((a) => a.startsWith("--personaId="));
const PERSONA_ID = personaIdArg?.split("=")[1];

if (!PERSONA_ID) {
  console.error("Missing --personaId=<uuid> — the operator persona to attribute the acceptance receipt to.");
  process.exit(1);
}

const CAPABILITIES: RegisterCapabilityInput[] = [
  {
    capabilityId: "metame-companion",
    displayLabel: "metaMe Companion",
    description:
      "Browser extension bringing the constitutional runtime into the legacy web -- Smart Wallet, Universal Search, contextual Overlay, and a Capture flow ('Pull Across to metaMe') that turns anything on the web into a real Intent or Venture without leaving the page.",
    governingInvariants: ["PRD-MMC-001", "PRD-MMC-IMPL-001", "PRD-MMC-IMPL-002", "PRD-MMC-IMPL-003", "SPEC-MMC-001"],
    briefUrl: "codexes/packs/agentiq/updates/2026-07-24_ccb-metame-companion.md",
    reuseDisposition: "compose",
  },
  {
    capabilityId: "financial-services-capability-suite",
    displayLabel: "Financial Services Capability Suite",
    description:
      "The platform's first Constitutional Capability Domain made real -- a live 12-step constitutional service pipeline (shadow/authoritative), gated by the Constitutional Agreement primitive, mounted in Venture Lab alpha as the Financial Services tab.",
    governingInvariants: ["CRP-003", "CRP-003a"],
    briefUrl: "codexes/packs/agentiq/updates/2026-07-24_ccb-financial-services-capability-suite.md",
    reuseDisposition: "compose",
  },
  {
    // Deliberately reuses the LIVE capabilityRef the Constitutional Agreement
    // gate already uses for MoneyPenny's Financial Intelligence domain
    // (app/api/moneypenny/runtime/route.ts) -- avoids minting a second,
    // disconnected identifier for something the Agreement layer already
    // names. The sibling money-moving ref (cap-moneypenny-financial-services
    // -settlement) is noted in the description rather than registered as a
    // second row.
    capabilityId: "cap-moneypenny-financial-services",
    displayLabel: "MoneyPenny Constitutional Runtime",
    description:
      "MoneyPenny's Constitutional Financial Services Agent Runtime mode -- a domain-scoped driving agent over the built service pipeline. Financial Intelligence runs authoritative on this ref; Investment/Market run authoritative on a second, independent ref (cap-moneypenny-financial-services-settlement) gated additionally by a World-ID-verified Polity Passport.",
    governingInvariants: ["PRD-MPY-001", "CRP-003a", "CFS-043"],
    briefUrl: "codexes/packs/agentiq/updates/2026-07-24_ccb-moneypenny-runtime.md",
    reuseDisposition: "compose",
  },
  {
    capabilityId: "constitutional-video-audio-pipeline",
    displayLabel: "Constitutional Video & Audio Pipeline",
    description:
      "Invariant-grounded short-form video generation: a 4-segment video brief generator + orchestrator grounded in CFS-011 Style Invariants and CFS-012 Narrative Invariants, an audio pipeline (TTS extraction, mux route, audio-preserving stitch), and a Coherent Bundle Generation skill with opt-in judgement and an integrated-artefacts bundle preset. Shipped as direct feature development (not via the softwarePilot/produce-software path), so it never appears in artifact_records -- registered here so it's visible in mySoftware at all.",
    governingInvariants: ["CFS-011", "CFS-012", "CVR-002", "CVR-003"],
    reuseDisposition: "compose",
  },
  {
    // Added 2026-07-27 — the CCR-001 reference artifact. It had a Brief from
    // the day it was written and no registry row, so the newest capability
    // artefact was the only one with nothing to hang off in mySoftware.
    capabilityId: "companion-menu-system",
    displayLabel: "Companion Menu System",
    description:
      "The copilot's navigation, mode and overlay system -- nine invariants (MS-1..MS-9), each learned from a live regression and each enforced by a canary. The first capability documented in the CCR-001 completion format.",
    governingInvariants: ["MS-1", "MS-2", "MS-3", "MS-4", "MS-5", "MS-6", "MS-7", "MS-8", "MS-9"],
    briefUrl: "codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md",
    reuseDisposition: "compose",
  },
];

async function main() {
  for (const cap of CAPABILITIES) {
    if (DRY_RUN) {
      console.log(`[dry-run] would register: ${cap.capabilityId} (${cap.displayLabel})`);
      continue;
    }
    const result = await registerCapability(PERSONA_ID!, cap);
    if (!result.ok) {
      console.error(`FAILED  ${cap.capabilityId}: ${result.reason}`);
      continue;
    }
    console.log(
      result.alreadyRegistered
        ? `ALREADY REGISTERED  ${cap.capabilityId} (ref=${result.capability.object.identity.ref})`
        : `REGISTERED  ${cap.capabilityId} (ref=${result.capability.object.identity.ref}, receipt=${result.receiptId ?? "none"})`,
    );
  }
}

main().catch((error) => {
  console.error("register-ccb-capabilities failed:", error);
  process.exit(1);
});
