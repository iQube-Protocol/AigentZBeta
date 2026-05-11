# metaMe Client Protocols — Shared Contract

**Status:** Canonical · introduced 2026-05-12
**Owner:** Identity spine + runtime shell co-owned. Modifications require operator approval (CLAUDE.md identity-spine rules).
**Scope:** Every client-side protocol that establishes a `window`-level singleton, a postMessage event taxonomy, or a cross-frame contract.

---

## Why this doc exists

The metaMe ecosystem is built from many surfaces — tabs, sub-tabs, drawers, chips, capsules, ExperienceQubes, iQube viewers, modals, runtime shells, wallet drawers, agent copilots, third-party embeds. Some run in the host frame; some run in cross-origin frames (Lovable shell, runtime embed, agent copilot iframes). They need to discover state and signal change in a way that is **deterministic, dependable, and consistent across frame boundaries**.

Without a shared contract, every new protocol picks its own event names, its own namespace, its own origin rules — and drift creates the same class of bug ("I'm signed in but it says unauthenticated", "I clicked Open in the wallet but the cartridge didn't switch tabs", "the persona switcher in the shell doesn't update the layer"). This doc fixes that class entirely.

Every metaMe client protocol — present and future — uses **the same prefix**, **the same namespace**, **the same cross-frame rules**, and **the same versioning discipline**.

---

## The three shared primitives

### 1. The `window.__metame` namespace

All protocols expose their non-React, cross-frame-readable state under `window.__metame.*`. One key per protocol, no name collisions.

```ts
// Augmented in types/metameWindow.ts and extended by each protocol module.
interface MetameNamespace {
  persona?: PersonaSpineMirror;          // PersonaSpine
  cartridges?: CartridgePresenceMirror;  // CartridgePresenceRegistry
  // Future protocols register here too:
  // notifications?: NotificationsMirror;
  // receipts?:      ReceiptsStreamMirror;
  // approvals?:     ApprovalsQueueMirror;
  // capsules?:      CapsuleEventsMirror;
}

declare global {
  interface Window {
    __metame?: MetameNamespace;
  }
}
```

Rules:

- **One key per protocol.** No nested grab-bags. `window.__metame.persona`, not `window.__metame.identity.persona.current`.
- **Read-only mirrors.** The in-frame module store is the source of truth. The `window.__metame.*` entry is a read-only mirror for non-React consumers (vanilla JS, other frames via `contentWindow.__metame`, debug consoles). Mutations go through the protocol's own API.
- **Snapshot + subscribe shape.** Every entry exposes the same two-function shape so consumers can interop without knowing protocol internals:
  ```ts
  interface ProtocolMirror<TSnapshot> {
    getSnapshot(): TSnapshot;
    subscribe(listener: () => void): () => void;  // returns unsubscribe
  }
  ```
- **Module-level store remains authoritative.** A protocol's React hook reads from its module-level store, not from `window.__metame`. The mirror exists for *consumers outside the protocol's own React tree*.
- **TypeScript augmentation is the contract.** A new protocol adds its key by augmenting `MetameNamespace` in `types/metameWindow.ts`. Reviewers reject PRs that mutate `window.__metame` without the type augmentation.

### 2. The `metame:*` postMessage event taxonomy

All cross-frame and same-frame protocol events use the `metame:` prefix and a kebab-case verb-or-noun-state:

```
metame:persona-changed
metame:persona-revoked
metame:cartridge-opened
metame:cartridge-closed
metame:cartridge-tab-changed
metame:notification-posted
metame:receipt-finalized
metame:approval-requested
metame:approval-resolved
metame:capsule-mounted
metame:capsule-event
```

Rules:

- **Event names are reserved.** The roster of reserved names lives at the bottom of this doc. Adding a name requires a PR that updates the roster. Two protocols cannot claim the same name.
- **Versioning.** Events do not carry a `-v1` suffix in their name. Schema changes are handled via additive payload fields and explicit `schemaVersion` in the payload when the change is breaking. Hard breaking changes ship a parallel new event name + a deprecation window.
- **Payload shape.** Every event carries:
  ```ts
  {
    type: 'metame:<verb>',
    schemaVersion?: number,  // optional, default 1
    // ...protocol-specific fields...
  }
  ```
