# AgentiQ Alpha — Golden Path Demo

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06  
**Gate:** 8 — Flywheel coherence  
**Version:** alpha-1.0

---

## Purpose

This document is the narrated demonstration script for the complete AgentiQ alpha flywheel. It can be used as a live walkthrough for stakeholders, a self-guided orientation for new team members, or a reference for acceptance testing Gate 8.

**The loop in one sentence:**

> A contributor packages a skill in AgentiQ OS → it enters the governed Registry through the Ingestion Factory → an operator composes it into an experience in Studio → the experience is delivered in the metaMe Runtime → a user enters KNYT, signals participation, earns $KNYT, and advances their PCS stage → that signal informs what gets built next.

**Time to walk:** approximately 12 minutes end-to-end.

---

## Prerequisites

- Access to `dev-beta.aigentz.me`
- Open the Multi-Codex Viewer: `/codex/viewer`
- Open the iQube Registry: `/registry`
- Open the Composer Studio: `/studio` (operator-level access)

---

## Step 1 — Build: Package a contribution in AgentiQ OS

**Where:** AgentiQ codex → **AgentiQ OS** tab  
**Aigent:** Aigent C

A developer discovers AgentiQ OS through the public contribution layer. They read:

- What AgentiQ OS is and why it exists (`docs/agentiq-os/README.md`)
- The four contribution types: **ToolQube, SkillQube, WorkflowQube, ConnectorQube**
- The packaging standard: manifest schema, policy classes, wrapper strategy
- How to submit via the SDK or the factory API

They package their skill — in this demo, an image generation capability targeting the `openai` provider — using the AgentiQ SDK:

```typescript
import { AgentIQClient } from "@agentiq/sdk";

const client = new AgentIQClient({ persona: "aigent-c" });
await client.factory.submitIntake({
  sourceType: "manual_bundle",
  name: "Image Generation — OpenAI",
  description: "Generate portrait and landscape hero imagery via OpenAI DALL·E / gpt-image-1.",
  assetClass: "SkillQube",
  policyClass: "network_limited",
  wrapperStrategy: "http",
  capabilities: [{ name: "image_generation", scope: "editorial", provider: "openai" }],
  tags: ["image", "openai", "editorial"],
});
```

**What you see in the codex:** The AgentiQ OS tab surfaces the quickstart guide, packaging standards, and contribution category matrix — exactly the orientation a first contributor needs.

---

## Step 2 — Govern: Submission enters the Registry Ingestion Factory

**Where:** AgentiQ codex → **Factory** tab  
**API:** `POST /api/registry/intake` → `GET /api/registry/intake?tenantId=platform`  
**Aigent:** Aigent Z (governance)

The submission immediately appears in the Factory pipeline. The intake row shows:

| Field | Value |
|-------|-------|
| Stage | `intake.created` |
| Status | `received` |
| Source type | `manual_bundle` |
| Asset class | `SkillQube` |

The Factory pipeline then runs automatically:

```
intake.created
  → source.fetched      (manifest captured, content hash computed)
  → asset.classified    (ToolQube / SkillQube / WorkflowQube / ConnectorQube assigned)
  → asset.packaged      (wrapper strategy applied, interface schema generated)
  → validation.started  (license check, dependency inventory, secret scan, sandbox smoke)
  → trust.assigned      (8-factor trust composite scored, TrustBand ceiling applied)
  → review.pending      (human or Aigent Z review triggered if required)
  → asset.published     (status = published, TrustBand confirmed)
```

**What you see in the codex:** Status filter chips (All / received / validating / review pending / published / failed / rejected) update in real time as the intake progresses. Clicking a row shows the current stage, failure reason if any, and the linked asset ID once packaging completes.

**In the iQube Registry:** Switch to the **Ingestion Factory** panel → **Pipeline Status** tab. The same intake appears with stage history, trust band cap, and validation summary.

---

## Step 3 — Register: Accepted supply enters the Registry

**Where:** AgentiQ codex → **Registry** tab  
**API:** `GET /api/registry/assets?publicationStatus=published&tenantId=platform`  
**Aigent:** Aigent Z (orchestration)

Once the pipeline completes and the asset is published, it appears in the Registry Supply browser.

**Live example — the 8 AgentiQ native assets seeded at alpha launch:**

| Asset | Class | Trust Band | Score |
|-------|-------|-----------|-------|
| Image Generation — OpenAI | SkillQube | L3 Production Candidate | 72 |
| Image Generation — Venice | SkillQube | L3 Production Candidate | 69 |
| Video Generation — Sora (Curated) | SkillQube | L4 Production Approved | 79 |
| Video Generation — Venice | SkillQube | L4 Production Approved | 82 |
| Video Generation — Sora (Community) | SkillQube | L2 Verified Community | 52 |
| Article / Story Generation | SkillQube | L3 Production Candidate | 70 |
| Image + Article Bundle | WorkflowQube | L3 Production Candidate | 68 |
| Video + Article Bundle | WorkflowQube | L3 Production Candidate | 66 |

