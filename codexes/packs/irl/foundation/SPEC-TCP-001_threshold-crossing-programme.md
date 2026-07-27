# SPEC-TCP-001 — Threshold Crossing Programme: Universal Constitutional Onboarding

**metaMe IRL / iQube Protocol / AgentiQ · Onboarding-programme specification · Status: DRAFT (AMENDED 2026-07-25 — five operator refinements, §22) — DOCS-ONLY, AWAITING RATIFICATION. No code may change under this SPEC until the decision register in §20 is resolved. Two of its central mechanisms (§14 specialist-journey activation, §13's Companion criteria) rest on platform state that does not exist today — §0.6 and §0.7 name both, and neither may be papered over in an implementation pass.**
**Title:** *The Threshold Crossing Programme — one constitutional onboarding, multiple entry points, one threshold, many specialist journeys*
**Companion to:** **SPEC-COS-001** (`SPEC-COS-001_constitutional-onboarding-specification.md`) — the ratified substrate this programme is layered on; **PRD-THR-001** (`PRD-THR-001_metame-threshold.md`) — the third-party-agent crossing and the Journey Registry; **SPEC-MMC-003** (`SPEC-MMC-003_mcp-assisted-companion-deployment.md`) — the seven-stage Companion deployment flow this SPEC's §15 defers to entirely; **SPEC-HMC-001** (`SPEC-HMC-001_constitutional-agent-continuity.md`) — Homecoming, the sibling strand §17 reframes; **CFS-051** (`CFS-051_experiment-constitutional-registry.md`) — the Experiment / Constitutional / Invariant Pipeline; **PRD-MMC-001** (`PRD-MMC-001_metame-companion.md`) — the Companion umbrella; **CFS-043 / CFS-043a** — Principal–Delegate Separation and the guided-onboarding script; **CFS-050** — Sovereignty Navigation.
**Extension of:** **SPEC-COS-001.** This SPEC **extends** that specification; it does **not** supersede it, and it does not restate its seven-layer substrate. SPEC-COS-001 answers *"where does an arrival stand, and which surfaces may be active?"* — and shipped a resolver that answers it (`services/onboarding/substrateState.ts`). This SPEC answers the question that resolver cannot: *"what does the arrival actually **do**, on which surface, in what order, and when are they done?"* §2 states the boundary precisely.
**Owner:** operator (programme intent, threshold definition) + AgentiQ Runtime stewards (Companion surface) + Identity & Access Spine stewards (Passport/delegation/persona resolution). **Origin:** operator specification, 2026-07-25, delivered as a full seventeen-section programme statement with two explicit in-line amendments (§7's one-sitting mode; §14's "Technical Founder Operator IS the develop path"). Reconciled by Claude Code against the shipped platform the same day.

> **Governance note (binding, this SPEC):** Docs-first, ratify-before-build — the same regime as SPEC-CDR-001, and deliberately the stricter of the two regimes this repo uses. **Unlike SPEC-COS-001, SPEC-HMC-001, and SPEC-MMC-003, no phase of this SPEC was implemented concurrently with its filing, and none may be.** A specification cannot ratify itself; nothing in this document authorises a code change. Ratification of this SPEC would authorise *design* to proceed on the phases in §21, each separately gated on the decisions in §20 — it would **not** by itself waive: (a) the Principal–Delegate Separation safeguard (CFS-043 §2) — nothing built under this SPEC may introduce an agent-authorize path, and §4/§13's "Delegation active" criterion must not become one; (b) the Identity & Access Spine's T0/T1/T2 exposure tiers — every surface built under this SPEC resolves identity through `getActivePersona` and serialises no T0 identifier; (c) PRD-THR-001 §13's phase gating, CFS-043 §7, PRD-MMC-001's Phase-2 Observer guardrails, or SPEC-MMC-003 §7's per-stage gating — each remains separately gated on its own terms; (d) the "Extend, Don't Duplicate" / CS-001 discipline (`inv.engineering.036`/`037`) — §0.4's finding is that this programme's vocabulary already exists in code **three times over**, and any build must derive from those sources rather than author a fourth. Every mechanism named below is either (a) an **already-shipped primitive** cited by file path, (b) a **specification already filed** and cited, or (c) **explicitly named as not existing**. Nothing is asserted to exist that was not read in source.

> **Companion documents (read alongside, in this order):** `SPEC-COS-001_constitutional-onboarding-specification.md` — **read it first and in full**; every layer noun here is its, cited not re-derived, and its §12.4 "honest gaps" section is the direct parent of this SPEC's §0.6/§0.7. `services/onboarding/substrateState.ts` + `app/api/onboarding/substrate-state/route.ts` + `tests/onboarding-substrate.test.ts` — SPEC-COS-001's shipped Phase 1. `PRD-THR-001_metame-threshold.md` §8 (MCP catalogue) and §9.1 (Journey Registry). `SPEC-MMC-003_mcp-assisted-companion-deployment.md` §2–§3 and §8 — the deployment mechanics §15 defers to. `services/constitutional/guidedOnboarding.ts` — the executable CFS-043a plan. `services/iqube/experienceQube.ts` + `services/iqube/actionModes.ts` + `types/experienceGuide.ts` — the three vocabularies §0.4 reconciles. `extension/companion-observer/*` and `app/(embed)/triad/embed/companion/page.tsx` — the Companion as it actually is today (§0.5). `app/api/skills/tts/route.ts` + `app/hooks/useTTSPlayer.ts` + `components/shared/ListenButton.tsx` — the voice substrate §9 composes.

---

## 0. Read this first — reconciliation against what's already built

This section is the reason the document is worth having. Each finding below was verified by reading source, not inferred. Where something does not exist, it says so plainly, because CLAUDE.md's "No Guessing or Hallucinating" rule is zero-tolerance and because a programme built on a fictional foundation fails silently.

### 0.1 SPEC-COS-001 already covers the substrate. This SPEC covers the *crossing* — they are different questions, and merging them would be the defect

SPEC-COS-001 (RATIFIED 2026-07-25) states the seven-layer substrate (Claude → MCP → Passport → Delegation → Agent Me → Experience Qubes → Journey recommendation), the direct-arrival reconciliation (§2.3), progressive surface activation as doctrine (§4), and the Studio-is-not-an-onboarding-surface boundary (§3). Its Phase 1 shipped a real resolver: `resolveSubstrateLayers` / `activeSurfaces` / `nextAction` / `recommendJourney`, a spine-gated read-only route, and a 49-assertion canary.

**What SPEC-COS-001 does NOT do, and this SPEC does:** it never states *when onboarding is finished*. It has no threshold. Its `nextAction` terminates at "choose a journey" and, because of §0.6 below, can never report completion at all. It describes the terrain; it does not describe the walk, the guide, the voice, the surface the walk happens on, or the moment the walk ends. **This SPEC adds the crossing: entry paths, two ordered stages, a completion definition, the guided-experience layer, and the specialist-journey handoff.**

**Supersession:** none. SPEC-COS-001 remains canonical for the substrate and for progressive surface activation. Where this document and that one describe the same thing, SPEC-COS-001 governs. Where this document adds something, §20 gates it.

### 0.2 The resolver shipped, but **nothing consumes it** — the observer story in §11 is entirely unbuilt

`GET /api/onboarding/substrate-state` exists and is spine-gated. A repo-wide search for its path and for `substrateState` outside its own module, its route, and its canary returns **only doc comments in three unrelated files** (`app/api/participation/my-access/route.ts`, `services/passport/participationSelfView.ts`, `services/research/registryAccess.ts`). **No React component, hook, copilot, or agent surface calls it.** The same is true of `POST /api/constitutional/guided-onboarding`: `services/constitutional/guidedOnboarding.ts` builds a complete `OnboardingPlan` with ordered `OnboardingStep[]`, and **no component consumes it** — its only importers are `constitutionalAgreement.ts`, `substrateState.ts`, `RuntimePanel.tsx` (for the `PROOF_REQUIREMENT` constant alone), and `tests/guided-onboarding.test.ts`.

So the honest position for §11 is: **the onboarding state exists as a server read; the "every copilot can guide the user to the next stage" behaviour does not exist in any form.** §11 is new work, not a wiring exercise.

### 0.3 CORRECTION (operator, 2026-07-25) — a guided-tour mechanism DOES exist, in the metaMe Runtime Shell thin client. It is the reference implementation and MUST be audited before any new framework is chosen

**Withdrawn claim.** The original §0.3 asserted that *"there is no guided-tour, walkthrough, spotlight, or coach-mark mechanism anywhere in this repository"* and concluded from that absence that *"§8, §9 and §10 are entirely new build."* The **search itself stands** — nothing tour-shaped exists in `iQube-Protocol/AigentZBeta`, and the two nearest things here are still not tours (the table below is retained unchanged). **The conclusion was wrong.** A shipped, production guided tour runs today in the **metaMe Runtime Shell thin client** (Lovable/Vite project, `src/components/tour/`) — the surface serving the "Welcome to your metaMe Runtime" dialog with *Explore on my own* / *Start guide*.

**The defect class, named so it is not repeated:** a repo-scoped search was used to license a platform-scoped claim. *"Not in this tree"* is a finding; *"does not exist"* is a conclusion that a single-tree search cannot support. The platform spans at least the main tree, the thin client, and the extension. Every existence claim in this corpus must state which trees were searched — and an absence claim that spans them must actually span them.

**Binding rule that follows (proposed, D-22): reuse before replacement.** The existing metaMe Runtime Shell tour SHALL be treated as the **reference implementation** for the guide mechanism. Claude Code SHALL audit it (§0.3a) before selecting or introducing any new tour framework, and any proposal to replace rather than adopt it must state which specific requirement the existing implementation cannot meet.

**The implementation, as read from source supplied by the operator (2026-07-25):**

| File | Role | Size |
|---|---|---|
| `src/components/tour/WelcomeModal.tsx` | First-run welcome dialog — *Start guide* / *Explore on my own* | 64 lines |
| `src/components/tour/VisitorTour.tsx` | The 12-step tour: step definitions, shell-staging effects, controlled advancement | 453 lines |
| `src/components/tour/TourHelpButton.tsx` | The `?` restart affordance, with a one-per-page-load attention pulse | 47 lines |
| `src/hooks/use-tour-state.ts` | Visibility / run / completion state | 96 lines |
| `src/pages/Index.tsx` | Mount point — `WelcomeModal` + `VisitorTour key={runKey}`, and the `metame:tour:restart` window-event listener | 107 lines |

Tour anchors and quick-action attributes are wired in `src/components/SmartMenuSubmenu.tsx` and `src/components/SmartMenuPromptBar.tsx`.

**Note on the sibling repo:** `iQube-Protocol/metamert` — the closest match reachable from a session scoped to this org — is an **earlier sibling** of that project (same Vite/Lovable `src/` layout, same `RuntimeFrame`/`RuntimeHeader`/`SmartMenu` family) from before the SmartMenu split and before the tour landed. It contains no `src/components/tour/`, no `use-tour-state.ts`, and no `react-joyride` dependency. It is **not** the source of the shipped tour, and must not be cited as such.

---

### 0.3a Audit of the reference implementation (nine questions, answered from source)

| # | Question | Finding |
|---|---|---|
| 1 | **Where does it live?** | `src/components/tour/` in the metaMe Runtime Shell thin client — a **separate repository** from the main tree. Any shared framework must therefore be extracted or re-expressed, not imported across the boundary as-is. |
| 2 | **Which library?** | **`react-joyride`**, on its newer API surface — named `Joyride` export, `options` and `onEvent` props, `ACTIONS`/`EVENTS`/`STATUS` constants, `EventData`/`Step` types. Not the classic default-export + `callback` form. |
| 3 | **How are steps represented?** | A **static `Step[]` array of 12 entries** in `useMemo(… , [])`. Each carries `target`, `placement`, `title`, `content` (a plain string), and a custom `data: { action: TourAction }` discriminant naming the side effect to run. Hardcoded, not data-driven, not derived from any registry or journey state. |
| 4 | **How is targeting done?** | CSS attribute selectors over **`data-tour="…"` DOM attributes** — `runtime-area`, `smart-menu`, `smart-menu-prompt`, `quick-action-{knyt,cartridge,signin,wallet,settings}`, `trust-dots`, `help-button`. A stable, framework-neutral anchor contract. |
| 5 | **How is state represented?** | **App-owned, not Joyride-owned** — `use-tour-state.ts` holds `hasSeen / showWelcome / running / runKey` and persists **two localStorage flags**: `metame.tour.visitor.completed` and `metame.tour.visitor.skipped`. `runKey` increments to force a clean Joyride remount on restart. **Device-local; not persona-bound; not server-persisted; emits no event and no receipt.** |
| 6 | **How is completion represented?** | Binary and **conflated**: `hasSeen = completed \|\| skipped`. Finishing and declining are recorded in different keys but are **equivalent downstream**. There is no progress, no resume point, no step-level completion — `restart()` always returns to step 0. |
| 7 | **Does it navigate across tabs/surfaces?** | **Yes, and this is the strongest reusable idea in it.** `runStepEffect` drives the shell for each step — `activateMode('be'\|'play'\|'earn')`, `setSubmenuType('quickActions')`, and `sendIframeAction('wallet'\|'persona'\|'settings', {…})`, a **postMessage across the iframe boundary** into a runtime it does not own. It also calls `pauseIdleTimer()` on an 800 ms interval so the shell's idle collapse cannot yank an anchor mid-step. The tour is an **actor that opens the surface each card describes**, not a passive overlay. |
| 8 | **Can TTS/STT compose onto it?** | **Partly — a real asset and a real gap.** Asset: `title` and `content` are **plain strings**, not JSX, so every step is directly narratable with no extraction step. Gap: there is **no step-lifecycle seam** — advancement is driven internally by Joyride's `STEP_AFTER` + `ACTIONS.NEXT`, and nothing exposes "step entered / step ready / step complete" to a caller. Voice-primary narration needs the ability to *await* narration before advancing; that hook does not exist and would have to be added. |
| 9 | **How coupled is it to Vite / React-Router / its DOM?** | **Routing coupling: none.** The tour never navigates a route — the shell is single-page (`Index.tsx`) and everything happens through context + postMessage. Real couplings are (a) the `useShell()` action vocabulary, (b) the `data-tour` anchor contract, (c) plain `document.querySelector` + `offsetParent` polling, (d) `window.setInterval` and `localStorage` — all client-only, all portable to a Next.js client component behind `'use client'` (and `readFlag` already guards `localStorage` in try/catch). **It is portable in principle.** The dependency that does not travel is the ShellContext action vocabulary, which is thin-client-specific. |

**Engineering quality — the part worth preserving verbatim.** `VisitorTour` runs Joyride in **controlled** mode (`stepIndex` + `goToStep`) rather than letting the library advance itself, and every transition (a) runs the step's staging effect, (b) **polls for the anchor with `waitForElement` (2 s / 50 ms, requiring `offsetParent !== null`)**, (c) scrolls it into view, (d) waits a **settle delay — 420 ms for drawer-opening steps, 220 ms otherwise** — before handing control back. If an anchor never materialises it **skips that single step** instead of cascading forward. It also mirrors `activeMode`/`viewState` into refs to defeat stale closures, and guards `ensureMode` against re-activating the current mode (which would hit the tap-active-to-collapse branch and fold the menu away).

Those are precisely the failure modes that make naïve tour integrations flicker, mis-position, or silently skip steps. **They are solved here, and any replacement that does not solve them is a regression regardless of which library it uses.**

**One incidental finding:** `VisitorTour.tsx` imports `DEEP_LINK_DISPATCH` from `@/lib/smart-menu-config` and never uses it — a dead import, cosmetic, noted for the thin-client backlog rather than this SPEC.

---

### 0.3b What this changes for §8–§10 — and the split it forces

**What is genuinely reusable:** the anchor contract (`data-tour`), the controlled-advancement + anchor-wait + settle discipline, the staging-effect model (each step opens the surface it describes), and the cross-boundary drive via postMessage. The plain-string `title`/`content` shape is directly narratable.

**What cannot serve the programme as-is, and why it is not a criticism of the implementation** — it was built to introduce a *visitor* to a runtime, which it does well. TCP asks for something categorically different:

| TCP requirement | Reference implementation | Gap |
|---|---|---|
| Steps derived from constitutional state, so completed rungs are skipped | Static 12-step array, every visitor sees all 12 | **Structural** — needs a definition format + a resolver input |
| Resumable progress ("you are on step 7") | Binary `hasSeen`; restart always goes to step 0 | **Structural** |
| Progress observable by the platform / attributable to a persona | Two localStorage flags, device-local, no event | **Structural** |
| "Completed" distinguishable from "declined" | `hasSeen = completed \|\| skipped` — conflated | **Semantic** — TCP must keep these distinct (§1.1) |
| Voice-primary narration that gates advancement | No step-lifecycle seam | **Additive** — a seam, not a rewrite |
| Captions | None | **New build**, as §0.4 already states |
| One runtime + N declarative definitions | One bespoke component, one hardcoded script | **Structural** |

**The gaps are not evenly distributed, and that is the finding.** Everything in the *experiential* column — highlight, narrate, stage the surface, advance safely — is solved. Everything in the *objective* column — durable, attributable, resumable, state-derived progress — is absent, because a localStorage flag is the correct engineering choice for a visitor tour and the wrong one for a constitutional record.

That asymmetry is exactly the operator's Constitutional Activation / Guided Configuration split (§1.1). The reference implementation is a strong candidate for the **Guided Configuration** layer and no candidate at all for the **Constitutional Activation** layer — and reading it makes clear those were never one thing.

---

### 0.3c The original repo-scoped search (retained — still accurate for the main tree)

Verified against the root `package.json` and all thirteen workspace manifests under `apps/*` and `packages/*`, and against `node_modules`: there is **no** `driver.js`, `shepherd.js`, `intro.js`, `react-joyride`, `reactour`, `@reactour/*`, `onborda`, `nextstepjs`, or any equivalent. In code there are no `data-tour`/`data-guide` attributes, no element-highlighting overlay, and no step-sequencer that drives a user across tabs. Every `currentStep`/`stepIndex` hit is multi-step **form** state inside a modal dialog. The only literal "tour" strings in the repo are two capsule titles (`"capsule: World intro tour"`, `"capsule: Discovery tour"`) — unrelated content labels.

**The two nearest existing things, neither of which is a tour and neither of which may be described as one:**

| Thing | What it actually is | Why it is not a tour |
|---|---|---|
| `AccessionProgressBar` (`app/triad/components/codex/AccessionProgressBar.tsx`) | A stepper strip (Welcome → Passport → Delegate → Access → Experiments), mounted once at the shell, self-scoped to the IRL cartridges, observing real state from existing endpoints | A progress indicator with clickable nodes. It never highlights a control, never narrates, never advances on its own. |
| `[[nav:Label]]` chips (`app/components/codex/CodexCopilotLayer.tsx`; prompt at `app/api/codex/chat/route.ts:2221`) | The model emits a marker; the label is validated **verbatim** against a quick-links catalogue; the UI strips the marker and renders a clickable chip | Navigates on click. No sequence, no highlight, no completion tracking. |

`utils/codex-nav.ts::buildCodexUrl` (with `tab`, `personaSessionToken`, `shell`, `from`/`fromTab`) is the navigation plumbing a guide **could** be built on. That is the extent of what exists.

### 0.3d P4a closure — the §9 seven-point contract confirmed against the native surface (2026-07-27, operator: "go")

The remaining P4a work was narrow: confirm the seven-point framework contract against the
native Edge Companion's own constraints. Confirmed point-by-point against the surface as
shipped this week (the Companion 1:1 shell — 8-item nav vocabulary, search, quick links,
capture, wallet, avatar/chat modes, Passport connect gate):

1. **Declarative definitions** — no native obstacle. Definitions are data modules consumed by
   one runtime component inside the Companion page (a Next.js client component, like
   everything else on that surface).
2. **Stable anchor contract** — `data-tour` attributes are stamped in-tree (the Companion page
   + `CodexCopilotLayer` are main-tree files), so the anchor contract is *stronger* here than
   in the cross-repo reference implementation.
3. **Controlled advancement with anchor verification** — reproducible natively (refs /
   `MutationObserver` + the reference's anchor-wait + settle discipline). One native caution:
   the avatar ↔ chat mode swap unmounts panels, so the runtime must re-verify anchors after
   mode changes — observable via the shipped `onCopilotModeChange` seam, so this is a
   discipline to apply, not a blocker.
4. **Staging effects** — *the one point that degrades at a boundary.* Companion-internal
   staging is DIRECT state control (`setActiveNavItem`, capsule/layout state) — stronger than
   the reference's iframe postMessage. But steps that stage the **application in the left
   browser** cross a *window* boundary (the cartridge-link rule: cartridge pages open in the
   browser, never in the Companion). `buildCodexUrl` gets the user there; the Companion cannot
   verify or hold that remote surface open. **Rule adopted: within the panel, staging is
   stage-and-verify; across the window boundary, steps are fire-and-describe** — the script
   narrates what the citizen will see rather than asserting a verified state. An honest guide
   degrades explicitly; it does not pretend to observe a window it cannot.
5. **Step-lifecycle seam** — net-new as specced; no native obstacle.
6. **Externalised copy** — narration units authored under `TTS_MAX_CHARS = 950`, played
   through `useTTSPlayer` with the surface's resolved voice persona (Agent Me in the
   Companion, per the shipped `resolveVoicePersona` seam), preserving the R/T busy-pulse
   contract.
7. **State the runtime does not own** — progress reported outward to a persona-bound spine
   route, consumed with `personaFetch` (mandatory — the Companion holds a Bearer once the
   connect gate has run). Durability decisions stay with the host per the contract.

**Panel constraint:** the ~23rem width bounds the spotlight/halo + caption card design;
captions (D-13) are sized for the panel from the start, not retrofitted.

**Disposition: P4a CLOSED. D-12 and D-22 RESOLVED** (see §20) — the reference implementation
is adopted as the read-only contract source; the runtime is built natively (D-23); no
replacement framework is needed, and none may be introduced without naming the requirement
this path cannot meet. **The operator's "go" (2026-07-27) charters P4b** — the guide runtime
build, captions included (D-13's recommended "build it" carried into scope). D-14 (per-guide
script approval against the capability set current on build date) remains a standing gate at
each guide's build time, starting with the Companion Guide (P5). Sequencing per the operator:
the build queues behind the three priority workstreams in flight (Chrysalis tracker row 100).

### 0.4 The voice substrate for §9 **already exists and must be composed, not rebuilt** — but the caption layer does not

| §9 requirement | Shipped primitive | Status |
|---|---|---|
| Text-to-speech narration | `POST /api/skills/tts` (`app/api/skills/tts/route.ts`) → `services/audio/ttsSynthesis.ts`. Body `{ text, voice? }`, `voice` defaults `'nova'`. Returns **raw mp3 bytes** (`Content-Type: audio/mpeg`), never a URL. Provider chain Cartesia (`sonic-english`, 8s abort) → OpenAI `tts-1` (18s). `TTS_MAX_CHARS = 950` — text is hard-truncated by the service. Voices `nova\|alloy\|echo\|fable\|onyx\|shimmer`. | **EXISTS — compose it** |
| Client playback + chunking | `app/hooks/useTTSPlayer.ts` — chunks at ~900 chars on sentence boundaries and pre-fetches the next chunk while the current plays. `ttsState` is one of the two signals that drive the metaMe R/T busy pulse (CLAUDE.md). | **EXISTS — compose it** |
| A listen affordance | `components/shared/ListenButton.tsx` (`getText`, `voice?`, `compact?`; states `idle\|loading\|playing\|error`) | **EXISTS — compose it** |
| Voice input ("interacting over reading") | `POST /api/skills/stt` (OpenAI `whisper-1` → Groq `whisper-large-v3`), `hooks/useSpeechRecognition.ts` (MediaRecorder-based, not Web Speech API), `components/ui/MicButton.tsx` — already used in ~20 surfaces including every `components/metame/setup/*Wizard.tsx` | **EXISTS — compose it** |
| Optional captions / synchronised transcript | — | **DOES NOT EXIST.** No caption or subtitle component, no WebVTT/`.vtt`/`.srt` handling, no `<track>` element, no cue timing, no highlight-as-it-speaks anywhere. `useTTSPlayer` exposes no text-position or caption callback. The single near-miss is a **dead stub**: `app/components/content/ContentViewer.tsx:443` renders a `Show Transcript` button with **no `onClick` and no panel behind it**. |

**Consequence for §9:** the narration and voice-input tiers are a composition exercise over shipped primitives. The caption tier is new build, and `useTTSPlayer` would need a caption/position seam it does not have today. A build that treats "optionally displays captions" as free would be wrong. Two further voice paths exist and must not be confused with the above: `hooks/useSpeechSynthesis.ts` (browser-native `speechSynthesis`, used only by `SmartTriadCopilotLayer`) and a `@vapi-ai/web` full-duplex voice agent dynamically imported in `components/composer/ComposerStudio.tsx`.

### 0.5 The Edge Companion today is a **four-button popup and a ~23rem iframe** — §5 and §6 are a very large expansion of it

`extension/companion-observer/` is nine plain-JS files, no build step. Manifest V3. Permissions `["storage","activeTab","scripting","sidePanel","contextMenus"]`. **`host_permissions` is now `["http://*/*","https://*/*"]`** — widened 2026-07-25 for the observer-healing re-injection sweep, which supersedes SPEC-MMC-003 §0.2's record of a single `dev-beta.aigentz.me` host permission. The content script runs on every http(s) page. `COMPANION_APP_ORIGIN` is hardcoded to `https://dev-beta.aigentz.me` in `constants.js`.

It presents exactly **three** UI surfaces: (1) the browser-action popup — a persona-to-pair panel (masked UUID + *Check again*) plus **Connect to metaMe**, **Verify Companion**, **Open Companion**, and one status line; (2) the Chrome **side panel**, which is nothing but a full-bleed `<iframe allow="clipboard-write">` of `/triad/embed/companion?surface=extension-sidebar`; (3) the **"Pull Across → metaMe"** context-menu item plus a transient action badge. The content script renders **no** in-page DOM.

The page inside that iframe (`app/(embed)/triad/embed/companion/page.tsx`) is, by its own header, the *minimal Companion shell*: a **single ~23rem-wide surface that toggles** between the embedded `SmartWalletDrawer` and a Companion rail (T1 identity chip + Timeline + Observer permissions). It is not a workspace.

**Therefore:** the operator's §6 claim that *"ALL remaining onboarding happens THROUGH the Companion"* is a substantial new capability, not a re-hosting of existing screens. And, decisively, **the extension contains no onboarding, tour, guide, first-run, or welcome UI of any kind** — a case-insensitive search across `extension/` for `tour|onboard|first-run|walkthrough|wizard|guide` returns **zero matches**. `chrome.runtime.onInstalled` registers the context menu and heals the observer; it opens no tab and shows no screen.

### 0.6 BLOCKING GAP 1 — journey selection is not merely unpersisted; **the selection mechanism does not exist at all**

SPEC-COS-001 §12.4 records that "no store persists a selected journey." The verified position is sharper still:

- `journey.select` is a **bare string literal** in `CONSTITUTIONAL_ROOT_CAPABILITIES` (`services/threshold/serviceRegistry.ts:122`). Tracing every consumer of that array — `grantableCapabilities()`, `gatewaySession.ts:471`, `welcome.ts:56`, the OAuth discovery route, `authorize-init` — **no handler anywhere branches on it.** It is issued as a scope and never read again.
- **There is no `select_journey` MCP tool.** `services/threshold/gateway.ts::listTools()` exposes eleven tools; `list_journeys` is present and no selection tool of any kind is. The name `select_journey` appears only in PRD-THR-001 §8's design table as an *intended* surface.
- The closest thing to selection is the MCP **prompt** `choose_your_journey` (`gateway.ts:208`, handler at `:559`), whose handler returns a **static instruction string** telling the agent to call `list_journeys` and ask. It takes no arguments and persists nothing.
- No table, column, or write path records "persona X selected journey Y." The `journey_states` table **does** exist (`supabase/migrations/20260402000000_experience_model_journey_state.sql`) — but its `stage`/`depth` columns are the **Experience Model funnel** (`prospect\|acolyte\|keta\|keji\|first\|zero\|…` × `pill\|capsule\|mini_runtime\|codex`, per `services/venture/customerMatrix.ts`). **No column holds a `JourneyId`, and nothing writes one.**

**§14 of this SPEC depends on this directly and cannot be implemented without it.** §14 is therefore filed with an explicit blocking prerequisite (§14.3), not as a design that assumes selection works. Writing §14 as though a journey can be selected today would be a fabrication.

### 0.7 BLOCKING GAP 2 — "Companion installed" and "Companion paired" are **not observable by the platform**, so §13's threshold cannot be evaluated today

§13 defines Threshold Crossing partly as *Companion installed · Companion paired*. Neither is server-observable:

- Pairing state (`accessToken`, `refreshToken`, `expiresAt`, `personaId`) lives **entirely in `chrome.storage.local`**, inside the extension. Nothing writes it to the platform.
- The only Companion table is `companion_observer_grants` (`supabase/migrations/20260815000000_companion_observer_grants.sql`) — `persona_id`, `capability`, `scope`, `site_domain`, `granted_at`, `revoked_at`. It records **capability consent**, not installation or pairing.
- SPEC-MMC-003 §8.2 records the honest limit already reached: the extension stamps `x-companion-surface`, `POST /api/companion/capture` reads it and **logs** it, and persisting it needs a migration that was deliberately held for its own operator go-ahead.
- A Companion-originated call is therefore *inferable* (a request arriving with an extension surface header) but not *recorded*, and absence of such a call is not evidence of absence of the Companion.

**Consequence:** §13's completion criteria cannot be computed by any existing resolver. Closing this needs either a persisted surface-provenance signal or an explicit pairing record — a schema change, gated in §20 (D-9).

### 0.8 A third gap, inherited and still open: aigentMe status is **derived**, not observed

`services/onboarding/substrateState.ts` marks the `agent-me` layer `resolution: 'derived'` and says so on the wire: aigentMe reachability is inferred from Passport issuance, because **engagement with the four Capsules is persisted nowhere.** This SPEC does not close that gap and does not pretend to. §13 lists "aigentMe active" as a criterion; today that reduces to "a Passport exists," which is not the same claim. D-10 in §20 covers it.

### 0.9 The vocabulary this programme needs **already exists in code three times over** — derive, never author a fourth

This is the `inv.engineering.036`/`037` hazard for this SPEC, and it is real. Three independently-defined five-member unions describe overlapping ideas:

| Union | Source of truth | Members |
|---|---|---|
| `OperatorArchetype` | `services/iqube/experienceQube.ts:74` | `citizen · entrepreneurial · technical · creative · research` |
| `ConstitutionalActionMode` | `services/iqube/experienceQube.ts:98` (Founder Office Action Modes amendment, ratified 2026-07-22) | `Build · Create · Develop · Research · Safeguard` |
| `JourneyId` | `services/threshold/journeyRegistry.ts` (PRD-THR-001 §9.1) | `citizen · entrepreneur · researcher · creative · technical` |

They are **already bridged in shipped code**, and the operator's §14 language maps onto those bridges exactly:

```
OperatorArchetype 'technical'
  → ConstitutionalActionMode 'Develop'      (ARCHETYPE_DEFAULT_ACTION_MODES, services/iqube/actionModes.ts)
  → ConstitutionalActionRole 'Developer'    (ACTION_MODE_ROLE, ibid.)
  → JourneyId 'technical'                   (ARCHETYPE_JOURNEY, services/onboarding/substrateState.ts)
  → ladder 'Developer → DevOn → AgentiQ Builder → Studio → Founder Office'  (journeyRegistry.ts)
  → AccessDomain 'developer-studio'         (services/passport/participationAccess.ts)
```

The operator's clarification — *"Technical Founder Operator … this IS the develop path"* — is therefore **not a new assertion; it is the shipped `technical → 'Develop'` row of `ARCHETYPE_DEFAULT_ACTION_MODES`**, stated in product language. §14.1 records the full mapping. Any implementation MUST derive from these three modules and add a parity canary where derivation is impossible, per CLAUDE.md's source-of-truth-parity discipline; hand-authoring a fourth "priority journeys" list would be exactly the defect class that produced four separate same-day regressions in the 2026-07-25 session.

### 0.10 Entry-path reality check — one path is fully real, one is partly real, one is half-fictional

| Operator's path | Verified status |
|---|---|
| **A — Claude Code / Claude AI → metaMe MCP** | **Real.** One MCP server exists: `POST /api/threshold/mcp` (`app/api/threshold/mcp/route.ts`), a hand-rolled JSON-RPC 2.0 Streamable-HTTP server, protocol `2025-06-18`, `SERVER_INFO.name = "metaMe Threshold Gateway"` — **not** "metaMe MCP"; this SPEC uses the real name. Eleven tools, five resources, five prompts (`services/threshold/gateway.ts`). |
| **B — metaMe.live → Platform Welcome** | **Partly real.** `metame.live` is a real referenced origin — the thin-client/runtime shell host, named in `middleware.ts` and `components/metame/connections/GoogleConnectionsPanel.tsx`. **No URL is constructed in this document.** A "Platform Welcome" surface exists in kind (`IRLWelcomeTab.tsx`, `AigentMeWelcomeSplitTab.tsx`, `services/threshold/welcome.ts`'s canonical `WELCOME_MESSAGE`), but no single surface today plays the Path-B role this SPEC assigns it. |
| **C — Invitation / QR Code** | **Half-real.** The invitation half is real: `app/invite/[code]/page.tsx` plus `claimAccessInvitation` (`services/passport/participationAccess.ts`) and `/api/threshold/link/[code]`. **The QR half does not exist at all** — there is no QR library in any `package.json`, and no QR component, route, or generator anywhere in the repo. §3 states Path C accordingly. |

### 0.11 One more honest correction — an ExperienceQube is **one per persona**, so §6's two-qube module is not free

`upsertExperienceQube` writes with `.upsert(row, { onConflict: 'persona_id' })` (`services/iqube/experienceQube.ts:491`) and `getExperienceQube` reads by `persona_id`. **There is exactly one ExperienceQube per persona.** `ExperienceType` (`'personal' | 'creative' | 'venture' | 'client' | 'portfolio' | 'venture_building'`) is a single enum **field on that one record**, not a multiplicity. The operator's §6 module list ("Personal Experience Qube · Venture Experience Qube (optional)") therefore either (a) means one qube whose `experienceType` is set, with venture strategy living in the existing `blak` fields (`strategicGoals`, `commercialGoals`, `activeKpis`, `franchiseProposition`, …), or (b) requires a schema change to hold two. D-6 in §20 makes the operator choose; this SPEC does not choose for them.

> **D-4 RESOLVED (operator ruling, 2026-07-26): the per-journey guides are named
> "Threshold Guides."** "Experience Guide" stays with the shipped 7×7
> PersonalGuide self-assessment; §8–§10's layer is "Guided Configuration" per
> the earlier note. Code applied same day: `journeyRegistry.ts` field
> `thresholdGuide`, ids `*-threshold-guide`; gateway copy updated. The
> paragraph below is retained as the record of the collision the ruling
> settled.

**And a naming collision that must be settled before any guide is built (D-4):** "Experience Guide" already means two *different* shipped things and this SPEC introduces a third sense. (1) `PersonalGuideData` (`types/experienceGuide.ts`) — a 7×7 *Sphere of Agency* × *Experience Maturity* **self-assessment lattice** with alignment state and repair risks, persisted at `blak.personalGuide`, edited through `PersonalGuideSetupWizard.tsx` (a modal form wizard, not a tour). (2) PRD-THR-001 §9.1's per-journey guides (`citizen-experience-guide`, `entrepreneur-experience-guide`, …), a `ConstitutionalJourney` field. (3) This SPEC's §8–§10 "guided experiences." **Three senses, one term.** Shipping a third without renaming would guarantee confusion in every future conversation.

---

## 1. Objective and constitutional principle

**Define universal onboarding for the Human Agency System: minimise cognitive load, maximise constitutional continuity. Every person enters through one coherent onboarding regardless of entry point.**

> **One constitutional onboarding · Multiple entry points · One threshold · Many specialist journeys.**
>
> Every entry point converges on the same constitutional infrastructure before diverging.

### 1.1 Two layers, not one — Constitutional Activation and Guided Configuration (operator refinement, 2026-07-25)

**"Threshold Crossing" was doing two jobs, and conflating them is what made §13 unimplementable and D-8 contradictory.** The refinement separates them:

| Layer | Question it answers | Nature | Authority |
|---|---|---|---|
| **Constitutional Activation** | *Is this citizen constitutionally active?* | **Objective.** A set of facts the platform either observes or honestly cannot (§13). | Binding. Gates specialist-journey activation (§14). |
| **Guided Configuration** | *Has this citizen been shown how to operate?* | **Experiential.** A guided pass through the capabilities, at the citizen's pace, in one sitting or progressively. | **Never gates anything.** May be completed, deferred indefinitely, or explicitly declined. |

**Threshold Crossed moves to the end** — it is no longer a synonym for either layer.

**AS ORIGINALLY DRAFTED** it was the terminal state of *both* layers: *Constitutional Activation complete AND Guided Configuration either completed or explicitly declined.*

**AS RATIFIED (D-21 confirmed 2026-07-26, after D-7's supersession):**

> **Threshold Crossed = Constitutional Activation complete.**

Guided Configuration no longer contributes to the threshold at all. D-7's supersession removed personalization from the gate, and a layer that gates nothing cannot be half of a terminal state. Guided Configuration becomes an **open-ended post-threshold track** that aigentMe drives (§6b.4) and that has **no completion state**.

**Three consequences, all load-bearing:**

1. **This resolves D-8.** The delegation contradiction existed because one list mixed constitutional facts with experiential completion. Under the split, Delegation is a **Constitutional Activation** criterion and is *required-when-an-agent-is-bound* rather than universally required — so a direct human arrival with no agent can complete Activation. Guide completion lives entirely in Guided Configuration and gates nothing. Neither layer needs the other weakened.

2. **"Declined" must stay distinguishable from "completed"** — and this survives the D-21 ratification, with a changed reason. It is no longer needed to evaluate the threshold (Guided Configuration no longer contributes to it); it is needed to run the post-threshold track honestly. The reference implementation collapses the two (`hasSeen = completed || skipped`, §0.3a Q6) — correct for a visitor tour, wrong here. A citizen who *declined* guidance should still be offered it later; one who *completed* it should not be re-prompted. A single boolean cannot carry that, whichever side of the threshold it sits on.

3. **Only Constitutional Activation is receipt-eligible.** Guided Configuration is a UX record, not a constitutional fact. Anchoring "watched the tour" would put a preference into the provenance trail. D-17's receipt question applies to Activation and to the Threshold Crossed terminal state — never to guide progress.

**Naming note:** this split does not resolve D-4's three-way "Experience Guide" collision. *Guided Configuration* names the **layer**; the mechanism that delivers it still needs the non-colliding name D-4 asks for.

---

**Scope boundary, stated once and binding throughout: this specification ENDS at Threshold Crossing.** It does not define the Technical Founder Operator, Research, or Creative specialist programmes. Those begin *after* the threshold, and each requires its own charter. §14 defines only the *activation gate* between them and this programme.

---

## 2. Relationship to SPEC-COS-001 — extension, not supersession

| Question | Answered by | Status |
|---|---|---|
| Which layers exist, in what order? | SPEC-COS-001 §1 | Ratified, shipped |
| Where does this caller stand right now? | SPEC-COS-001 §12 / `resolveSubstrateLayers` | Shipped |
| Which surfaces may be active given that? | SPEC-COS-001 §4 / `activeSurfaces` | Shipped |
| Does a direct arrival cross the same substrate? | SPEC-COS-001 §2.3 | Ratified |
| Is Studio an onboarding surface? | SPEC-COS-001 §3 — **no**, and this SPEC restates it as §14.4 without weakening it | Ratified |
| **Through which doors does a person enter?** | **This SPEC §3** | **Proposed** |
| **What must be true before personalisation begins?** | **This SPEC §4** | **Proposed** |
| **On which surface does the rest of onboarding happen?** | **This SPEC §5, §6** | **Proposed** |
| **How is a person taught to use a capability?** | **This SPEC §8, §9, §10** | **Proposed — nothing exists (§0.3)** |
| **When is onboarding finished?** | **This SPEC §13** | **Proposed — not computable today (§0.7)** |
| **What happens immediately after?** | **This SPEC §14** | **Proposed — blocked (§0.6)** |

**Rule of precedence:** where this SPEC and SPEC-COS-001 describe the same mechanism, SPEC-COS-001 governs and this document cites it. This SPEC introduces no second substrate, no second layer ordering, no second progressive-activation function, and no second persona resolver. `services/onboarding/substrateState.ts` remains the one authoritative answer to "where does this caller stand" — any stage/threshold state this SPEC needs must be **derived from it or added to it**, never computed in parallel.

---

## 3. Three canonical entry paths — converging after Companion install

All three converge on the identical tail. The tail is not restated per path; that is the whole point.

```
PATH A — reference implementation (third-party agent)
  Claude Code / Claude AI
    → metaMe Threshold Gateway (MCP)        ← real name; POST /api/threshold/mcp
    → Passport → Delegation → aigentMe
    → Edge Companion install
    → Constitutional Configuration
    → THRESHOLD CROSSED

PATH B — direct browser arrival
  metaMe.live → Platform Welcome
    → [ identical tail from Passport onward ]

PATH C — invitation (QR variant does NOT exist today, §0.10)
  Invitation link  → Passport
    → [ identical tail ]
```

**Path A is the reference implementation** — the one against which the others are checked, and the one PRD-THR-001 already specifies end-to-end for its own scope. Paths B and C are not lesser; they simply have no third-party agent at the top rung, which SPEC-COS-001 §2.3 already settled: **layer 1 is absent, not replaced.**

**Honest notes attached to each path:**

- **A** — the gateway's eleven tools are `list_journeys`, `list_services`, `inspect_threshold_link`, `explain_primitive`, `read_experiment_results`, `get_crossing_status`, `request_service_capabilities`, `propose_delegation`, `list_shared_documents`, `read_shared_document`, `submit_review`. PRD-THR-001 §8 also names `prepare_agent_card` and `enter_service` as prompts — **neither exists in code.** Path A must be specified against the eleven that do.
- **B** — no single surface plays "Platform Welcome" today (§0.10). Which surface takes that role is D-2.
- **C** — the invitation claim page and link resolution are real; **QR generation and scanning are not implemented anywhere** and must be built or dropped (D-3).

**Invariant (proposed, D-1):** *No entry path may define its own Passport, delegation, personhood, or agent-binding step.* This is SPEC-COS-001 §1's invariant applied to entry paths rather than specialist journeys — the same rule, one layer earlier. A path may differ **only** in its topmost rung and its first-contact copy.

---

## 4. Stage A — Constitutional Infrastructure

**Nothing personal is asked, offered, inferred, or configured until Stage A completes.** This is the load-bearing sequencing claim of the programme.

| Stage A requirement | Shipped mechanism | Observable today? |
|---|---|---|
| Passport active | `app/api/polity-passport/*`, `services/passport/personhoodProof.ts`; observed by `resolveParticipationSelfView` | **Yes** — `passportIssued` |
| Delegation active | `services/constitutional/constitutionalAgreement.ts` (`form` → `accept` → **`authorize`, human only**), `POST /api/constitutional/agreement` | **Yes** — `delegationActive` |
| aigentMe activated | `AigentMeWelcomeSplitTab.tsx`, the four Capsules | **No — derived from Passport only (§0.8)** |
| Edge Companion installed | — | **No (§0.7)** |
| Edge Companion paired | `background.js::connectToMetaMe` (client-side only) | **No (§0.7)** |

**Two constraints that ratification does not relax:**

1. **Delegation is the human-only gate, always.** `authorizeAgreement` refuses anyone but the owning human persona. No Stage-A completion mechanism, no Companion install orchestration, and no MCP assist may perform, pre-perform, batch, or imply that step. CFS-043 §2 is untouched by this SPEC.
2. **"Delegation active" as a *completion* criterion conflicted with the shipped model** — reconciled by the §1.1 layer split, pending operator confirmation (**D-8**). `services/onboarding/substrateState.ts` marks the delegation layer `optional: true` and states in its own evidence string that it "never gates a later layer" — the ratified accession-ladder behaviour of 2026-07-20. Making it a hard Stage-A gate would mean a direct human arrival who has no agent to delegate to could never complete Stage A. **§1.1's resolution:** Delegation is a Constitutional Activation criterion, *required-when-an-agent-is-bound* rather than universally — so the direct human arrival completes Activation, and no shipped behaviour is weakened. See §20 D-8.

**Progressive-activation conformance:** Stage A's surfaces are exactly the ones `activeSurfaces()` already reveals through the `passport` gate (`passport-apply`, `delegation-authorize`, `aigentme-capsules`). Stage A introduces no new activation logic — it names an ordering over surfaces the shipped function already governs.

---

## 5. The Edge Companion is not a browser extension

**Constitutionally, the Edge Companion is *the persistent constitutional presence of the Human Agency Runtime*.** The Chrome extension is its current delivery vehicle, in the same way that `chrome-extension://` is a delivery vehicle and not an identity. Once installed it becomes the **primary interaction surface** — available across Claude Code, Claude AI, ChatGPT, GitHub, ordinary browsing, Founder Office, Venture Lab, Financial Services, and future services.

**What is true today, precisely (§0.5):** the content script now runs on **every** http(s) page, so the Companion *can* be present on `claude.ai`, `chatgpt.com`, and `github.com`. What it can *say* there is a different question, and the honest answer is: very little.

| Claim | Verified position |
|---|---|
| The Companion is present across all browsing | **True today** — `host_permissions: ["http://*/*","https://*/*"]`, content script on all pages |
| The Companion renders constitutional context on those pages | **Only for two shapes.** `services/companion/overlayMapping.ts::shapeForDomain` returns `'github-repo'` for `*.github.com` and `'banking'` for a five-host set (`coinbase.com`, `www.coinbase.com`, `metame.com`, `www.metame.com`, `dev-beta.aigentz.me`). **Everything else returns `null`** and the surface renders an honest "no overlay available." There is no shape for `claude.ai`, `chatgpt.com`, Founder Office, Venture Lab, or Financial Services. |
| Closing that gap | **Already chartered elsewhere** — SPEC-CDR-001 (Constitutional Domain **& Context** Resolution) exists precisely to replace hostname→shape guessing with resolved profiles. Its 2026-07-25 operator refinement separates the two layers, and the second is exactly this SPEC's need: a **Domain Profile** is a property of the *subject* and identical for every citizen, while a **Resolved Context** is a property of the *subject × citizen* pair (SPEC-CDR-001 §12). "What should this citizen see on this page, at this point in their crossing" is a Context Resolution question, not a domain question. **This SPEC must not build a second classifier or a second context composer.** §20 records the dependency (D-11). |

**Constitutional rule (proposed, D-11):** *the Companion's presence on a surface never implies constitutional context for that surface.* Where no verified domain profile exists, the Companion says so. Abstention over fabricated context — SPEC-CDR-001 §6.2's rule, adopted here rather than re-derived.

---

## 5a. The Threshold Welcome surface — **D-2 RATIFIED 2026-07-26**

Path B's "Platform Welcome" is **a new universal Threshold Welcome surface**, composed from existing design and guide primitives. The operator's ruling, verbatim:

> Use a new universal Threshold Welcome surface, composed from existing design and guide primitives. Do not repurpose an IRL- or Agent Me-specific welcome tab. The surface begins or resumes Threshold Crossing and hands off to Passport.

### 5a.1 Reading the ruling precisely

- **"New" but not from scratch.** It is *composed from existing design and guide primitives* — the house style (`agentiqLiquidGlass` / `useSurfaceStyle`), the guided-experience framework (D-22/D-23: built natively in the Next.js Edge Companion, with the metaMe Runtime Shell tour as the read-only reference), and the shipped welcome copy where it fits. "New surface" is not licence to build a new design system or a second tour framework.
- **Universal is the point.** `IRLWelcomeTab` and `AigentMeWelcomeSplitTab` were both rejected precisely *because* each is scoped to one context. All three §3 entry paths converge on one surface, so no entry path defines its own welcome — the same principle as D-1's *"no entry path defines its own Passport / delegation / personhood / agent-binding step."*
- **"Begins OR RESUMES."** The surface is re-entrant. A citizen who leaves mid-crossing returns to it and continues; it is not a one-shot splash. This makes it a reader of Threshold state, not merely a launcher — which is what §13's lifecycle states (D-15) exist to give it.
- **Hands off to Passport.** The welcome surface never implements Passport, personhood, or delegation steps itself. It composes the existing onboarding plan (`buildOnboardingPlan`) and hands off.

`services/threshold/welcome.ts`'s `WELCOME_MESSAGE` remains available as content the new surface may render; it was one of the four candidates and is not excluded as a *primitive*, only as *the surface*.

---

## 6. Stage B — Constitutional Configuration, through the Companion

**After the Companion exists, all remaining onboarding happens THROUGH the Companion** — removing tab movement, site movement, and context switching. The modules are **independent and reorderable**; none blocks another.

| Module | Shipped surface to compose | Delta this SPEC adds |
|---|---|---|
| **Personal Experience Qube** | `services/iqube/experienceQube.ts` (one per persona, T1 `meta` / T0 `blak`), `ExperienceModelSetupWizard.tsx` | Progressive construction (§7) + a Companion-hosted rendering |
| **Venture Experience Qube** (optional) | `types/ventureQube.ts`, `services/iqube/ventureQubeSchema.ts`, `VentureLightWizard`/`VenturePro`/`VenturePortfolio` wizards | **Blocked on D-6** — an ExperienceQube is one-per-persona (§0.11); whether this is a second qube or `experienceType: 'venture'` on the one qube is an operator decision |
| **Preferences** | `app/api/wallet/identity/preferences/route.ts`, `app/api/ops/state/user-preferences/route.ts` | Companion-hosted rendering |
| **Notifications** | `app/api/wallet/notifications/route.ts`, `app/api/companion/notifications/route.ts` (delegation status + standing) | Companion-hosted rendering |
| **Experience Guide** | `types/experienceGuide.ts` + `PersonalGuideSetupWizard.tsx` + `GET/POST /api/assistant/experience-guide` — the 7×7 Sphere×Maturity **self-assessment** | **Naming collision — D-4.** This module is the shipped assessment, *not* §8–§10's guided experiences |
| **Journey Recommendation** | `recommendJourney()` (`substrateState.ts`) — derived from `operatorArchetype`, returns `null` when none is set | Companion-hosted rendering. **Recommendation only — selection does not exist (§0.6)** |
| **First Tasks** | `GET /api/wallet/tasks` (spine-conformant, assembles `crm_task_templates` / `crm_contributions` / `crm_rewards` / reputation) | Companion-hosted rendering, scoped to onboarding |

**The hard constraint on "through the Companion" (§0.5):** the Companion surface today is a single ~23rem panel toggling between the wallet and a three-item rail. Hosting configuration modules inside it is a **substantial UI programme**, not a re-mount. **D-5 is now ratified — see §6a.**

---

## 6a. Stage B's host — **D-5 RATIFIED 2026-07-26 (Companion as the aigentMe runtime)**

The operator's ruling is wider than the question asked. D-5 offered three hosting options; the answer replaces the framing.

### 6a.1 The ruling (operator, verbatim)

> The Edge Companion becomes the canonical runtime surface for the user's agentMe. Do not embed a second, separate Copilot inside the Companion. Instead, mount the existing CodexCopilotLayer as the Agent Me runtime, allowing it to expand to the full width of the Companion. The Companion becomes the container; AgentMe becomes the primary occupant.
>
> The Wallet and Agent Me remain peer modes within the same overlay, toggled within the existing Wallet-over-Cartridge pattern. The Copilot inherits the Companion dimensions rather than retaining its cartridge width.
>
> Because agentMe is now the persistent constitutional companion, it becomes the primary orchestration layer for the platform. Quick Links, cartridge navigation, Passport workflows and Workspace actions become actions that Agent Me performs on the user's behalf, driving the left-hand runtime while maintaining a single continuous conversation. This unifies the current Runtime Copilot, Edge Companion history, agreements, activity and settings into one persistent constitutional interaction model, eliminating duplicate conversational surfaces while preserving a single Agent Me identity across metaMe and the broader web.

### 6a.2 What this settles

| Question | Ruling |
|---|---|
| Where is Stage B hosted? | Inside the Companion, with `CodexCopilotLayer` mounted **as** the aigentMe runtime at the Companion's full width |
| A second Copilot inside the Companion? | **No.** Reuse before replacement (`inv.engineering.037`) — the shipped `CodexCopilotLayer` IS the runtime, not a thing to duplicate |
| Wallet vs aigentMe | **Peer modes in ONE overlay, toggled** — never two side-by-side panels, one of them cropped |
| Copilot width | Inherits the **Companion's** dimensions, not its cartridge width |
| aigentMe's platform role | Promoted to **primary orchestration layer** |

### 6a.3 Scope limit — **D-5 DOES NOT AUTHORISE A COMPANION REDESIGN** (operator, 2026-07-26)

The operator's follow-up is explicit and binding on this programme:

> Complete the current implementation programme exactly as scoped. Do not expand D-5 into a Companion redesign.

**What D-5 authorises inside SPEC-TCP-001 — and nothing more:** Stage B's §6 modules are hosted with `CodexCopilotLayer` mounted as the full-width aigentMe runtime inside the Companion, and wallet/aigentMe are toggled peer modes in one overlay (§6a.1–6a.2).

**Everything in the ruling's third paragraph is OUT of scope here and moves to its own charter — `SCOPE-MMC-004` (Companion 1.1).** That covers: Quick Links / cartridge navigation / Passport workflows / Workspace actions becoming aigentMe actions; unified bottom navigation across Runtime, Companion and partner sites; and consolidating Runtime Copilot + Companion history + agreements + activity + settings into one persistent interaction model.

The split matters because those two bodies of work have different risk profiles. Stage B hosting is a mount-and-size change inside a shipped component. Companion 1.1 re-architects platform navigation and touches the identity spine's session continuity. Letting the second ride along inside a Threshold Crossing phase is exactly the unscoped sprawl this programme is structured to avoid — and the operator has now ruled it out directly, not merely as a caution.

### 6a.4 Required amendment to CLAUDE.md at build time

CLAUDE.md's **Wallet-Over-Cartridge Overlay** section currently prescribes mounting `<SmartWalletDrawer variant="embedded" />` *inside* a `CodexCopilotLayer` flex container, with the wallet sliding in **alongside** the copilot. D-5 changes that relationship: wallet and aigentMe become **toggled peer modes occupying the same surface**, not co-resident panels.

The two are compatible in their essential claim — the wallet is still embedded inside the copilot's stacking context, never a standalone slide-over — but the *side-by-side* wording is superseded. **That section MUST be amended in the same change that implements this ruling**, so the canonical pattern and the shipped surface do not diverge. It is deliberately NOT amended now: CLAUDE.md documents built patterns, and nothing is built yet.

---

## 6b. What crosses the threshold — **D-7 RATIFIED then SUPERSEDED, both on 2026-07-26**

### 6b.1 The governing ruling (operator, verbatim — supersedes the earlier D-7 interpretation)

> Do not gate Threshold Crossing on completion of the ExperienceModel, ExperienceGuide or ExperienceQube. These are personalization assets, not constitutional prerequisites. The constitutional threshold is crossed once Passport, Delegation and Agent Me activation are complete. After crossing, Agent Me should progressively recommend and help populate the ExperienceModel and ExperienceGuide over time, including by deriving their JSON representations from ongoing interaction where appropriate. Manual forms remain available as review and editing surfaces, not mandatory onboarding steps.

### 6b.2 What this replaces

D-7 was first answered earlier the same day as *"a minimum viable Personal Experience Qube + one completed meaningful First Task."* **That answer is withdrawn.** The superseding note removes the PEQ from the gate entirely, and with it the two build-time definitions the earlier answer had created (a "minimum viable PEQ" field set, and a task signal distinguishing *completed* from *opened*). Neither is needed for the threshold; both are recorded here only so a reader of the git history knows they were dropped deliberately rather than forgotten.

The withdrawn answer is left visible rather than deleted because the reasoning that replaced it is the substantive part: **personalization is not constitution.** A citizen is not more or less constituted by how much of a profile they have filled in.

### 6b.3 The threshold, restated

**Threshold Crossing = Passport + Delegation + aigentMe activation.** Nothing about §6's configuration modules gates it.

| §6 module | Gates the threshold? |
|---|---|
| Personal Experience Qube | **No** — personalization asset |
| Experience Guide | **No** — personalization asset |
| Experience Model | **No** — personalization asset |
| Venture Experience Qube | **No** (still D-6 for its own modelling question) |
| Preferences | **No** |
| Notifications | **No** |
| Journey Recommendation | **No** (and could never have been — recommendation-only until D-19/D-20, §0.6) |
| First Tasks | **No** — the earlier answer required one; the superseding ruling names only Passport, Delegation and aigentMe activation |

### 6b.4 Personalization becomes a post-threshold, agent-driven track

The ruling does not discard the personalization assets — it **relocates** them to after the threshold and changes who does the work:

1. **aigentMe progressively recommends and helps populate** the ExperienceModel and ExperienceGuide over time.
2. **Derivation from interaction is explicitly permitted** — aigentMe may derive their JSON representations from ongoing interaction "where appropriate." This is the observer pattern applied to personalization: observed, not interrogated.
3. **Manual forms remain, with a changed role.** `ExperienceModelSetupWizard`, `PersonalGuideSetupWizard` and the rest survive as **review and editing surfaces**, never mandatory onboarding steps. Nothing is deleted; a wizard stops being a gate and becomes a place to check and correct what aigentMe has already derived.

**A constraint this implies, not yet decided:** if aigentMe derives profile content from interaction, the derived state must be distinguishable from what the citizen authored or confirmed. Otherwise a review surface cannot show the citizen *what was inferred about them* — which is the whole point of it being reviewable. That is a provenance field on the derived artifact, and it belongs to whichever charter builds the derivation, not to this SPEC.

### 6b.5 Consequential effect on D-21 — **RESOLVED, D-21 confirmed 2026-07-26**

D-21 adopted the **Constitutional Activation (objective) / Guided Configuration (experiential)** split, with Threshold Crossed as the terminal state of **both**. D-7's supersession broke that second half: Guided Configuration is no longer a gate, and a layer that gates nothing cannot be half of a terminal state.

**The operator confirmed D-21 as amended (2026-07-26).** The split stands; the "terminal state of both" clause is replaced:

> **Threshold Crossed = Constitutional Activation complete** — the four §13.1 criteria, nothing else.

Guided Configuration becomes an **open-ended post-threshold track** that aigentMe drives (§6b.4) and that has **no completion state at all**.

**This completes D-21's original purpose rather than weakening it.** D-21 existed to stop one list mixing constitutional facts with experiential completion. Removing Guided Configuration from the threshold finishes that separation: one layer gates and is receipt-eligible; the other never gates, is never receipted (§13.2), and never ends.

**What survives, with a changed reason:** "declined" must stay distinguishable from "completed" (§1.1 consequence 2). It is no longer needed to evaluate the threshold — it is needed to run the post-threshold track honestly, so a citizen who declined guidance can be offered it again while one who completed it is not re-prompted.

---

## 8. Modular guided experiences

**There is no single onboarding walkthrough.** Every major capability provides its **own independently-launchable guide**: Companion · aigentMe · Founder Office · Studio · Research Lab · Financial Services · MoneyPenny · Portfolio · future cartridges.

Each guide is launchable on its own, at any time, from the capability it describes — not only during onboarding, and not only in sequence.

**Verified status (CORRECTED, §0.3): none of these guides exists — but a mechanism to build one DOES exist**, as the shipped metaMe Runtime Shell Visitor Tour. It is the reference implementation (D-22: reuse before replacement) and must be audited against §0.3a before any alternative is proposed. The capabilities themselves are real and their surfaces are known — `app/(embed)/triad/embed/companion/page.tsx`, `AigentMeWelcomeSplitTab.tsx`, `FounderOfficeTab.tsx`, `components/composer/ComposerStudio.tsx`, `IRLResearchCopilotTab.tsx`, `MoneyPennyTab.tsx` / `MoneyPennyPanelTab.tsx`, `VentureLabPortfolioTab.tsx` — but nothing narrates, highlights, or sequences them.

**Design constraint (proposed):** a guide is **content over a mechanism**, not a bespoke component per capability. One guide runtime; one guide definition format; N definitions. Building nine independent walkthrough components would be the `inv.engineering.037` defect on delivery day one. D-12 gates the mechanism's shape.

**This constraint is also the one axis on which the reference implementation does not conform** — it is one bespoke component with one hardcoded twelve-step script (§0.3a Q3). Extracting *runtime* from *definition* is therefore the first real design task, and it is a refactor of something that works rather than a green-field build.

---

## 9. Guide design standard

> **It should feel like a product tour, not documentation.**

**Medium hierarchy, in strict order of primacy:**

1. **Primary — voice-guided walkthrough.** Narration is the main channel.
2. **Secondary — visual highlighting.** The active control is indicated.
3. **Tertiary — supporting text.** Present, but not the thing the user is expected to read.

The emphasis is on **listening and interacting** over reading.

**Each guide must:**

**Every capability below is labelled Existing · Composable · New**, so the spec stops reading as more green-field than it is (operator refinement, 2026-07-25):

| Requirement | Category | Buildable from | Notes |
|---|---|---|---|
| Highlight the active control | **Existing** | metaMe Runtime Shell `VisitorTour` — spotlight + halo, recoloured; `data-tour` anchor contract | Shipped and working (§0.3a). Not in the main tree — extraction, not invention |
| Stage the surface each card describes | **Existing** | `runStepEffect` + `sendIframeAction` postMessage; anchor-wait + settle discipline | The hardest part, already solved (§0.3a Q7) |
| Move the user through tabs and surfaces | **Composable** | `utils/codex-nav.ts::buildCodexUrl` (`tab`, `personaSessionToken`, `shell`, `from`/`fromTab`) | Main-tree plumbing; the reference implementation never routes, so this is genuinely additive |
| Narrate via text-to-speech | **Composable** | `POST /api/skills/tts` + `app/hooks/useTTSPlayer.ts` + `components/shared/ListenButton.tsx` | Compose — do not rebuild (§0.4). Step `title`/`content` are plain strings, so directly narratable |
| Voice input ("interacting over reading") | **Composable** | `POST /api/skills/stt` + `hooks/useSpeechRecognition.ts` + `components/ui/MicButton.tsx` | Already powers ~20 surfaces |
| Pause for interaction / await narration | **New** | — | Needs a **step-lifecycle seam** the reference implementation does not expose (§0.3a Q8). A seam, not a rewrite |
| Optionally display captions | **New** | — | `useTTSPlayer` has no caption/position seam (§0.4) |
| One runtime + N declarative definitions | **New** | — | The reference implementation is one component + one hardcoded script (§0.3a Q3). This is the extraction task |
| Steps derived from constitutional state | **New** | `services/onboarding/substrateState.ts` as the input | So a citizen is not walked through a rung they already hold |
| Resumable, persona-bound, observable progress | **New** | — | Reference state is two device-local localStorage flags (§0.3a Q5). Belongs to Constitutional Activation's discipline, not the tour's |
| Confirm completion before progressing | **New** | — | No completion state for anything guide-shaped is persisted in the main tree |

**The framework is specified by contract, not by library name (operator refinement, 2026-07-25).** This SPEC does not mandate `react-joyride`, nor any successor. What it mandates is the **behavioural contract** any Guided Experience Framework must satisfy — because those behaviours, not the library, are what make a guide trustworthy:

1. **Declarative definitions.** Steps are data, not code. One runtime, N definitions.
2. **A stable anchor contract.** Targeting is by explicit, framework-neutral attribute (the shipped `data-tour` convention), never by DOM structure or class names.
3. **Controlled advancement with anchor verification.** The runtime advances only once the next anchor is present and visible; a missing anchor skips one step rather than cascading. *(Shipped behaviour — see §0.3a; a replacement that loses this is a regression.)*
4. **Staging effects.** A step may open the surface it describes, including across an iframe/postMessage boundary, and the runtime must hold that surface open for the step's duration.
5. **A step-lifecycle seam.** Entered / ready / complete must be observable to a caller, so narration, captions, and interaction gating can compose onto any step.
6. **Externalised copy.** Narration text is authored data, subject to `TTS_MAX_CHARS`, never inline component strings.
7. **State the runtime does not own.** Progress is reported outward; the host decides what is durable, persona-bound, or receipt-eligible.

A library is an implementation detail beneath this contract. The shipped implementation satisfies 2, 3, and 4 today, partly satisfies 1, and does not yet satisfy 5, 6, or 7.

**Binding constraints on any implementation (proposed):**

- **`TTS_MAX_CHARS = 950`** is a real limit in `services/audio/ttsSynthesis.ts` and `useTTSPlayer` chunks at ~900 chars on sentence boundaries. Guide narration must be authored in narratable units, not paragraphs that get silently truncated.
- **The R/T busy pulse already binds `ttsState`.** CLAUDE.md's metaMe Client Protocol Primitive makes `ttsState === 'loading'` one of the two signals that drive the copilot busy pulse. A guide runtime that plays TTS outside `useTTSPlayer` would break that contract; it must go through the shipped hook.
- **Voice input is available and should be used.** `MicButton` + `useSpeechRecognition` + `POST /api/skills/stt` already power ~20 surfaces including every setup wizard. "Interacting over reading" should mean the user can *answer* by voice, not only listen.
- **Accessibility is not optional and not deferrable.** A voice-primary guide with no caption tier is inaccessible. Since the caption tier does not exist (§0.4), it is a build item, not an assumption. D-13.

---

## 10. First guide to implement — the Companion Guide

**"Your Persistent Constitutional Presence."**

The Companion Guide is the first guide because it establishes the mental model for the entire platform. Every later guide assumes the user understands what the Companion is; if that fails, everything downstream is harder.

**Topics, in order:**

1. What the Companion is
2. Why it exists
3. Constitutional continuity
4. Context awareness
5. Persistent agency
6. Agent interaction
7. Artefacts
8. Notifications
9. Delegation
10. Daily workflow
11. Next steps

**Honesty constraint on this guide specifically (binding):** the guide must describe the Companion **as it is**, not as §5 aspires. Today that means: a popup with four controls, a side panel hosting a ~23rem toggle surface (wallet ↔ identity chip + Timeline + Observer permissions), a "Pull Across → metaMe" context-menu capture, seven revocable Observer capabilities with global/site scope re-validated server-side, and constitutional overlay context for GitHub and the banking-class host set **only** (§0.5, §5). A narrated guide that promises constitutional context on `claude.ai` today would be a fabrication delivered in the user's ear, which is worse than one on a page. **The guide script and the shipped capability must ship in lockstep, and the ratification register (D-14) requires the operator to approve the script against the capability set current on its build date.**

---

## 11. Observer integration

**Every onboarding stage exposes:** current stage · completed stages · blocked stages · prerequisites · recommended next action · completion percentage. **Every copilot can guide the user to the next stage.**

**Verified position:** the first four are already computable and already exposed. The last two are not.

| Field | Shipped source | Status |
|---|---|---|
| Current stage | `nextAction(layers, deepLinks).layer` | **Exists** |
| Completed stages | `layers.filter(l => l.status === 'crossed')` | **Exists** |
| Blocked stages | `layers.filter(l => l.status === 'blocked')` | **Exists** |
| Prerequisites | `SUBSTRATE_SURFACES[].revealedBy` + the layer ordering law | **Exists** |
| Recommended next action | `nextAction()` — returns title + a verified deep link or `null`, never a guessed URL | **Exists** |
| **Completion percentage** | — | **DEFERRED — D-15 RATIFIED 2026-07-26.** Phase 1 exposes **explicit lifecycle states**, never a partial or fabricated percentage. A percentage returns only when D-7 is ratified (**done**) *and* D-9 establishes observability for **every** included criterion (**outstanding** — Companion install/pair is still unobservable, §0.7). The `journey` layer's permanent `not-resolvable-today` status (§0.6) is no longer an obstacle here, since D-7 excluded Journey Recommendation from the threshold set. |
| **Copilot consumption** | — | **Does not exist.** No component calls the route (§0.2). |

**Binding rule (proposed):** the observer surface **derives from `services/onboarding/substrateState.ts`** — extending that module and its `SUBSTRATE_SURFACES` table where new state is genuinely needed. It must not compute stage state in a copilot, a hook, or a second service. One authoritative answer to "where does this caller stand," consumed by many surfaces. Any new field must carry the same `SubstrateResolution` honesty dial (`observed` / `declared` / `derived` / `not-resolvable-today`) the shipped resolver already puts on the wire, so a consumer can never mistake a derived signal for an observed one.

**Client-transport rule (non-negotiable, CLAUDE.md):** every client read of a spine endpoint under this programme uses `personaFetch` from `utils/personaSpine`, passing `personaIdHint` wherever the surface knows the active persona. Never raw `fetch`, never `authedFetchHeaders`. `tests/persona-spine-fetch.test.ts` is the canary and must not be weakened to admit a new surface.

---

## 12. Progressive disclosure

**Capabilities appear only when relevant. The runtime decides what to show, when, and why it matters. Users never see the full platform at once.**

This is **not new doctrine** — it is SPEC-COS-001 §4's progressive surface activation, itself an application of CFS-050's Principle 002 (progressive agency) and Principle 003 (reveal capability only when relevant to current intention). It is already one pure, canary-tested function:

```ts
// services/onboarding/substrateState.ts
export function activeSurfaces(layers: SubstrateLayer[]): SubstrateSurfaceId[]
```

**This SPEC adds exactly one thing to it: the "why it matters" channel.** `activeSurfaces` says *whether* a surface may appear; it says nothing about *why* it became relevant. A runtime that reveals a capability without explaining its relevance has done disclosure but not guidance.

**Binding rule (proposed, D-16):** the rationale is **derived from the same layer evidence the resolver already produces** (`SubstrateLayer.evidence`, and the resolution dial that qualifies it) — never authored as separate marketing copy per surface, which would drift from the state it claims to explain on the first change to either.

---

## 13. Threshold Crossing — the completion definition (RESTRUCTURED per §1.1)

**Two layers, evaluated separately. Threshold Crossed is the terminal state of Constitutional Activation ALONE** (D-21 as ratified 2026-07-26). Guided Configuration is tracked, never gating, and has no completion state.

### 13.1 Constitutional Activation — objective, binding, gates §14

Achieved when all **four** are true:

1. **Passport active**
2. **Delegation active** — *required-when-an-agent-is-bound*, not universally (§1.1, D-8)
3. **aigentMe active**
4. **Companion paired** — install is its precondition, not a separate criterion (D-24, §9.1 of the Companion 1.1 Scope)

This is **four, not the six originally drafted.** Criterion 6 ("initial constitutional configuration complete") was removed by D-7's supersession — personalization is not a prerequisite (§6b). The former criteria 4 and 5 collapse into one: pairing cannot occur without an installed Companion. The result matches the Companion 1.1 Scope's statement of the same sequence:

```
Passport → Delegation → Agent Me Activation → Companion Pairing → Threshold Crossed
```

**The citizen is then constitutionally active.** This is the objective layer; every criterion is a fact the platform either observes or honestly reports it cannot (table below).

### 13.2 Guided Configuration — experiential, never gates

**No longer a threshold layer at all (D-21 as ratified).** It is an **open-ended post-threshold track**: aigentMe progressively guides and populates (§6b.4), and there is no state at which it is "done". It has **no** gating power over Constitutional Activation, specialist-journey activation, or any surface — and now no terminal state either. Its two terminal states must remain distinguishable (§1.1 consequence 2): a citizen who *declined* may be offered guidance again; a citizen who *completed* should not be re-prompted. Recording both as one boolean — the reference implementation's `hasSeen = completed || skipped` (§0.3a Q6) — would lose exactly the distinction this SPEC needs.

**Guided Configuration is not receipt-eligible.** It is a UX record, not a constitutional fact (§1.1 consequence 3).

### 13.3 Threshold Crossed — the terminal state

> **Threshold Crossed = Constitutional Activation complete** (all four §13.1 criteria).

**D-21 as ratified 2026-07-26.** Guided Configuration contributes nothing to this determination. Nothing may report Threshold Crossed on the strength of fewer than the four criteria — and nothing may withhold it because guidance is incomplete.

**What the ratification preserved:** D-21 existed to stop one list mixing constitutional facts with experiential completion. Removing Guided Configuration from the threshold does not weaken that — it completes it. The layers are now cleanly separated: one gates and is receipt-eligible; the other never gates, is never receipted (§13.2), and never ends.

**Verified evaluability of the Constitutional Activation criteria — this table is the reason §13.1 is not implementable today:**

| # | Criterion | Observable? | Evidence |
|---|---|---|---|
| 1 | Passport active | **Yes** | `resolveParticipationSelfView` → `passportIssued` |
| 2 | Delegation active | **Yes — conflict resolved by §1.1** | `delegationActive` is observed. The shipped layer is `optional: true` and "never gates"; §1.1 reconciles this by making it *required-when-an-agent-is-bound* within Constitutional Activation rather than a universal gate (D-8) |
| 3 | aigentMe active | **No — derived** | Derived from Passport issuance; Capsule engagement is persisted nowhere (§0.8, D-10) |
| 4 | Companion installed | **No** | No table, column, or signal records it (§0.7, D-9) |
| 5 | Companion paired | **No** | Pairing state lives in `chrome.storage.local` only (§0.7, D-9) |
| 6 | ~~Initial configuration complete~~ | **REMOVED as a criterion** | **D-7 SUPERSEDED 2026-07-26** (§6b): ExperienceModel / ExperienceGuide / ExperienceQube are personalization assets, not constitutional prerequisites. No §6 configuration module gates the threshold, so this row is no longer a Constitutional Activation criterion at all. Personalization continues as a post-threshold track aigentMe drives (§6b.4) |

**Criterion 6 is removed. D-24 is now resolved (Companion 1.1 Scope §9): Companion Pairing is RETAINED**, with `Companion installed` folded in as its precondition rather than an independent criterion. The threshold therefore reads:

```
Passport → Delegation → Agent Me Activation → Companion Pairing → Threshold Crossed
```

**Two criteria remain unobservable, and they are the whole remaining problem:**

- **Companion Pairing (D-9)** — pairing state lives in `chrome.storage.local` only, so nothing server-side can see it. **D-9 is the long pole**, confirmed rather than conditional.
- **aigentMe active (D-10)** — still *derived* from Passport issuance rather than observed. Now that the threshold turns explicitly on "Agent Me Activation" as its own step, a derived signal is weaker than the criterion requires: it would assert activation from the presence of a passport rather than from any evidence that aigentMe was actually activated. D-10 is no longer a nice-to-have.

Either way, any implementation that reports "Threshold Crossed" while its criteria are underivable would be asserting a constitutional state it cannot observe — the precise class of failure SPEC-COS-001's resolver was built to avoid, and which its `not-resolvable-today` dial exists to make visible.

**Receipt posture (proposed, D-17):** if Threshold Crossing is to be receipted, it composes the existing unified receipt writer and, if anchored, the existing DVN pipeline with a new **action type only** — the one change CLAUDE.md's DVN Pipeline Protection section permits unilaterally. No payload-shape change, no state-machine change, no `hashPersonaRef` change. Any receipt carries a T2 `personaPublicRef` (`services/identity/personaReferences.ts`) and **never** a `personaId`.

---

## 14. Specialist journey activation — only after Threshold Crossing

**No specialist journey activates before the threshold is crossed.** This is the programme's terminal gate and the boundary of this document's scope.

### 14.1 Priority journeys, mapped to what actually exists

| Priority | Operator's name | `OperatorArchetype` | `ConstitutionalActionMode` | `ConstitutionalActionRole` | `JourneyId` | Ladder (verbatim, `journeyRegistry.ts`) | `AccessDomain` |
|---|---|---|---|---|---|---|---|
| **1** | **Technical Founder Operator** — primary commercial focus. *Operator clarification: this IS the develop path.* | `technical` | **`Develop`** | `Developer` | `technical` | Developer → DevOn → AgentiQ Builder → Studio → **Founder Office** | `developer-studio` |
| **2** | Research | `research` | `Research` | `Researcher` | `researcher` | Researcher → IRL → Publications → Steward Research → **Founder Office** | `research-lab` |
| **3** | Creative | `creative` | `Create` | `Creator` | `creative` | Creative → Creative Studio → Publishing → metaKnyt → **Founder Office** | `metame-studio` |

Every row of this table is **read from shipped code** (§0.9), not authored here. The operator's clarification is the shipped `technical → ['Develop']` row of `ARCHETYPE_DEFAULT_ACTION_MODES` (`services/iqube/actionModes.ts`), stated in product language.

### 14.2 Build and Safeguard — what they actually are

**Build and Safeguard remain aigentMe-led for Phase 1.** The reconciliation:

- **`Build`** is a `ConstitutionalActionMode`, seeded by the `entrepreneurial` archetype — which maps to `JourneyId 'entrepreneur'` (ladder: Entrepreneur → Experience Builder → Business Operations → Founder Office, domain `venture-lab`). So Build *does* have a journey; it is simply not a priority-1–3 journey for this programme.
- **`Safeguard`** is a `ConstitutionalActionMode` with **no archetype that seeds it** (`ARCHETYPE_DEFAULT_ACTION_MODES` maps no archetype to it) and **no journey at all**. There is no `safeguard` `JourneyId` and no `AccessDomain` for it.

"aigentMe-led" is therefore the honest description of both: they are Action Modes the aigentMe surface can reflect through the observer layer (`SmartTriadObserverContext`, NBE reranking weights), not journeys with ladders to climb. **D-18** asks the operator to confirm that reading rather than have an implementer guess it.

### 14.3 THE BLOCKING PREREQUISITE — journey selection must be built before §14 can exist

**§14 cannot be implemented in any form until a journey selection can be made and persisted.** Per §0.6, today:

- no `select_journey` MCP tool exists;
- `journey.select` is an issued scope that no handler reads;
- no table, column, or write path records a persona's journey;
- `journey_states` holds the unrelated Experience Model funnel;
- consequently `resolveSubstrateLayers` marks the `journey` layer `not-resolvable-today` **permanently**, and `activeSurfaces` **can never activate `specialist-journey`** — a property `tests/onboarding-substrate.test.ts` asserts across the full observation cross-product.

**The persistence work this requires, stated so it can be chartered (not authorised here):**

1. **A journey-selection store.** Persona-scoped, one selected `JourneyId` (plus, if the operator wants it, a selection history). `personaId` is T0 and stays server-side. The `JourneyId` value MUST be validated against `isJourneyId` from the live registry — never a free string, never a hand-copied list.
2. **A write path with a clear actor.** Selection is the person's choice. **D-19 is now ratified — see §14.3a.** The write path MUST separate *prepared* from *active*, because an agent may reach the first and only the principal may reach the second.
3. **A `select_journey` MCP tool** (Path A) wrapping that write path, sitting alongside the existing `list_journeys`, plus a browser affordance for Paths B and C.
4. **A migration.** Exact SQL must be provided inline to the operator at charter time, per CLAUDE.md's operator-instructions rule.
5. **Resolver extension, not replacement.** `resolveSubstrateLayers`'s `journey` layer flips from `not-resolvable-today` to `observed`, and its evidence string is rewritten. `SubstrateObservation` gains one field. The canary is **extended**, never weakened — including the assertion that `specialist-journey` still cannot activate while the layer is uncrossed.

**Until all five land, §14 is a design, not a plan.** This SPEC states that plainly rather than describing a handoff that has nothing to hand off.

### 14.3a Who may select a journey — **D-19 RATIFIED 2026-07-26**

The operator's ruling, verbatim:

> A delegated agent may recommend and prepare a journey selection, but the principal must explicitly confirm it through the existing authorization spine before it becomes active. No agent-finalized journey selection and no parallel authorization gate.

This is **Principal–Delegate Separation** (CFS-043 §2) applied to journey selection: the agent may inspect, prepare and propose; only the human confirms. It is the same shape as the Constitutional Agreement lifecycle, where MoneyPenny may `form` and `accept` her own side but only a human may `authorize`.

**What it requires of §14.3 item 2 — the write path:**

| Actor | May reach | May NOT reach |
|---|---|---|
| Delegated agent | a **prepared** (proposed) journey selection | `active` |
| Principal | `active`, by explicit confirmation through the existing authorization spine | — |

- **Two states, not one.** A single "selected journey" column cannot express this. The store needs a prepared/active distinction so an agent-prepared selection is durable, visible and revocable *without* being in force.
- **Confirmation composes `requireAuthorizedAgreement`.** It does not get its own check. "No parallel authorization gate" is explicit in the ruling and matches the standing rule that identity and authority resolve one way, everywhere.
- **The `select_journey` MCP tool (item 3) may only ever PREPARE.** There must be no agent-reachable path that produces an active selection — the same structural property `tests/moneypenny-runtime-authority-boundary.test.ts` enforces for `authorizeAgreement`, and it should be canaried the same way rather than left to review.
- **Activation is a receipt-eligible act.** A journey selection determines which ladder a persona climbs; if D-17 rules that Threshold Crossing emits a receipt, journey activation belongs in the same class.

**Why this is a real constraint, not a formality:** journey selection sets a persona's ladder, `AccessDomain`, and default `ConstitutionalActionMode`. An agent that could finalise it would be choosing the shape of the principal's constitutional life. Recommend-and-prepare keeps the agent genuinely useful — it can do all the work — while leaving the choice where sovereignty requires it.

### 14.4 Studio is an advanced operating environment, not an onboarding destination

Restated from SPEC-COS-001 §3, unweakened. Studio (`components/composer/ComposerStudio.tsx`, producing `StudioArtifact` objects through `Working → Review → Published → Canonical → Archival`) presupposes a fully-formed Constitutional Persona with standing and authored intent. It appears in exactly one journey ladder — the Technical journey's fourth rung — and is surfaced **when appropriate**, never as an onboarding destination. Nothing in this programme may route a pre-threshold arrival into Studio; doing so would grant authoring authority before Delegation, which is CFS-043 §2's violation one layer downstream.

---

## 15. MCP integration — defers to SPEC-MMC-003, does not re-specify it

MCP's role in this programme is to orchestrate: Companion installation · browser detection · pairing · Passport linking · delegation · onboarding progression · post-install validation — **reducing cognitive load while respecting browser security models and explicit user consent.**

**SPEC-MMC-003 already specifies all of this**, stage by stage, against the real browser-security constraints, and records exactly which stages shipped. This SPEC **defers to it entirely** and adds nothing to it:

| Concern | Owner | Status per SPEC-MMC-003 |
|---|---|---|
| Browser detection | SPEC-MMC-003 §3.1 | PROPOSED, not built (§8.4 — no consumer until §3.2 exists) |
| Install orchestration | SPEC-MMC-003 §3.2 | PROPOSED, **cannot be built honestly** — there is still no published store listing; the operator-supplied store URL is the single value that unblocks it (§8.4) |
| Pairing | SPEC-MMC-003 §3.3 | **SHIPPED 2026-07-25** — persona confirmation sequenced before Connect; the pairing-code alternative remains unbuilt |
| Passport linking | SPEC-MMC-003 §3.4 | Sequencing over shipped mechanisms; satisfied by §8.1 |
| Delegation | SPEC-MMC-003 §3.5 | Composes `recommendDelegatedAuthority` + the human authorize step; unchanged |
| Runtime registration | SPEC-MMC-003 §3.6 | **SHIPPED, minus persistence** — header stamped and read; persisting surface provenance needs a migration (this is §0.7's gap) |
| Post-install verification | SPEC-MMC-003 §3.7 | **SHIPPED** — one tri-state check (`VERIFY_COMPANION`) |
| MCP install-assist tools | SPEC-MMC-003 §5 | **Explicitly speculative.** `companion.checkInstallStatus`, `companion.generatePairingCode`, `companion.verifyPostInstall` do not exist and are not chartered |

**Binding rule (proposed):** any MCP surface added under this programme is added to the **existing** Threshold Gateway (`services/threshold/gateway.ts`, served at `POST /api/threshold/mcp`) as one more tool in the existing catalogue. **No second MCP server.** Note also, per §0.10, that the server's real name is *metaMe Threshold Gateway*; "metaMe MCP" is not a name anything in this repo answers to, and this SPEC does not introduce it as one.

---

## 16. Success criteria

The programme succeeds when:

1. **Onboarding is conversational, not procedural.**
2. **Context switching is minimal** — the user is not moved between tabs, sites, and windows to complete a single constitutional step.
3. **The Companion is established as the primary constitutional workspace.**
4. **Personalisation is progressive**, delivered through modular configuration rather than an upfront form wall.
5. **Specialist journeys activate only after constitutional infrastructure is complete.**
6. **The transition from onboarding into ongoing operation is seamless** — there is no moment where the user is "done onboarding" and must start again somewhere else.

**Measurement honesty (binding, per CLAUDE.md's hypothesis-vs-canon discipline):** each of the six is currently an **unmeasured design intention**, not an established outcome. If any is registered in the CFS-051 pipeline as a claim about the world (e.g. *"progressive configuration reduces onboarding abandonment"*), it enters as **`proposed`**, never `canonical`, until experiments produce supporting evidence. Criteria 1–4 and 6 are empirical; criterion 5 is a governance rule and may be canonical if the operator ratifies it as such.

---

## 17. Architectural observation — the Companion is the constitutional home of the citizen

Recorded prominently because it reframes the platform's topology, not merely this programme's.

> **The Companion is no longer simply an interface. It is the constitutional home of the citizen.**
>
> Every other surface — Claude Code, metaMe.live, Founder Office, Studio, IRL, MoneyPenny, Venture Lab — is a **specialised workspace** that the Companion introduces and coordinates.
>
> **Users enter through many doors, but they always come home to the Companion.**

**This reframes Homecoming (SPEC-HMC-001), and the reframing is the point.** SPEC-HMC-001's own origin records the operator's framing verbatim: *"Its purpose is not importing chats. Its purpose is preserving agency."* This observation completes that thought:

> **Homecoming is not only about migrating an AI relationship. It is about bringing that relationship into the citizen's persistent constitutional presence — where it continues across models, tools and journeys without losing continuity.**

A migrated relationship that lands nowhere in particular has been imported, not brought home. The Companion is the *where*. This is the same principle PRD-THR-001 §16 states for the agent case — *"the constitutional relationship belongs to the person and survives the provider"* — extended from "survives the provider" to "has somewhere to live."

**What this observation does NOT authorise:** it does not make the Companion a second identity layer, a second Passport surface, or a second delegation gate. SPEC-COS-001 §7.2 settled that and it stands: *"Its Observer/Search/Capture/Overlay capabilities are downstream conveniences layered on top of an already-established identity — never an alternate identity-establishment path."* "Home" is where the constitutional relationship **lives**, not where it is **created**.

---

## 18. Coordination — this programme's place in the four-strand operator initiative

| Strand | Document | Relationship to this SPEC |
|---|---|---|
| **1** | **CFS-051** — Experiment / Constitutional / Invariant Pipeline (`codexes/packs/irl/foundation/CFS-051_experiment-constitutional-registry.md`) | Where §16's empirical claims and §20's candidate invariants are registered as `proposed`. This SPEC registers nothing itself. |
| **2** | **SPEC-HMC-001** — Homecoming & Constitutional Agent Continuity (`codexes/packs/irl/foundation/SPEC-HMC-001_constitutional-agent-continuity.md`) | Reframed by §17. A homecoming lands *into* the Companion. Its Phase 1 (continuity assessment) shipped; Phases 2+ are not authorised and are not authorised by this document either. |
| **3** | **SPEC-COS-001** — Constitutional Onboarding Specification (`codexes/packs/irl/foundation/SPEC-COS-001_constitutional-onboarding-specification.md`) | **Direct parent.** This SPEC extends it (§2). |
| **4-A** | **SPEC-MMC-003** — MCP-Assisted Companion Deployment (`codexes/packs/irl/foundation/SPEC-MMC-003_mcp-assisted-companion-deployment.md`) | Owns §15 entirely. Its §3.2 store-listing gap is this programme's hardest external dependency. |
| **4-B** | **MoneyPenny cohesion review** (`codexes/packs/agentiq/updates/2026-07-24_moneypenny-cohesion-review.md`) + **PRD-MPY-001** | §8's Financial Services and MoneyPenny guides consume its conclusions. **Checkpoint, not a redesign (operator, 2026-07-25):** this SPEC consumes the review's conclusions when authoring those two guide scripts. It does not restructure the Financial Services surface, alter the Domain 1/2 shadow posture, or reopen PRD-MPY-001. Any FS surface change is that programme's work, not this one's. |
| — | **SPEC-CDR-001** — Constitutional Domain **& Context** Resolution (`codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md`; DRAFT — direction ratified 2026-07-25, §10 decisions still open) | Owns the §5 gap. Its Context Resolution layer (§12–§14, added by the operator's 2026-07-25 refinement) is the mechanism that answers "what should *this citizen* see here" — the exact question a Companion-hosted onboarding needs answered on every page. **D-11 records this as a dependency, not a thing to solve here.** |

---

## 19. Out of scope / non-goals

- **No code changes.** No routes, tables, resolvers, components, migrations, or extension changes are made by this document.
- **Does NOT define the specialist programmes.** Technical Founder Operator, Research, and Creative each need their own charter. This SPEC defines only the activation gate (§14).
- **Does NOT re-specify SPEC-COS-001's substrate, layer ordering, or progressive-activation function** — cited, never re-derived (§2).
- **Does NOT re-specify SPEC-MMC-003's seven deployment stages** — §15 defers wholesale.
- **Does NOT re-specify CFS-043/043a's Principal–Delegate Separation** — cited; §4 and §14.3 explicitly refuse to weaken it.
- **Does NOT build a second domain classifier for the Companion Overlay** — that is SPEC-CDR-001's (§5, D-11).
- **Does NOT introduce a second MCP server** — §15.
- **Does NOT invent a store listing URL, a `metame.live` URL, or any other URL.** None is stated anywhere in this document; the store listing still does not exist (SPEC-MMC-003 §8.4).
- **Does NOT claim a QR entry path works** — no QR implementation exists (§0.10).
- **Does NOT modify the DVN pipeline or any protected spine file.** Any receipt work is a new action type only (§13).
- **Does NOT define the Companion's Observer consent model** — PRD-MMC-001 §4 owns it, unchanged. Installing and pairing grant nothing beyond identity-only.

---

## 20. Ratification decision register

Every decision below must be resolved before implementation. **No code changes under this SPEC until then.** Decisions marked **BLOCKING** gate a section that cannot exist without them.

| # | Decision | Recommendation | Status |
|---|---|---|---|
| **D-1** | Adopt *"no entry path defines its own Passport / delegation / personhood / agent-binding step"* as an invariant candidate (§3), composing SPEC-COS-001 §9's One Onboarding Substrate | Adopt. Governance rule, not an empirical claim → eligible for `canonical` | **Open** |
| **D-2** | Which surface plays Path B's "Platform Welcome"? Candidates: `IRLWelcomeTab`, `AigentMeWelcomeSplitTab`, `services/threshold/welcome.ts`'s `WELCOME_MESSAGE`, or a new one | **RATIFIED (operator, 2026-07-26): a NEW universal Threshold Welcome surface**, composed from existing design and guide primitives. Do **not** repurpose an IRL-specific or aigentMe-specific welcome tab. The surface begins **or resumes** Threshold Crossing and hands off to Passport. See §5a | **RATIFIED** |
| **D-3** | Path C's QR variant: build QR generation/scanning, or drop QR from the spec until it exists | Drop from Phase 1; the invitation link path already works | **Open** |
| **D-4** | Resolve the three-way "Experience Guide" naming collision (§0.11) — rename this SPEC's §8–§10 concept, or rename one of the two shipped senses | Rename this SPEC's concept (e.g. "Capability Walkthrough"); the two shipped senses are load-bearing in code and docs | **Open — BLOCKING for §8–§10** |
| **D-5** | Where Stage B is hosted: extension side panel · widened Companion embed · promote the embed to a full `CodexCopilotLayer` mount | **RATIFIED (operator, 2026-07-26), and materially wider than the question asked.** The Edge Companion becomes the **canonical runtime surface for the citizen's aigentMe**: the existing `CodexCopilotLayer` is mounted AS the aigentMe runtime and expands to the Companion's full width — the Companion is the container, aigentMe the primary occupant. **No second Copilot is embedded inside the Companion.** Wallet and aigentMe are **peer modes toggled within one overlay** (the existing Wallet-over-Cartridge pattern), never two cropped side-by-side panels. Consequently aigentMe becomes the platform's **primary orchestration layer** — **but that consequence is chartered SEPARATELY as `SCOPE-MMC-004` (Companion 1.1), not by this SPEC** (operator, 2026-07-26: *"Do not expand D-5 into a Companion redesign"*). Full text and scope limit: §6a | **RATIFIED — supersedes the three options offered** |
| **D-6** | "Venture Experience Qube": `experienceType: 'venture'` on the single per-persona qube, or a genuine second qube (schema change) | Prefer the shipped one-qube model unless the operator needs true multiplicity | **Open** |
| **D-7** | What "initial constitutional configuration complete" means — which subset of §6's seven modules is required | **SUPERSEDED (operator, 2026-07-26, same day as its first answer).** The earlier answer (minimum viable PEQ + one meaningful First Task) is **withdrawn**. Governing ruling: *ExperienceModel, ExperienceGuide and ExperienceQube are personalization assets, not constitutional prerequisites* — **no §6 module gates the threshold.** The threshold is **Passport + Delegation + aigentMe activation**. Personalization moves to a post-threshold track aigentMe drives, deriving from interaction where appropriate; manual forms survive as review/edit surfaces, never mandatory steps. See §6b | **RATIFIED (superseding)** |
| **D-8** | Reconcile "Delegation active" as a Stage A / §13 criterion against the shipped `optional: true` / "never gates" model | Recommend: keep Delegation **optional** for threshold crossing, and make it **required-when-an-agent-is-bound** (Path A). Otherwise a direct human arrival can never cross | **Open — BLOCKING for §4, §13** |
| **D-9** | Make Companion install + pairing server-observable — persist surface provenance (SPEC-MMC-003 §3.6's held migration) or add an explicit pairing record | Adopt the smaller: persist the already-stamped `x-companion-surface`. Exact SQL to the operator inline at charter time | **Open — BLOCKING for §13** |
| **D-10** | Make aigentMe engagement observed rather than derived (§0.8), or accept "derived" and label it everywhere it surfaces | Accept `derived` for Phase 1 and label it; upgrade only if §13 needs a hard signal | **Open** |
| **D-11** | Confirm SPEC-CDR-001 owns the §5 gap — both its Domain Resolution layer (what kind of thing is this page) and its Context Resolution layer (what should *this citizen* see here) — and that this SPEC builds neither a second classifier nor a second context composer | Adopt. Also adopt SPEC-CDR-001 §6.2's abstention rule verbatim: abstention is preferable to fabricated context | **Open** |
| **D-12** | **(REWRITTEN 2026-07-25.)** Determine whether the **existing metaMe Runtime Shell guided-tour mechanism can serve as the shared Guided Experience Framework** — adopted, extracted, or adapted — rather than selecting or implementing a new one. The audit is §0.3a; the contract it must satisfy is §9's seven-point framework contract | Adopt reuse-before-replacement (D-22). The implementation satisfies the anchor contract, controlled advancement, and staging discipline today; it lacks declarative definitions, a step-lifecycle seam, and externalised copy. Recommend **extract and extend**, not replace — and require any replacement proposal to name the specific requirement the existing implementation cannot meet | **RESOLVED 2026-07-27** — resolved as **reproduce the contract natively + extend** (D-23 removed the extraction question; §0.3d confirms the contract against the native surface). §8 unblocked |
| **D-13** | Caption/transcript tier: build the `useTTSPlayer` caption seam, or ship voice-primary without captions | **Build it.** A voice-primary guide with no caption tier is inaccessible; it is a build item, not an assumption | **RESOLVED 2026-07-27** — the recommended "build it" is carried into the P4b charter by the operator's "go" (§0.3d); captions are in the runtime's build scope, panel-sized from the start |
| **D-14** | Operator approves the Companion Guide script against the Companion capability set current on its build date (§10) | Adopt as a standing requirement for every guide, not only the first | **Open** |
| **D-15** | Completion percentage: define it over evaluable criteria only, or defer it until D-7/D-9 land | **RATIFIED (operator, 2026-07-26): DEFER.** No percentage until D-7 is ratified *and* D-9 establishes observability for **every** included criterion. Phase 1 uses **explicit lifecycle states**, never a partial or fabricated percentage. (D-7 is now ratified; the remaining condition is D-9's observability.) See §13 | **RATIFIED** |
| **D-16** | "Why it matters" rationale derives from `SubstrateLayer.evidence`, never separately-authored copy (§12) | Adopt | **Open** |
| **D-17** | Whether Threshold Crossing emits a receipt, and whether it is DVN-anchored | If yes: new **action type only**, T2 `personaPublicRef`, no payload/state-machine change | **Open** |
| **D-18** | Confirm Build and Safeguard are Action Modes, not journeys — and that "aigentMe-led" means observer-layer reflection, not a ladder (§14.2) | Adopt (§14.2's reading is read from shipped code) | **Open** |
| **D-19** | May a delegated agent select a journey on the principal's behalf, or is selection human-only? | **RATIFIED (operator, 2026-07-26): recommend-and-prepare, never finalise.** A delegated agent MAY recommend and prepare a journey selection; the principal MUST explicitly confirm it **through the existing authorization spine** before it becomes active. **No agent-finalised journey selection, and no parallel authorization gate.** This is the Principal–Delegate Separation boundary (CFS-043 §2) applied to journey selection. See §14.3a | **RATIFIED** |
| **D-20** | Charter the journey-selection store, write path, `select_journey` tool, migration, and resolver extension (§14.3, five items) | Adopt as a **separate charter**, not a phase of this SPEC. Nothing in §14 is implementable before it lands | **Open — BLOCKING for §14** |
| **D-21** | Adopt the **Constitutional Activation (objective) / Guided Configuration (experiential)** split, with **Threshold Crossed** as the terminal state of both (§1.1, §13) | **RATIFIED (operator, 2026-07-26) — the split is adopted; the "terminal state of both" half is REPLACED.** D-7's supersession removed personalization from the gate, and a layer that gates nothing cannot be half of a terminal state. **Threshold Crossed = Constitutional Activation complete** (the four §13.1 criteria). Guided Configuration becomes an **open-ended post-threshold track with no completion state**. "Declined" stays distinguishable from "completed" — no longer to evaluate the threshold, but to run the post-threshold track honestly. D-8's resolution is unaffected | **RATIFIED** |
| **D-22** | Adopt **reuse before replacement**: the shipped metaMe Runtime Shell tour is the **reference implementation**; it SHALL be audited (§0.3a) before any new tour framework is selected, and any replacement proposal must name the requirement it cannot meet | Adopt (`inv.engineering.037`). The original §0.3 absence claim is withdrawn | **RESOLVED 2026-07-27** — audit complete (§0.3a) + native-surface confirmation complete (§0.3d); the reference stays the read-only contract source, the runtime is built natively (D-23). No replacement framework without naming the requirement this path cannot meet |
| **D-23** | Whether the Guided Experience Framework is **extracted into the main tree**, **kept in the thin client and consumed**, or **re-expressed as a shared package** — the two trees are separate repositories (§0.3a Q1) | **RESOLVED (operator, 2026-07-25): build it natively in the Next.js Edge Companion first**, so the programme carries no dependency on the Lovable thin client. Handoffs between the two surfaces are addressed later, not now. The thin-client implementation remains the **reference** (D-22) — read for its contract and its hard-won staging discipline, not imported | **RATIFIED** |
| **D-24** | Raised by D-7's supersession: D-7 named only *"Passport, Delegation and Agent Me activation"*, while §13 listed six Constitutional Activation criteria. Do **Companion installed / paired** survive? | **RESOLVED (operator, 2026-07-26, via the Companion 1.1 Scope §9).** Threshold Crossing is stated there as `Passport → Delegation → Agent Me Activation → **Companion Pairing** → Threshold Crossed`. **Pairing is RETAINED.** `Companion installed` is not separately listed and is treated as a **precondition of pairing**, not an independent criterion — an inference from the four-step sequence, flagged for cheap correction if separate install tracking is wanted. **Consequence: D-9 remains the long pole**, since pairing state lives in `chrome.storage.local` only | **RATIFIED** |

### 20.1 Explicitly NOT authorised by ratifying this SPEC

- Any code change whatsoever (§19).
- Any agent-authorize path, or any weakening of CFS-043 §2's Principal–Delegate Separation (§4, §14.3).
- Any serialisation of a T0 identifier (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, a cross-persona `fioHandle`) to a browser or a receipt.
- Any DVN payload-shape, state-machine, or `hashPersonaRef` change (§13).
- The specialist programmes themselves (§19).
- A second onboarding-state resolver, a second progressive-activation function, a second MCP server, or a second domain classifier (§2, §11, §15, §5).
- Reporting "Threshold Crossed" while D-7/D-8/D-9/D-10 remain open (§13).
- Selecting, adding, or implementing a new guided-tour framework before the reference implementation has been audited and dispositioned (D-12, D-22, D-23).
- Hand-copying the thin client's tour into the main tree as a second implementation — `inv.engineering.036`/`037` forbids exactly this (D-23).
- Receipting or anchoring Guided Configuration progress (§13.2).

---

## 21. Post-ratification sequencing (indicative only)

Recorded so the first build slice is deliberately narrow. **Not authorised until §20 is resolved**, and each phase is gated on specific decisions.

**2026-07-26 ratification pass — D-2, D-5, D-7, D-15 and D-19 are now closed.** Effects on this table: P1 keeps its no-percentage constraint permanently in Phase 1 (D-15 defers, conditional on D-9); P3's definition question is answered (§6b) though its *evaluability* still waits on D-8/D-9/D-10; P6's host is settled and materially enlarged (§6a); P7's welcome surface is a new universal one (§5a); P8's write path must now carry a prepared/active split (§14.3a).

**D-9 is the critical path.** It alone gates §13 criteria 4–5, the completion percentage (D-15), and P2 — and P3 cannot report a threshold state without it. It is the smallest remaining decision with the largest downstream unblock.

| Phase | Scope | Gated on |
|---|---|---|
| **P0** | Naming resolution only — rename this SPEC's guide concept; register the §16 empirical claims in CFS-051 as `proposed`; register the D-1 invariant candidate | D-1, D-4 |
| **P1** | **Observer surface.** Extend `services/onboarding/substrateState.ts` with stage/prerequisite/rationale fields (same `SubstrateResolution` dial), and give the route its first real consumer. No new resolver. **No completion percentage.** | D-15, D-16 |
| **P2** | **Companion install + pairing observability.** Persist the already-stamped `x-companion-surface` (migration, exact SQL inline to the operator). Makes §13 criteria 4–5 evaluable. | D-9 |
| **P3** | **Threshold definition.** ~~Define "initial configuration complete"~~ — **defined by D-7 (§6b)**; remaining scope is pinning the two build-time definitions (minimum-viable PEQ field set incl. consent; a task signal distinguishing completed from opened), reconciling the delegation criterion, and computing/exposing Threshold Crossing state. Receipt only if D-17 says so. | ~~D-7~~, D-8, D-10, D-17 |
| **P4a** | **Reference-implementation audit** — completed for the five supplied files (§0.3a). Disposition **RESOLVED by D-23: build natively in the Next.js Edge Companion**, no thin-client dependency. Remaining P4a work — the native-surface confirmation of §9's seven-point contract — **COMPLETED 2026-07-27 (§0.3d). P4a CLOSED**; D-12/D-22 resolved. | ~~D-12~~, ~~D-22~~, **D-23 ratified** |
| **P4b** | **Guide runtime, built natively in the Edge Companion.** One runtime + declarative definitions: highlight, stage-the-surface, navigate (`buildCodexUrl`), narrate (`useTTSPlayer` → `/api/skills/tts`), captions, step-lifecycle seam, pause-for-interaction, confirm-completion. The thin client's controlled-advancement + anchor-wait + settle discipline is a **requirement to reproduce**, not code to import (§0.3a). | D-4, D-13, and P4a |
| **P5** | **The Companion Guide** — the first definition on P4b's runtime, script approved against the capability set current on its build date. | D-14, and P4 |
| **P6** | **Stage B in the Companion.** Host §6's modules with `CodexCopilotLayer` mounted as the full-width aigentMe runtime inside the Companion; wallet and aigentMe as toggled peer modes (§6a). Amend CLAUDE.md's Wallet-Over-Cartridge Overlay section in the same change (§6a.4). **§6a.3's orchestration-layer consequences are NOT in this phase** — they are chartered as `SCOPE-MMC-004` (Companion 1.1). | ~~D-5~~ (ratified), D-6, and P2 |
| **P7** | **Entry paths B and C** hardened to the §3 convergence contract, converging on the new universal Threshold Welcome surface (§5a) — re-entrant (begins **or resumes**), composed from existing primitives, handing off to Passport. | ~~D-2~~ (ratified), D-3 |
| **P8** | **Journey selection** — the separate charter of §14.3 (store, write path, `select_journey` tool, migration, resolver extension). Per **D-19 (§14.3a)** the store carries a **prepared → active** split: an agent may reach `prepared`, only the principal reaches `active`, via `requireAuthorizedAgreement`. `select_journey` MAY ONLY PREPARE, canaried like the MoneyPenny authority boundary. | ~~D-19~~ (ratified), D-20 |
| **P9** | **§14 specialist-journey activation gate.** Derived from `journeyRegistry` / `actionModes` / `ARCHETYPE_JOURNEY`, with a parity canary. | P8 complete, D-18 |

**The first code change under this SPEC, when it comes, is exactly this and nothing more:**

```
a substrate-state route with no consumer
    becomes
a substrate-state route with one honest consumer that renders
current stage, completed stages, blocked stages, prerequisites,
and the single next action — and says "not resolvable today"
wherever the platform genuinely cannot see.
```

No new resolver, no new percentage, no new authority mechanism, no new table.

---

## 22. Ratification record

- [x] **AMENDED 2026-07-25** — five operator refinements applied: (1) §0.3's "no guided-tour mechanism exists" claim **withdrawn**, replaced with the reference-implementation framing plus a source audit (§0.3a/§0.3b); (2) capabilities labelled **Existing / Composable / New** in §9; (3) the framework specified by **behavioural contract, not library name** (§9); (4) the **Constitutional Activation / Guided Configuration** split adopted, with **Threshold Crossed** as the terminal state of both (§1.1, §13) — which also resolves D-8 *(the "terminal state of both" half was later replaced when D-21 was confirmed on 2026-07-26; this line records the 2026-07-25 state and is left unedited as history — see §6b.5)*; (5) MoneyPenny retained as a **checkpoint, not a redesign** — no FS surface restructuring enters this SPEC. Three decisions added: D-21, D-22, D-23.
- [ ] **PROPOSED 2026-07-25** — operator's Threshold Crossing Programme specification (seventeen sections plus two in-line amendments), reconciled by Claude Code against SPEC-COS-001, PRD-THR-001, SPEC-MMC-003, SPEC-HMC-001, CFS-043/043a, CFS-050, CFS-051, SPEC-CDR-001, and the shipped platform.
- [ ] Operator resolves the §20 decision register (D-1 … D-23). Nine are marked BLOCKING and gate §4, §6, §8–§10, §13, and §14.
- [x] **CONFIRMED 2026-07-26** — Operator confirms **D-21** (the §1.1 layer split), as amended by D-7's supersession: Threshold Crossed = Constitutional Activation complete alone. Carries the recommended **D-8** resolution: Delegation is a Constitutional Activation criterion, required-when-an-agent-is-bound rather than universally, so a direct human arrival can still cross.
- [x] **D-23 RESOLVED 2026-07-25** — build the Guided Experience Framework **natively in the Next.js Edge Companion first**, so nothing in this programme depends on the Lovable thin client. Handoffs between the two surfaces are deferred, not designed now. The thin-client tour stays the reference implementation (D-22): its step contract and staging discipline are requirements to reproduce, not code to import — which keeps `inv.engineering.036`/`037` satisfied, because the two surfaces are separate products rather than one capability implemented twice.
- [x] **GO 2026-07-27 (operator)** — with D-4 settled (Threshold Guides) and the D-22 audit path ratified, the operator chartered the guides build: P4a closed via the §0.3d native-surface confirmation; **P4b (guide runtime, captions included) is CHARTERED**, D-14 stands as the per-guide script gate at P5. Sequencing: the build queues behind the three priority workstreams in flight (Chrysalis tracker row 100).
- [ ] Operator charters the **journey-selection store** (§14.3 / D-20) as separate work. §14 is not implementable before it.
- [ ] Operator confirms **§17's architectural observation** — the Companion as the constitutional home of the citizen, and the Homecoming reframing — as binding architecture rather than description.
- [ ] Operator confirms the **§16 success criteria** enter CFS-051 as `proposed` (empirical) except criterion 5 (governance rule), per the hypothesis-vs-canon discipline.

---

*Amended docs-only, 2026-07-25 (see §22). The guided-tour findings in §0.3/§0.3a/§0.3b were read from metaMe Runtime Shell source supplied by the operator: `src/components/tour/{WelcomeModal,VisitorTour,TourHelpButton}.tsx`, `src/hooks/use-tour-state.ts`, `src/pages/Index.tsx`. That tree was not searched directly — the claims above describe those five files and nothing beyond them.*

*Authored docs-only, 2026-07-25. Builds nothing. Every existence claim above was verified against source in the main tree: `services/onboarding/substrateState.ts`, `app/api/onboarding/substrate-state/route.ts`, `tests/onboarding-substrate.test.ts`, `services/constitutional/guidedOnboarding.ts`, `services/constitutional/constitutionalAgreement.ts`, `services/threshold/{gateway,journeyRegistry,serviceRegistry,welcome}.ts`, `app/api/threshold/mcp/route.ts`, `services/iqube/{experienceQube,actionModes}.ts`, `types/experienceGuide.ts`, `types/companion.ts`, `services/companion/{overlayMapping,runtime}.ts`, `services/passport/{participationAccess,participationSelfView}.ts`, `extension/companion-observer/*`, `app/(embed)/triad/embed/companion/page.tsx`, `app/api/skills/{tts,stt}/route.ts`, `services/audio/ttsSynthesis.ts`, `app/hooks/useTTSPlayer.ts`, `components/shared/ListenButton.tsx`, `components/ui/MicButton.tsx`, `app/triad/components/codex/AccessionProgressBar.tsx`, `app/invite/[code]/page.tsx`, `supabase/migrations/{20260402000000_experience_model_journey_state,20260815000000_companion_observer_grants}.sql`, and the root plus thirteen workspace `package.json` files. Where something does not exist, this document says so rather than describing it.*