- **Deprecation aliases.** When renaming a legacy event into the `metame:*` family, the old name continues to be dispatched **alongside** the new one for one release. Listeners receive both during the deprecation window; only one is consumed. Old name is removed in the release after that.

### 3. The cross-frame rules

When a protocol is mounted in a frame that has a parent (`window.parent !== window`), it must:

1. **Listen for inbound `metame:*` events from `window.parent`** — but only if `event.origin` matches the allowlist (`configs/embed/policy.v1.json::authAllowedOrigins`). All other origins are silently dropped.
2. **Mirror outbound `metame:*` events to `window.parent`** via `postMessage(msg, '*')`. The parent decides whether to act on them, based on its own allowlist.
3. **Mirror outbound events to itself** via `window.postMessage(msg, window.location.origin)` so in-frame subscribers still receive them.
4. **Never trust an inbound event for authoritative state.** Events are *invalidation signals*, not data carriers for sensitive state. PersonaSpine, for example, treats `metame:persona-changed` as "re-fetch the active persona from the server", not "this payload is the new persona".

Rules:

- **Origin enforcement is mandatory.** Every protocol's inbound listener must check `event.origin` against the allowlist. No protocol may rely on payload content alone.
- **No T0 in events.** No `personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, or cross-persona `fioHandle` may ever appear in a `metame:*` event payload. T1 only (`personaSessionToken`, `displayLabel`, `cartridgeFlags`, …) — and most protocols carry no persona content at all (`cartridgeId`, `tab`, `subTab`, etc. is fine because it identifies the surface, not the user).
- **No content payloads.** Events are presence/state signals, not data channels. A `metame:receipt-finalized` event carries the receipt id, not the receipt body. Consumers fetch the body through the protocol's own API.

---

## The protocols (registry)

Each row points to its canonical spec. Protocols may not deviate from the three shared primitives without amending this doc.

| Protocol | Module | Spec doc | Window key | Events |
|---|---|---|---|---|
| **PersonaSpine** | `utils/personaSpine.tsx` | `docs/architecture/persona-spine-client-protocol.md` | `window.__metame.persona` | `metame:persona-changed`, `metame:persona-revoked` |
| **CartridgePresenceRegistry** | TBD by runtime-shell agent | TBD | `window.__metame.cartridges` | `metame:cartridge-opened`, `metame:cartridge-closed`, `metame:cartridge-tab-changed` |

Future protocols (not yet implemented) reserve names below.

---

## Reserved event-name roster

The full reserved roster — adding a name requires a PR amending this doc.

| Event | Protocol | Direction | Payload sketch |
|---|---|---|---|
| `metame:persona-changed` | PersonaSpine | any-frame → any-frame | `{ personaId? }` *(hint only; server is authoritative)* |
| `metame:persona-revoked` | PersonaSpine | any-frame → any-frame | `{}` *(triggers re-fetch / sign-in prompt)* |
| `metame:cartridge-opened` | CartridgePresenceRegistry | layer → shell | `{ cartridgeId, displayLabel }` |
| `metame:cartridge-closed` | CartridgePresenceRegistry | layer ↔ shell | `{ cartridgeId }` |
| `metame:cartridge-tab-changed` | CartridgePresenceRegistry | layer → shell | `{ cartridgeId, tab, subTab? }` |
| `metame:notification-posted` | *(future)* NotificationsBus | any → any | `{ id, severity }` |
| `metame:receipt-finalized` | *(future)* ReceiptsStream | server-push → any | `{ id, action }` |
| `metame:approval-requested` | *(future)* ApprovalsQueue | any → any | `{ id, surfaceHint? }` |
| `metame:approval-resolved` | *(future)* ApprovalsQueue | any → any | `{ id, decision }` |
| `metame:capsule-mounted` | *(future)* CapsuleEvents | layer → shell | `{ capsuleId }` |
| `metame:capsule-event` | *(future)* CapsuleEvents | any → any | `{ capsuleId, name, ... }` |

Deprecated aliases (still dispatched alongside the canonical event for one release; consumers should migrate):

| Deprecated name | Canonical replacement | Removal target |
|---|---|---|
| `aa-persona-change-v1` | `metame:persona-changed` | release after 2026-05-12 |

---

## Reserved `window.__metame.*` keys

| Key | Owner |
|---|---|
| `persona` | PersonaSpine |
| `cartridges` | CartridgePresenceRegistry |
| `notifications` | *(reserved — future)* |
| `receipts` | *(reserved — future)* |
| `approvals` | *(reserved — future)* |
| `capsules` | *(reserved — future)* |

Adding a key requires a PR amending this doc + the `MetameNamespace` augmentation in `types/metameWindow.ts`.

---

## Adoption rules for new protocols

When you propose a new metaMe client-side protocol:

1. **Pick a name + window key + event prefix** and reserve them in this doc via PR.
2. **Augment `types/metameWindow.ts`** with the new namespace key (typed `ProtocolMirror<TSnapshot>` shape).
3. **Implement** with: a module-level store, a React hook, a `<...Gate>` component if loading/error states are user-visible, an imperative reader for non-React contexts, and a fetch helper if the protocol does I/O.
4. **Honor the three shared primitives** — `metame:*` event prefix, `window.__metame.<key>` mirror, cross-frame parity with origin allowlist.
5. **Privacy** — no T0 in any event payload or window mirror. T1 only, and only when the protocol genuinely needs persona context (most don't).
6. **Spec doc** in `docs/architecture/<protocol-name>.md` linked from this doc.
7. **Migration sweep plan** — one PR per existing surface that the new protocol replaces.

If a protocol cannot honor a shared primitive, **don't bypass it** — amend this doc, with operator approval.

---

## Versioning + deprecation discipline

- The shared contract (this doc) is version-zero. The first amendment that breaks compatibility bumps it to v1.
- Individual protocols version their *payload schemas* via `schemaVersion` on the event, additive fields by default.
- Deprecated event names and window keys are kept dispatched/exported alongside their canonical replacements for **one full release** before removal. The deprecation window appears in the roster table above.
- A consumer reading from the deprecated form must log a `console.warn` once per page load so the migration sweep can be tracked.

---

## Privacy boundaries (recap)

This is the second time the same rule appears in this doc because it is the most violated boundary in client-side ecosystems and deserves repetition:

- **T0 never leaves the server.** No `personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, or cross-persona `fioHandle` in any event payload, window mirror, console log, or analytics event.
- **T1 is the surface contract.** `personaSessionToken`, `displayLabel`, `identifiability`, `cartridgeFlags`, `cohortMemberships`, `sessionExpiresAt`. Per `types/access.ts`.
- **T2 is for chain receipts only.** Cohort alias commitments do not appear in client-side events — they exist only in DVN receipts.

