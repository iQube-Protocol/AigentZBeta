/**
 * register-ccb-capabilities.ts
 *
 * Constitutional Acceptance (CFS-032 §4) for the three capabilities this
 * workstream produced a Constitutional Capability Brief (CFS-049) for:
 * metaMe Companion, the Financial Services Capability Suite, and MoneyPenny's
 * Constitutional Runtime. Calls the existing `registerCapability()` service
 * three times — idempotent, safe to re-run — closing the "Registered" line
 * on each Brief's Completion Receipt.
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