**What you see in the codex:** Each row expands inline to show trust band, policy class, version, tags, and factor breakdown from the trust scorer. The `AgentiQ native` badge marks first-party assets.

**What you see in the Registry:** The full `AssetDetailPanel` opens with tabs for Overview, Validation, Trust (factor breakdown + explanation), Receipts (audit trail), Reviews, and Test Invoke.

---

## Step 4 — Compose: An operator selects assets in Studio

**Where:** Composer Studio → **Workflows** tab  
**URL:** `/studio`  
**Aigent:** Aigent Z (supply routing)

An operator opens the Composer Studio. In the **Workflows** tab, they see:

- All 6 Studio Skills with their trust bands and `AgentiQ native` badges
- Both Studio Bundles (Image + Article, Video + Article)
- A **filter toggle**: `All` or `Active Experience` — showing only the skills used by the currently previewed experience

They select the **Image + Article Bundle** as their experience workflow, which pre-wires:

1. Image Generation (skill selection: OpenAI or Venice)
2. Article / Story Generation
3. Deployment

The operator configures the experience: sets the image model, article tone, and target audience. They save — triggering a `StudioArtifact` receipt emission:

```
artifact.type = "experience_bundle"
artifact.status = "draft"
artifact.bundle_preset = "image_article_bundle"
artifact.studio_skill_id = "skill:image_openai"
```

**What you see:** The Workflows tab shows skills filtered to only those used by the active experience (when toggled to "Active Experience" mode). Skills without registry coverage are absent. The trust band of each selected skill is visible before composition.

---

## Step 5 — Deliver: The experience runs in the metaMe Runtime

**Where:** SmartTriad / metaMe Runtime  
**Aigent:** metaMe (sovereignty), Aigent Z (routing)

The composed experience is delivered through the metaMe Runtime:

- `SmartTriad` renders the ownership layer (creator attribution, DVN receipt, Q¢ economics)
- `CodexPanelDynamic` renders the codex panel dynamically based on the cartridge and user stage
- The Runtime fetches `GET /api/runtime/experience/{id}` and hydrates the content projection

The experience appears in the user's thin-client as an article with AI-generated hero imagery. The experience's `StudioArtifact` status advances from `draft` → `canonical` on first delivery.

**Q¢ visible in SmartWalletDrawer:** The access transaction settles in Q¢ — the base platform rail visible in the Q¢ section of the wallet drawer.

---

## Step 6 — Participate: User enters KNYT

**Where:** KNYT codex → **Runtime** tab  
**Aigent:** Kn0w1 (in-world guide)

The user enters the KNYT world. Kn0w1 greets them as an **Outside Order** patronage entrant on the KNYT Patronage Axis, and a **Participant** on the PCS Axis.

The KNYT Runtime Surface shows:

```
Patronage Axis:   Outside Order → Acolyte → Keta → Keji → First → Zero → Satoshi
PCS Axis:         Participant → Community → Correspondent → Operator → Creator → Contributor

Current position: [Outside Order / Participant]
Next best step:   Like or spark a piece of content to generate your first signal
```

**Economic framing (EconomicSplitBanner at the top of every KNYT and AgentiQ codex tab):**

| Q¢ — Platform Rail | $KNYT — Cartridge Economy |
|--------------------|--------------------------|
| Base currency for content, access, and platform rewards across all cartridges | KNYT-native token earned by curating, remixing, and participating in the living canon |

---

## Step 7 — Signal: Like, spark, vote, remix

**Where:** KNYT codex → **Runtime** tab (Signal Action Tray)  
**APIs:** `/api/codex/knyt/living-canon/like`, `.../spark`, `.../curate`, `.../vote`, `.../remix`

The user engages with the content they just experienced:

### Action 1 — Like
```
POST /api/codex/knyt/living-canon/like
{ contentId, personaId, patronageStage: "outside_order", pcsStage: "participant" }

→ Signal stored in knyt_signals (type: like)
→ 1.0 $KNYT micro-reward emitted to wallet
```

### Action 2 — Spark
```
POST /api/codex/knyt/living-canon/spark
{ contentId, personaId, note: "This visual approach is strong for editorial" }

→ Signal stored in knyt_signals (type: spark)
→ 2.5 $KNYT micro-reward emitted
→ Spark note appended to living canon curation layer
```

### Action 3 — Vote (after 3+ participation signals)
```
POST /api/codex/knyt/living-canon/vote
{ contentId, voteType: "acclaim", personaId }

→ KNYT acclaim vote registered
→ 5.0 $KNYT reward emitted (acclaim threshold)
→ vote.weight applied to living canon ranking
```

**$KNYT balance visible in SmartWalletDrawer:** The amber `$KNYT` section (distinct from the indigo Q¢ section) now shows the accumulated reward from these three signals.

---

## Step 8 — Progress: PCS stage advances

**Where:** metaMe codex → **Journey Dashboard** tab  
**Aigent:** metaMe