Most metaMe client protocols carry **no persona content at all** — they signal presence (`cartridgeId`, `tab`), state changes (`receiptId`, `approvalId`), or invalidation triggers. The persona resolution stays in PersonaSpine; everyone else composes against it.

---

## Files

| File | Role |
|---|---|
| `docs/architecture/metame-client-protocols.md` | This doc — parent contract |
| `types/metameWindow.ts` | TypeScript augmentation of `Window['__metame']` |
| `docs/architecture/persona-spine-client-protocol.md` | PersonaSpine spec |
| `utils/personaSpine.tsx` | PersonaSpine implementation |
| *(TBD)* | CartridgePresenceRegistry implementation + spec |
| `configs/embed/policy.v1.json` | `authAllowedOrigins` — the origin allowlist for cross-frame events |
| `types/access.ts` | T0 / T1 / T2 privacy contract types |

---

## Coordination history

- **2026-05-11** — PersonaSpine drafted with same-frame `aa-persona-change-v1` event and no `window.__metame` mirror.
- **2026-05-12** — runtime-shell agent surfaces the CartridgePresenceRegistry need (wallet → cartridge tab opening across frame boundaries). Adjacency identified; parent contract drafted (this doc). PersonaSpine aligned in the same PR (`metame:persona-changed`, deprecated alias, window mirror, cross-frame broadcast, origin enforcement).
- **TBD** — CartridgePresenceRegistry lands, registers `window.__metame.cartridges` and `metame:cartridge-*` events per this doc.

Future amendments append entries here.
