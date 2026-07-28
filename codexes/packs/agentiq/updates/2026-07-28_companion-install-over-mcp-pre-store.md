# Companion install over MCP, before the Chrome Web Store

**Date:** 2026-07-28 · **Branch:** `claude/constitutional-ground-review-7yg8nb`
**Implements:** SPEC-MMC-003 §3.2 (installation orchestration) over PRD-THR-001's Threshold Gateway.
**Audience for the first use:** the Horizen Labs partner pilot.

---

## What the operator asked

> "Can we integrate the Companion installation into the MCP service so that third-party users' Claudes can download and install the edge Companion for them as part of the Threshold crossing now? How can we enable them to do this before the browser plugin is registered with the Chrome Web Store?"

## The honest answer to "can Claude install it"

**No, and no design can make it yes.** SPEC-MMC-003 §2.1 already recorded this as ground truth and it has not changed: no web page, no script, and no MCP tool call can add an extension to a browser. `chrome.management.install` is not a bypass — it is gated to Web-Store-hosted extensions the *calling extension* already manages, with the browser's own confirmation UI in between, and nothing in this repo uses it. Off-store `.crx` drag-install has been refused by Chromium since Chrome 75 (enterprise policy only).

So the achievable thing — and what shipped — is: **the agent hands over a verifiable artifact and the exact steps; the human performs the one unavoidable gesture.** The tool says this in its own description and again in its payload, because an agent that implies otherwise will strand its principal mid-flow.

What that leaves genuinely automated: discovery, artifact delivery, integrity values, the step script, the pairing pointer, and post-hoc confirmation. Everything except the click.

## Why SPEC-MMC-003 §5 said this was unbuildable, and what changed

§5 (2026-07-24) named three hypothetical tools and then said plainly that none could be built, because they "depend on a **metaMe Agent Bridge** MCP gateway … not yet committed to this repo in any form."

**That precondition is now satisfied.** `app/api/threshold/mcp/route.ts` + `services/threshold/gateway.ts` shipped as the Threshold Gateway (PRD-THR-001 §8) — a real MCP surface a third-party Claude already speaks to, with a real human-authorized session (the Constitutional Handshake). §5's blocker was the gateway, not the idea. The second precondition it named — the `/api/companion/pair/*` code routes — is **not** needed for install: pairing already works through the shipped `connectToMetaMe()` same-context path.

`get_companion_install` is therefore §5's `companion.checkInstallStatus` / `companion.verifyPostInstall` pair, collapsed into the one tool the flow actually needs, hosted on the gateway that now exists.

## Structurally, where install sits in the crossing

**After it, not inside it.** Grounded in PRD-MMC-001 §0.5: agentic hosts reach the runtime via MCP/Threshold; the regular web reaches it via the Companion. They are two surfaces of one principal. A partner engineer whose Claude has crossed has the *agent* surface; the Companion is how they get the *browser* surface. So `get_companion_install` is a post-crossing tool alongside `get_crossing_status`, not a new pre-crossing step — and it does not touch the crossing state machine at all.

## Delivery before a store listing

| Option | Verdict |
|---|---|
| Committed zip in the repo, served from a route | **Rejected.** A second copy of the extension that drifts from `extension/companion-observer/` — exactly the `inv.engineering.036`/`037` defect. |
| GitHub release asset | **Rejected.** `iQube-Protocol/AigentZBeta` is private; Horizen cannot fetch it. Needs an operator step per release. |
| Supabase Storage signed URL | **Rejected for now.** Needs an out-of-band upload per version, and re-introduces the drift problem. |
| `git clone` + load-unpacked | **Rejected.** Requires repo access the partner does not have. |
| **Built from source at request time** | **Chosen.** The bytes served *are* the checked-in source, so drift is impossible by construction. |

`GET /api/companion/extension?format=zip` reads `extension/companion-observer/` and emits a stored (uncompressed) zip. No zip dependency was added — the repo has none, and pulling one in for ~95 KB of plain JS is the wrong trade against the Amplify output cap. `writeStoreZip` is ~60 lines of a fully-specified format, and the canary verifies it by **extracting it with a real extractor and re-hashing every member**, rather than trusting the writer.

## Integrity — what a partner can actually check

Three independent values, all derived, none asserted:

