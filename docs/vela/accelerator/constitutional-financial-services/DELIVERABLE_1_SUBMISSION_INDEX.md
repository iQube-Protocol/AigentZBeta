# Deliverable 1 — Submission Index

**Date:** 15 September 2026
**Purpose:** the single external-facing entry point for Deliverable 1 — every artifact a reviewer
(accelerator judges, Horizen/Vela Engineering, or anyone else evaluating this milestone) needs is
linked from this one page, in the order a reviewer would actually want to consume them. This index
does not restate the underlying artifacts' content — it points at the real ones and says, in one
line each, what to look for.

**Status of the underlying work:** local Docker Vela proven → public Vela v0.2.0 devnet proven →
execution/error semantics hardened → architecture doc + managed-deployment handoff bundle complete.
**Not yet true, and not claimed anywhere below:** Nitro hardware attestation, a managed
Horizen/Vela Engineering deployment, live underwriting, live settlement, durable on-chain state.

---

## 1. Video walkthrough

⧗ **Pending — operator to add.** Replace this line with the video's public link (and, if useful, a
timestamp table) once recorded. Nothing in this repository can produce or host that file.

## 2. One-pager

⧗ **Pending — operator to add.** No Vela-specific one-pager exists in this repository today (checked
— only an unrelated AgentiQ Alpha launch one-pager exists, `codexes/packs/agentiq/items/LAUNCH_ONE_PAGER.md`,
which is a different program and should not be reused or linked here). Replace this line with the
one-pager's link once drafted, or ask for a draft explicitly if you want one pulled from the
architecture doc's own content.

## 3. Architecture artifact

**[`VELA_IMPLEMENTATION_ARCHITECTURE_v1.0.md`](VELA_IMPLEMENTATION_ARCHITECTURE_v1.0.md)** (internal
revision 1.1) — the full technical architecture: system roles, the Environment-Trust-Evidence vs.
Application-Execution-Evidence distinction, the three-tier disclosure model, guest-side
`COMPUTE_WITH`/`DISCLOSE_TO` enforcement, the public devnet milestone (§3.4), the Implementation
Status table (§3.5: Local Docker / Public Devnet / Managed Nitro-Testnet), and the Execution Failure
Non-Equivalence hardening (§9.4). Five Mermaid diagrams, all validated.

## 4. Milestone evidence — public Vela v0.2.0 devnet

**[`2026-09-14_vela-public-devnet-v0.2.0-milestone.md`](../../../../codexes/packs/agentiq/updates/2026-09-14_vela-public-devnet-v0.2.0-milestone.md)**
— the actual, current MoneyPenny multi-party guest deployed to and executed on a real remote Vela
v0.2.0 instance (`https://devnet.synsema.app/`), not the local stack: real Authority Service upload,
real `submitDeployRequest`/`ASSOCIATEKEY`/multi-party requests, three cases proven (unauthorized
computation fails closed; authorized joint computation with restricted disclosure; scope replay
rejected — Case B's two verdicts were chosen to provably differ, so the disclosure proof is decisive,
not coincidental). Explicitly labeled `EMULATED TEE`, never Nitro-attested.

## 5. Repository reference

- **Repository:** [`iQube-Protocol/AigentZBeta`](https://github.com/iQube-Protocol/AigentZBeta) (public)
- **Canonical commit for this milestone:** [`6665d3044`](https://github.com/iQube-Protocol/AigentZBeta/commit/6665d304432dfb0d494be1901b2841a475c6247b)
  — "Update Vela architecture doc for devnet milestone; fix Execution Failure Non-Equivalence; prep
  managed handoff bundle." Parent milestone commit:
  [`0451dced1`](https://github.com/iQube-Protocol/AigentZBeta/commit/0451dced1) — "Prove MoneyPenny
  multi-party Vela guest against public v0.2.0 devnet."
- **Guest source:** [`services/vela/wasm/projector/app/app.go`](https://github.com/iQube-Protocol/AigentZBeta/blob/6665d304432dfb0d494be1901b2841a475c6247b/services/vela/wasm/projector/app/app.go)
- **Reproducible devnet proof script:** [`scripts/vela/public-devnet-smoke.ts`](https://github.com/iQube-Protocol/AigentZBeta/blob/6665d304432dfb0d494be1901b2841a475c6247b/scripts/vela/public-devnet-smoke.ts)

## 6. WASM provenance

| Field | Value |
|---|---|
| Artifact | `moneypenny_projector.wasm` |
| Size | 519,641 bytes |
| SHA-256 | `085869849896aa423a5fa6c13cc5651a4446240b538e37c6a517dbd3cbdecf02` |
| Source commit | `de4222fe7` (guest logic unchanged since; independently re-verified before every build/deploy in this package) |
| Toolchain | TinyGo 0.39.0 (linux/amd64, go1.24.7, LLVM 19.1.2), `-target=wasi`, `-opt=s -no-debug` |
| Confirmed twice | Locally, at build time — and independently, by the public devnet's own Authority Service `POST /deploy/upload` response, which echoed back the identical `wasmSha256`/`artifactId` before any deploy transaction was submitted. |

The binary itself is a build artifact, `.gitignore`'d and never committed (Dense Materials rule) —
this SHA-256 is the durable, citable record. Full build narrative:
[`2026-09-14_vela-managed-deployment-bundle.md` §1](2026-09-14_vela-managed-deployment-bundle.md)
(same file as §7 below — that document is both the WASM build record and the managed-deployment
handoff).

## 7. Managed-deployment handoff (for Vela Engineering)

**[`2026-09-14_vela-managed-deployment-bundle.md`](../../../../codexes/packs/agentiq/updates/2026-09-14_vela-managed-deployment-bundle.md)**
— the exact package prepared for the Production Testnet Deployment Intake
(`https://tally.so/r/xXWL1v`): guest source/build/hash, application role, expected request types,
party/user registration assumptions, confidential state model, output/disclosure model, asset
model, the `applicationId ↔ WASM hash ↔ kernel version ↔ policy version` evidence goal, P-521/signer
assumptions, the no-upgrade constraint, the AWS KMS recovery caveat, and the five-question external
block for Vela Engineering (fuel-cost model, authoritative execution-status field, canonical
hash-binding evidence, Base Sepolia/Horizen trust-domain relationship, exact deployment bundle
requirements). **Not yet submitted** — this repository cannot confirm submission status; that is an
operator action against the Tally form above.

---

## What this package does and does not claim

**Proven, with evidence linked above:** the current MoneyPenny Constitutional Consequence &
Settlement Kernel runs, unmodified, through the real Vela v0.2.0 deploy → register → submit → poll →
decode lifecycle on two independent environments (local Docker, public devnet); multi-party
`COMPUTE_WITH`/`DISCLOSE_TO`/non-transitivity/fail-closed `UNRESOLVED` semantics hold on both; a
real, previously-unmitigated defect (an execution failure silently persisting as a constitutional
determination) was found and fixed as a direct consequence of the devnet run, with a candidate
invariant and regression tests to hold the fix in place.

**Not proven, and nothing above should be read as claiming otherwise:** Nitro hardware attestation
(both proven environments are `EMULATED`); a managed Horizen/Vela Engineering deployment; live
underwriting or settlement; durable on-chain state; the Use Case Zero seeded product demo (a
separate, Supabase-dependent workstream — see the demo-completion checklist doc — deliberately not
part of this package).

## Freeze note

Per the operator's own 2026-09-15 direction, this Vela implementation layer is frozen as of commit
`6665d3044` unless a Vela Engineering answer to §7's question block requires an adjustment. Changes
to this index itself (adding the video/one-pager links) do not reopen that freeze.
