# Constitutional Capability Brief — metaMe Companion (browser extension)

**Per CFS-049.** Source PRDs: PRD-MMC-001 (metaMe Companion), PRD-MMC-IMPL-001/002/003 (Observer, Overlay, Capture implementation phases), SPEC-MMC-001 (Constitutional Flow). Status: BUILT, live on dev. Owner: Aigent Z workstream.

---

## 1. Executive Summary

metaMe Companion is a browser extension that brings the constitutional runtime into the legacy web. It gives an operator their Smart Wallet, a Universal Search over the constitutional registry and research corpus, a contextual Overlay on supported sites, and a Capture flow ("Pull Across to metaMe") that turns anything on the web into a real constitutional object — an Intent or a Venture — without leaving the page they're on.

## 2. What Was Built

- **Wallet** — the full SmartWalletDrawer (Passport, personas, delegated agents, Q¢ balance) embedded directly in the extension's side panel.
- **Companion** (Timeline) — a read-only feed of the persona's recent constitutional activity, plus the identity chip.
- **Search** — a Universal Search panel over registry assets, research corpus, and (per CFS-049 §7) intended to extend to Capability Briefs themselves.
- **Overlay** — a contextual card that appears for a small, illustrative set of supported domains (GitHub, Coinbase, metaMe's own properties), summarizing what the constitutional runtime knows about the current page.
- **Observer permissions** — a capability-grant system (`current-tab`, `selection`, `page-document`, `downloads`, `clipboard`, `notifications`, `history`), each grantable globally or per-site, managed from a single grant panel.
- **Capture / Workspace** ("Movement I", PRD-MMC-IMPL-003) — right-click any page (or a text selection) → **Pull Across to metaMe**. The capture lands in a Workspace Inbox inside the extension, where it can be turned into a brand-new Intent or Venture, or — as of 2026-07-24 — attached directly to one the persona already has.
- **Persona-correct identity resolution** (2026-07-24 fix) — every server call the extension makes now carries the operator's actual active persona, not a server-side fallback guess. This was the root cause behind Capture and Overlay silently failing for any multi-persona account.

## 3. Why It Exists

Before this, the constitutional runtime only existed inside the metaMe web app itself — anything encountered elsewhere on the web (an article, a GitHub repo, a research paper) had no path into the runtime except manual copy-paste. The Companion collapses that gap: recognize something matters, right-click, and it's already a durable, persona-owned object inside the runtime.

## 4. Where To Find It

```
Chrome/Brave toolbar
  → metaMe Companion icon
    → popup: "Connect to metaMe" (one-time, or after any pull/update) + "Manage" (opens the docked side panel)
      → Side panel, 5 tabs: Wallet | Companion | Search | Overlay | Workspace
Right-click on any webpage → "Pull Across to metaMe" → lands in Workspace
```

## 5. How To Use It

1. Install/update the extension, open a tab on `dev-beta.aigentz.me` and make sure the persona you want active is selected.
2. Click the extension's toolbar icon, then **Connect to metaMe** (with that tab focused/active).
3. Click **Manage** to open the docked side panel.
4. To capture something: go to any other page, right-click, choose **Pull Across to metaMe**. A green checkmark on the toolbar icon confirms success.
5. Open the **Workspace** tab in the side panel — the capture appears in the Inbox. Choose **Bring into new Intent/Venture**, or use the "…or attach to existing" dropdown to land it in something you already have.
6. Manage what the extension is allowed to see/read from the **Companion** tab's permissions panel — every capability can be granted per-site or globally, and revoked at any time.

## 6. Screens

Not embedded in this markdown copy — see the published Artifact version for the side-panel screenshots (Wallet, Workspace Inbox with the existing-object picker, Observer grants panel) captured during this workstream's live testing.

## 7. User Journey

```
Install/update extension → Connect to metaMe (active tab = dev-beta.aigentz.me)
  → Open a real page (e.g. a GitHub repo, an article)
    → Right-click → Pull Across to metaMe → green checkmark
      → Open side panel → Workspace tab → see the capture
        → Attach to an existing Venture, or create a new one
```

## 8. Constitutional Behaviour

- **Observer consent** — every capability read (`page-document`, `selection`, etc.) is gated by a persisted grant; a capture whose source kind requires an ungranted capability is refused both client-side (fast feedback) and server-side (`assertCaptureRespectsGrants`, never trusting the client's claim).
- **Identity tiers** — the extension only ever carries a Bearer token + `x-persona-id` (T1 convention, mirrors `personaFetch`); no T0 identifier (`personaId` as a raw value beyond the header, `authProfileId`, `rootDid`) is ever rendered in extension UI.
- **Persona resolution** — `getActivePersona`'s priority chain (session token → `x-persona-id` header → legacy URL param → "first owned persona" fallback) is why the 2026-07-24 fix mattered: without an explicit hint, any multi-persona account silently resolved the wrong one.
- **Capture constitutionalization** — a capture only becomes a real object (a `companion_captured_objects` row, status `inbox`) via the server-side route; the extension itself never writes to the runtime directly (PRD-MMC-IMPL-003 §0.8's governing invariant).
- **Existing-object attach** — ownership of an `existingId` (an Intent or Venture the picker offers) is re-verified server-side before a capture is bound to it; a spoofed id from a compromised client cannot attach to another persona's object.

## 9. Technical Summary

- Extension: `extension/companion-observer/` (Manifest V3, no bundler) — `background.js` (service worker: connect flow, grant cache, capture/observation POSTs), `content.js` (in-page observation), `popup.js`/`sidepanel.js` (UI shells).
- Embed shell: `app/(embed)/triad/embed/companion/page.tsx` — mounts `SmartWalletDrawer`, `CompanionSearchPanel`, `CompanionOverlayPanel`, `CaptureInboxPanel`, `ObserverGrantPanel`.
- APIs: `app/api/companion/observer/grants` (list/grant), `app/api/companion/observer/observation` (Overlay feed), `app/api/companion/capture` (list/create), `app/api/companion/capture/[id]/assign` (bind to Intent/Venture, new or existing), `app/api/companion/capture/destinations` (existing-object picker list).
- Storage: `companion_captured_objects` (Supabase, RLS-scoped to the owning persona), `companion_observer_grants`.

## 10. Dependencies

Passport / Supabase auth session, an active persona with `currentPersonaId` resolvable in the browser tab's storage, Standing/Wallet (`SmartWalletDrawer`), the Identity & Access Spine (`getActivePersona`).

## 11. New Registry Objects

`companion_captured_objects` rows (status `inbox` → `assigned`), `companion_observer_grants` rows. No new Qube type — assigned captures become ordinary `IntentQubeRecord` (`nbe_plans`) or `VentureQubeRecord` (`venture_qubes`) rows.

## 12. Related Capabilities

Financial Services Capability Suite and MoneyPenny Runtime (both reachable from Ventures a capture can be attached to); the Identity & Access Spine; SmartWalletDrawer.

## 13. Permissions

`current-tab`, `selection`, `page-document`, `downloads`, `clipboard`, `notifications`, `history` — each requested only for the specific Capture source kind that needs it (e.g. a `webpage` capture needs `page-document`; a `pdf` capture needs `downloads`). Granted globally or per-site; revocable any time from the Companion tab.

## 14. Example Use Cases

- **Research**: reading a paper, right-click → Pull Across → attach to the Venture it's relevant to.
- **Founder**: finding a competitor's repo on GitHub, capturing it into a new Intent to review later.
- **Operator**: using Search to locate a registry asset without leaving the current page.

## 15. Limitations

- Overlay's contextual card only maps a small, illustrative set of domains (GitHub, Coinbase, metaMe's own properties) — an unmapped domain correctly shows "no overlay available," not an error.
- Capture only supports two destinations (Intent, Venture) — SPEC-MMC-001 names more (research, workspace, story, ledger, cartridge, canvas) but they are explicit non-goals for this pass.
- No agent-to-agent (MCP/A2A) bridge yet — a third-party AI agent (Claude chat, ChatGPT, etc.) cannot yet drive the Companion on the operator's behalf; that is separate, chartered future work.
- Venture creation via Capture is subject to the same plan-tier venture cap as venture creation anywhere else on the platform.

## 16. Future Roadmap

Companion Search indexing Capability Briefs directly (CFS-049 §7); Movement III (Act) and Movement IV (Project) surfaces already chartered (PRD-MMC-IMPL-004/005); an Agent Bridge (MCP/A2A) for third-party agent onboarding is a separate, larger initiative under active planning.

## 17. Registry Metadata

- Capability ID: `metame-companion`
- Source: PRD-MMC-001, PRD-MMC-IMPL-001/002/003, SPEC-MMC-001
- Version: live on `dev`
- Date: 2026-07-24
- Owner: Aigent Z workstream
- Ratification: RATIFIED
- Deployment: DEPLOYED (dev)

## 18. Completion Receipt

```
Capability: metaMe Companion
[x] Ratified
[x] Implemented
[x] Validated       (live operator testing this session — Capture + Overlay confirmed working end-to-end)
[x] Deployed
[x] Documented       (this Brief)
[ ] Registered       (Registry entry linking to this Brief — pending)
```

## 19. Capability Tour

1. Click the metaMe Companion icon in your browser toolbar.
2. Click **Connect to metaMe** while a `dev-beta.aigentz.me` tab (with your persona active) is focused.
3. Click **Manage** to open the docked side panel.
4. Start in **Wallet** — see your Passport, personas, and Q¢ balance.
5. Switch to **Companion** to see your recent activity timeline and manage Observer permissions.
6. Go to any other webpage, right-click, and choose **Pull Across to metaMe** — watch for the green checkmark.
7. Back in the side panel, open **Workspace** — your capture is sitting in the Inbox.
8. Click **…or attach to existing Venture** and pick one, or click **Bring into new Intent** to start fresh.
9. Use **Search** at any time to find anything in the registry or research corpus without leaving your current page.
