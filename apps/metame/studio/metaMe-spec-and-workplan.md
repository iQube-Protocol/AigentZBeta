# metaMe Runtime + Studio Consolidated Spec and Workplan (MVP + Design Demo)

Status: Draft
Owner: AgentiQ / metaMe
Scope: AigentZBeta (primary) + iQube-Protocol/* (support libs)

## 0) Intent
Consolidate the MVP spec and design-led demo spec into one actionable spec and workplan for metaMe Runtime (mobile-first) and metaMe Studio (desktop-first). This is not a new app build; it is a reuse-first consolidation inside existing AigentZBeta / iQube-Protocol modules.

## 1) Non-negotiables
- Reuse-first: extend existing modules; do not introduce new frameworks or parallel systems.
- Minimal, surgical changes.
- Runtime UI is mobile-first; Studio UI is desktop-first.
- Runtime is the "Experience Compass" (not a browser UI): thumb-friendly, bottom nav, card streams, single-handed flows.
- Security: Vault is closed. Cartridges never directly access vault. All context access is via QubeTalk approval.
- Receipts must be produced for issuance and execution, and for micro-experience sharing/opening events.

## 2) Product goal
Deliver a mobile-first metaMe Runtime and a desktop-first metaMe Studio where users "come to do things" using:
- open canvas Liquid UI
- contextual compass menu (3 primary actions max)
- 20 canonical templates (initial 8 implemented; rest stubbed with registry)
- smart modules (offers, consent, pay, identity, vault, share)
- micro-experience packs (shareable, invite-driven)

## 3) Primary user story
"What do you want to do?" User picks one of 3 actions. System renders the best template + modules. User can invite someone into the same experience instance.

## 4) Runtime UX (mobile-first Experience Compass)
Primary navigation is:
- Spaces (cartridges/realms)
- Streams (activity + content + actions)
- Surfaces (Liquid UI panels: intent, capsule approval, results, message, transact, receipts)

Constraints:
- Never show more than 3 primary actions (optionally 2 secondary: Be/Share).
- Open canvas always dominates; menu is transient.
- Avoid heavy nav bars, multi-column desktop layouts, or tab metaphors.

Compass verbs (runtime):
- Be (vault + persona)
- Pay / Earn
- Play
- Make (light create: share/edit/curate)
- Share

## 5) Studio UX (desktop-first)
Compass verbs (studio):
- Be (vault + persona)
- Pay / Earn (billing, settlement, monetization config)
- Play (preview/test)
- Compose (center gravity)
- Share (publish/distribute via QubeTalk + invites)

## 6) Templates vs Smart Modules
- Templates are screen containers (layout + navigation + constraints).
- Smart modules are interactive objects with behavior (Offer, Consent, Pay, Identity, Vault item, Receipt, etc.).

Smart Offer is a module. The canonical Offer template is Template #11 (Offer / Product Detail). Smart Offer placements also appear in:
- #1 Feed
- #2 Catalog Grid
- #3 Search Results
- #6 Article Reader
- #7 Media Viewer
- #18 Chat / Thread
- #19 Room / Session
- #20 Checkout / Settlement

Smart Ads are a governed variant of Smart Offer with disclosure/labeling and targeting constraints.

## 7) System components
Runtime:
- Compass UI (verbs + featured noun)
- Liquid Canvas Renderer (template host)
- Template Registry Client
- Smart Module Renderer
- Menu Policy Engine (deterministic ranking)
- Experience Session Manager (instance state, participants, invites)
- Audit/Receipt Logger (events, consent receipts, settlement receipts)

Studio:
- Pack Composer UI
- Pack Manifest Generator
- Preview Runner (simulates runtime host + policies)
- Publisher (writes pack version to registry)

Orchestration:
- Aigent Z executes tool calls, policy checks, and state logging
- Wallet/Identity Bridge handles signing and x402/settlement intents

## 8) Core flows
A) Render
1) User selects verb (Pay/Earn, Play, Make/Compose)
2) Menu Policy Engine selects template ID, module set, featured noun
3) Canvas renders template + modules

B) Smart Offer
Offer -> terms -> scope select -> iQube create/share -> sign -> settle -> receipt

C) Invite/Join
Invite token links new user to same experience_instance_id

D) Studio Publish
Compose pack -> generate manifest -> preview -> publish to registry

## 9) Deterministic Menu Policy Engine
Inputs: directive, user_state, capabilities, device_state
Outputs: primary_actions (<=3), secondary (<=2), featured_noun, template_candidate_ids, module_candidates
Rules:
- LLM can suggest candidates but cannot violate caps or allowlists
- Labels are contextual (Pay/Buy/Earn) based on persona state, recent actions, and directive

## 10) Data model alignment (MVP)
- pack, pack_version
- experience_instance (pack_version + state)
- invite (token, expiry, instance_id, permissions)
- offer, offer_instance
- consent_receipt, settlement_receipt
- iqube_ref
- event_log (trace_id, span_id, actor, hashes)

## 11) Pack manifest (Studio -> Runtime)
Studio emits a JSON manifest consumed by Runtime. The schema should remain compatible with existing registry and pack patterns in AigentZBeta. The manifest must define:
- pack identity + version
- templates (primary + fallbacks)
- modules (type, placement, rules, config)
- tools (allowlist, idempotency)
- ui resources + render targets
- policies (consent, settlement caps)
- events emitted

## 12) Security posture
- No secrets inside embedded UI surfaces
- Tool allowlist enforced per pack + host
- Every settlement requires consent receipt reference
- Idempotency on settlement + offer acceptance

## 13) Acceptance criteria
- User completes Smart Offer (consent -> iQube -> settlement -> receipt) on mobile
- User creates invite; second user joins same instance and sees consistent state
- Studio composes + publishes the pack without code changes
- Every step produces auditable event log + receipt IDs

## 14) Design-led demo script (integrated)
Scene 0: Home
- Prompt: "What do you want to do?"
- Verbs: Pay/Earn, Play, Make
- Featured noun: Smart Offer

Scene 1: Smart Offer appears
- Template #1 Feed with SmartOffer card
- Tap -> Template #11 Offer Detail

Scene 2: Consent
- Actions: Accept, Review scopes, Back
- Consent intent emitted with terms hash

Scene 3: Scope picker -> iQube creation
- SmartIdentity + SmartVaultItem appear as featured nouns
- Semi-anon privacy mode
- iQube reference created

Scene 4: Settlement
- Wallet bridge authorizes
- x402 intent executes
- SmartReceipt renders: "40 CYN Earned" + "Offer Accepted"

Scene 5: Viral loop
- Share -> Invite to this experience
- Second user joins same instance

Scene 6: Design parity report
- Template IDs + modules + constraint checks
- Visual verification snapshot
- Event log + receipt IDs

Scene 7 (optional): Studio compose
- Compose -> select Template #11 + modules
- Publish pack version
- Preview runs same flow

## 15) Reuse-first checklist (must pass)
- Is there an existing component/module that does 80% of this? Extend it.
- Is there an existing API route/table that matches? Add fields; do not create a new table/service.
- Is there an existing UI pattern for approvals/permissions? Use it.
- Can we implement as a cartridge/template rather than new product logic?
- If building new: justify why reuse is impossible.

## 16) Consolidated workplan (parallel with Cascade)
Phase 0: Repo audit (Cascade)
- Locate existing templates, registry, vault/wallet, persona, receipts/logging, and compass/menu patterns
- Document reuse targets and gaps

Phase 1: Spec and schema placement (Codex)
- Add this consolidated spec in repo (this file)
- Add any minimal supporting schema stubs if missing (reuse-first)

Phase 2: IA tweak (Codex)
- Minimal nav change: "Dashboard" -> "Runtime"; "Studio" nested under Runtime

Phase 3: Compass Menu Policy Engine (Codex)
- Deterministic ranking: 3 primary actions max, optional Be/Share
- Contextual label switching (Pay/Buy/Earn) via policy rules

Phase 4: Smart Offer Pack integration (Codex)
- Offer -> consent -> iQube -> settlement -> receipt
- Invite/join into same experience instance
- DVN receipts + audit events emitted

Phase 5: Studio pack composer (Codex)
- Compose UI selects template + modules
- Generate pack manifest compatible with existing registry patterns
- Preview runner uses same runtime flow

Phase 6: Verification (Codex)
- Add tests or lightweight verification script per existing repo pattern
- Produce reuse audit summary

## 17) Coordination rules
- Wait for Cascade to assign tasks with explicit file paths.
- Implement small, coherent increments only.
- Do not redesign architecture.

## 18) Persistent QubeTalk memory for runtime/studio coordination
- Use channel `metame-runtime-thinclient` as the canonical coordination channel.
- Use thread keys `spec`, `api-wiring`, `ui-shell`, `dev-exec`, `ops` via `metadata.thread`.
- If WS fails, use the REST fallback command instead of blocking:
  - `bash scripts/qubetalk-post-runtime-memory.sh --thread <thread> --title "<title>" --content "<message>"`
- Permanent runbook source:
  - `docs/qubetalk/METAME_RUNTIME_CHANNEL_MEMORY.md`