With 3+ signals recorded, the user's `journey_state` is updated. The PCS ladder section in the Experience Dashboard shows:

```
Current stage:    Participant  ●━━━━━━━━━━━━━━
Completed:        ✓ first_participation_signal

Next stage:       Community
Unlock criteria:  repeat_participation + 3 signals across sessions
Progress:         1 / 3 sessions with signals

Next-best-step:   Return to KNYT and generate at least 2 more signal actions
                  across separate sessions.
```

The NBE plan disposition for this user is `act`, routing them back toward KNYT participation with Kn0w1 guidance.

---

## Step 9 — Remix: Contribution feeds back into supply

**Where:** KNYT codex → Runtime → Remix action  
**API:** `POST /api/codex/knyt/living-canon/remix`

A more advanced user (Curator or Remixer on PCS Axis) submits a remix contribution:

```
POST /api/codex/knyt/living-canon/remix
{
  contentId: "...",
  remixType: "editorial_extension",
  payload: { additionalSections: [...], perspective: "..." },
  personaId: "...",
  pcsStage: "correspondent"
}
```

The remix is stored with a **lineage link** back to the original content. The remixer's `contributor_pathway_flag` is set when they reach the Operator stage. Aigent C receives the handoff and begins the builder onboarding flow:

```
Aigent C: "Your remix signals strong editorial instincts.
           Would you like to package this as a formal SkillQube submission
           to the AgentiQ OS Registry?"
```

This routes the user back to **Step 1** — packaging a contribution.

---

## Step 10 — Close the loop: Signal informs future supply

The full loop is now demonstrably closed:

```
AgentiQ OS (build)
  ↓ SDK submission
Registry Ingestion Factory (govern)
  ↓ validation → trust scoring → publication
Registry Supply (organize)
  ↓ operator selection
Composer Studio (compose)
  ↓ bundle preset → StudioArtifact
metaMe Runtime (deliver)
  ↓ experience consumption → Q¢ transaction
KNYT (participate)
  ↓ like / spark / vote / remix → $KNYT reward
PCS Progression (advance)
  ↓ stage ladder → next-best-step
Aigent C handoff (build again)
  ↓ contributor_pathway_flag → new SkillQube submission
Registry Ingestion Factory (back to step 2)
```

Every step is:
- **Traceable** — receipt emitted at each stage boundary (intake, validation, trust, publication, invocation, signal)
- **Governed** — Aigent Z routes, metaMe vetoes, Kn0w1 guides, Aigent C onboards
- **Economically coherent** — Q¢ for platform access, $KNYT for KNYT participation
- **Sovereignty-preserving** — metaMe holds the user's goals, ladder, and next-best-step

---

## Acceptance checklist (Gate 8)

- [ ] A stakeholder can open the AgentiQ codex and understand the contributor path in under 2 minutes
- [ ] A submitted asset appears in the Factory tab within seconds and moves through the pipeline
- [ ] The Registry Supply tab shows all published assets with trust bands and factor breakdowns
- [ ] The Composer Studio Workflows tab shows skills with AgentiQ native badges and trust bands
- [ ] A user can like, spark, and vote in KNYT and see $KNYT reward in their wallet
- [ ] The PCS ladder shows the current stage and next-unlock criteria
- [ ] A Curator-stage user sees the Aigent C handoff CTA
- [ ] Both economic rails (Q¢ and $KNYT) are visually distinct and clearly explained
- [ ] The EconomicSplitBanner is present in both KNYT and AgentiQ codex tabs
- [ ] The entire loop — contribution → signal → supply feedback — is narratable in one sitting

---

## Live surface map

| Step | Surface | URL / location |
|------|---------|---------------|
| Build | AgentiQ OS tab | `/codex/viewer` → AgentiQ → AgentiQ OS |
| Govern | Factory tab | `/codex/viewer` → AgentiQ → Factory |
| Register | Registry tab | `/codex/viewer` → AgentiQ → Registry |
| Full factory ops | iQube Registry | `/registry` → Ingestion Factory |
| Compose | Composer Studio | `/studio` → Workflows tab |
| Deliver | metaMe Runtime | SmartTriad (any experience URL) |
| Participate | KNYT Runtime | `/codex/viewer` → KNYT → Runtime |
| Progress | Journey Dashboard | `/codex/viewer` → metaMe → Journey Dashboard |
| Economic rails | Wallet drawer | SmartWalletDrawer (Q¢ + $KNYT sections) |

---

## Related documents

- `docs/alpha/architecture-memo.md` — topology, flywheel, Aigent map, economic model
- `docs/alpha/build-plan.md` — gate-by-gate implementation plan
- `docs/agentiq-os/README.md` — contributor entry point
- `docs/agent-harness/metaproof-core.md` — NBE contract and routing hierarchy
- `codexes/packs/knyt/items/KNYT_RUNTIME_SURFACE_SPEC.md` — KNYT runtime spec
- `codexes/packs/metame/items/METAME_EXPERIENCE_FRAMEWORK.md` — PCS framework