1. **Per-file sha256 + bundle sha256** — `GET /api/companion/extension`. Verified with `shasum -a 256 companion-observer/*`.
2. **The bundle digest travels with the bytes** — `X-Companion-Bundle-Sha256` on the download response, so a download is checkable without a second request.
3. **The extension ID** — the strongest check, because it is what the *browser itself* reports. `manifest.json` pins a `key`, so the ID is stable across load-unpacked and any future store listing. `deriveExtensionId` recomputes it the way Chromium does (sha256 of the DER SPKI → first 16 bytes → hex digits mapped `0-f` → `a-p`), and the canary asserts it equals the `chrome-extension://` origin already in `configs/embed/policy.v1.json`'s frame-ancestors allowlist.

That last one answers the load-unpacked risk directly: **the ID is *not* unstable here.** Unpinned extensions get a fresh ID per load, which would silently break the CSP allowlist the Companion's own side panel depends on. This one is pinned, and the canary keeps it pinned to the value the platform trusts.

## Where the gate is, and why it is not on the bytes

`get_companion_install` is a **handshake tool** — it requires the Constitutional Handshake bearer, so an agent only learns the artifact exists after its principal crossed the Threshold in a browser. That is the gate that carries meaning.

The download route itself is **ungated**, deliberately:

- A browser extension is a public artifact by construction — the moment a store listing exists these exact bytes are world-downloadable, and the allowlisted extension ID is already public in `configs/embed/policy.v1.json`.
- The bundle carries **no credential**, and a canary fails the build if a secret-shaped literal ever appears in it.
- Per PRD-MMC-001 §4.1 the install "grants nothing beyond identity-only" — the Companion holds no session until the human pairs it with their *own* signed-in session.
- The human clicks the URL in a browser that carries no MCP bearer, so a gate would need a capability-token mint that does not exist. Building one to protect non-secret bytes would be theatre.

**`participationAccess` was considered and cannot be used here.** A Threshold session deliberately carries only T2 references (`principalPublicRef`), never a `personaId` — that is the point of the tier boundary. Calling the participation spine from the gateway would require materialising a T0 identifier on a surface built to never hold one. No bespoke check was added in its place; if the artifact ever needs partner-scoping, that is a capability-token design, not an `if`.

## What shipped

| File | Change |
|---|---|
| `services/companion/extensionArtifact.ts` | New. Bundle reader, per-file/bundle digests, `deriveExtensionId`, deterministic store-zip writer, and the install brief. |
| `app/api/companion/extension/route.ts` | New. `GET` → integrity manifest + brief; `?format=zip` → the bundle. |
| `services/threshold/gateway.ts` | `get_companion_install` added to `listTools`, `HANDSHAKE_TOOLS`, `AUTHENTICATED_TOOLS`, and dispatch. Artifact injected via `GatewayContext` so the gateway stays I/O-light. |
| `app/api/threshold/mcp/route.ts` | Injects `companionInstall`. |
| `next.config.js` | Traces `extension/companion-observer/*` onto the download route. |
| `tests/companion-extension-artifact.test.ts` | New — 17 assertions, 16/16 mutations caught. |
| `tests/source-of-truth-parity.test.ts` | Indexes the extension-ID ↔ CSP-allowlist parity canary. |

Full suite after: **173 files / 2566 tests, all passing.**

## Deferred until Chrome Web Store registration

1. **`storeListingUrl` stays `null`.** No store URL is invented anywhere (repo No-Guessing rule); the canary fails the build if one appears.
2. **Auto-update.** Unpacked extensions do not update. Every new version is a re-download and re-load until a listing exists.
3. **The developer-mode restart prompt.** Chrome nags on each browser start for unpacked extensions. Expected; it goes away with a listing.
4. **Managed-Chrome installs.** Enterprise policy can disable "Load unpacked" outright. There is no workaround from this side — the brief tells the principal to escalate rather than pretending otherwise.
5. **SPEC-MMC-003 §3.1 browser detection + §3.2 steps 1/4/5** — presence probe, `externally_connectable`, the post-install first-run tab. All still unbuilt; the brief substitutes an explicit human check of the extension ID.
6. **§3.3's pairing-code routes** (`/api/companion/pair/code`, `/api/companion/pair/redeem`) — still unbuilt, still not needed: the shipped `connectToMetaMe()` path covers the flow.
7. **Firefox / Safari.** MV3 is not their model; no build exists or is claimed.

## Operator decisions needed

1. **Ratify the ungated download route** (reasoning above). If the answer is no, the alternative is a capability-token mint — a larger piece of work, not a config change.
2. **`extension/companion-observer/constants.js` pins `https://dev-beta.aigentz.me`.** Everything a Horizen engineer installs points at dev. If the pilot should run anywhere else, that origin must be supplied — it will not be guessed.
3. **SPEC-MMC-003 §5 should be amended** to record that its gateway precondition is now met and that `get_companion_install` supersedes its three hypothetical tool names.
