# KNYT Runtime Surface Spec v1

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

---

## Purpose

Define how the KNYT Cartridge renders inside metaMe Runtime so users can:

- Understand what KNYT is
- See where they are in the KNYT world
- Participate through meaningful signal actions
- Understand their Order and PCS progression
- See visible reward and unlock logic
- Receive next-best-step guidance
- Hand off naturally into deeper contribution pathways

This surface is not a content shelf. It is a live world participation surface.

---

## Core runtime goals

| # | Goal |
|---|------|
| 1 | **Orient** — Explain the world, why it matters, where the user is |
| 2 | **Engage** — Present lightweight and deeper signal actions |
| 3 | **Progress** — Show patronage and PCS movement clearly |
| 4 | **Reward** — Make $KNYT reward logic visible but cartridge-contained |
| 5 | **Guide** — Show next-best actions based on state |
| 6 | **Escalate** — Surface paths from participation to curation, remixing, contribution, stewardship |
| 7 | **Bridge** — Hand off appropriately to metaMe, Kn0w1, and Aigent C |

---

## Surface philosophy

### KNYT is a world, not a page

The Runtime should feel like entering a living world with: status, pathways, meaningful actions, progression, context, memory. Not: static media, article browsing, disconnected buttons.

### Two axes must be visible

At minimum the user should be able to perceive:
- **Patronage / Order state**
- **PCS / Agency state**

These do not need to dominate the UI visually at all times, but they must be legible somewhere in the flow.

### Next-best-pathway logic must be active

The Runtime should not just show options. It should recommend the best next step, why it matters, what it unlocks, and how it supports the user's broader path.

### Signals must feel meaningful

Voting, liking, sparking, remixing, and contribution prompts must feel like world-shaping actions, preference signals, and loyalty indicators — not trivial engagement bait.

---

## Primary surface architecture

Six blocks in vertical card stack (mobile-first):

```
1. World Header
2. Dual Status Rail
3. Active Experience / Featured Moment
4. Signal Action Tray
5. Reward + Progress Card
6. Next-Best-Pathway Card
7. Deepening / Handoff Cards
8. (Optional) Activity / Memory Feed
```

---

## Block definitions

### Block 1 — World Header

**Purpose:** Orient the user instantly.

Contents:
- KNYT mark/title
- World subtitle / current theme
- Optional Kn0w1 presence badge
- Optional "Order active" status cue

Interaction:
- Tap title → opens KNYT world overview
- Tap Kn0w1 badge → opens Kn0w1 handoff panel/chat/drawer

---

### Block 2 — Dual Status Rail

**Purpose:** Show where the user is on both axes.

Two cards side by side:

**Order Status Card:**
- current patronage stage
- next patronage stage
- optional mini progress cue
- optional upgrade eligibility cue

**Path Status Card:**
- current PCS stage
- next PCS stage
- optional "why this matters"
- optional unlock cue

Interaction:
- Tap Order card → opens patronage ladder modal/drawer
- Tap Path card → opens PCS ladder modal/drawer

---

### Block 3 — Active Experience / Featured Moment

**Purpose:** Surface the most relevant current action/content/moment.

Possible content types: featured lore/story, featured comic/motion asset, live vote, collectible prompt, curation opportunity, remix opportunity, community/correspondent opportunity, campaign moment.

**Selection logic:** Based on patronage stage + PCS stage + active matrix + recent signals + current world/campaign priority.

By patronage state:
- Outside the Order / Acolyte: intro to KNYT, "what is the Order?", first collectible/lore
- Keta/Keji: curation activity, remix prompt, community participation
- First/Zero: contributor opportunity, worldbuilding invitation, advanced challenge
- Satoshi: stewardship or franchise-facing surface

---

### Block 4 — Signal Action Tray

**Purpose:** Make world participation active and clear.

Alpha signal actions: Vote · Like · Spark · Curate · Remix · Respond/Correspond · Contribute · Patronize/Upgrade · Endorse/Share

**State-based prominence:**

| Patronage state | Primary actions shown |
|-----------------|----------------------|
| Outside/Acolyte | Like, Spark, Vote, Patronize |
| Keta/Keji | Vote, Curate, Remix, Endorse/Share |
| First/Zero | Remix, Respond/Correspond, Contribute, Upgrade |
| Satoshi | Contribute, Stewardship, Strategic actions |

Actions should be contextual, not always-on clutter. Each action should: register signal, show lightweight feedback, optionally update reward/progress card, optionally refresh Next Best Step.

---

### Block 5 — Reward + Progress Card

**Purpose:** Show that participation matters.

Contents:
- Latest reward or eligibility update
- What action caused it
- Whether it supported Order progression, PCS progression, or both
- Optional $KNYT balance preview
- Optional streak / contribution indicator

This must explain: what happened, why it mattered, what it moved.

Interaction:
- Tap reward line → opens reward logic drawer
- Tap balance → opens KNYT reward detail surface

---

### Block 6 — Next-Best-Pathway Card

**Purpose:** Recommend the next most meaningful action.

Contents:
- One recommended next action
- Why it matters
- What it unlocks
- Whether it advances Order, PCS, or both

**Logic examples by state:**

| State | Recommendation |
|-------|----------------|
| Acolyte + Collector | Cast first vote → move from observer to active participant |
| Keta + Curator | Curate first set → begin shaping the Order with your taste |
| Keji + Remixer | Deepen into creator/correspondent action |
| First + Creator | Submit first world contribution |
| Zero + Steward | Lead or support a high-value world action |

---

### Block 7 — Deepening / Handoff Cards

**Purpose:** Provide clean transitions to the right Aigent or broader path.

| Card | Trigger rule |
|------|-------------|
| Ask Kn0w1 | Always available — world context, lore, participation help |
| See your path in metaMe | Available once user has visible progression state |
| Explore builder path with Aigent C | Only when `contributor_pathway_flag = true` or repeated builder intent |
| Marketa context | Onboarding, campaign framing, ecosystem activation |

---

### Block 8 — (Optional) Activity / Memory Feed

**Purpose:** Show persistence and world continuity.

Contents: recent actions, reward moments, progress changes, contribution milestones, recent world reactions.

Minimal in alpha.

---

## Runtime modes (5)

| Mode | Who | Card priority |
|------|-----|--------------|
| **1 — Entry** | Outside/low-context | World Header, Featured Moment, Signal Actions, Next Best Step |
| **2 — Initiation** | Acolyte / early Keta | Status Rail, Featured Moment, Signal Actions, Reward, Next Best Step, Kn0w1 |
| **3 — Participation** | Keta / Keji | Status Rail, Signal Actions, Featured Moment, Reward, Next Best Step |
| **4 — Contribution** | First / high-agency | Status Rail, Contribution Featured Moment, Signal Actions, Next Best Step, metaMe + Aigent C |
| **5 — Stewardship** | Zero / Satoshi | Status Rail, Stewardship Featured Moment, Reward, Next Best Step, metaMe + Aigent C strategic |

---

## Next-best-step logic formula

Determined by: patronage stage + PCS stage + entry state + trust state + recent signals + active matrix + current world/campaign priority.

---

## Signal prompt rules

- Always present at least one lightweight signal action
- Only present deeper actions when user state suggests readiness
- Use signal prompts to move the user one state forward, not five
- Where possible, explain why the signal matters

Examples:
- "Vote to shape what rises."
- "Spark this to signal what deserves more attention."
- "Curate this to begin shaping the Order with your taste."
- "Remix this to move from audience to maker."

---

## Reward display rules

The Reward Card should show: what was rewarded, why, whether it was participation or contribution, how it fits the KNYT world, what comes next.

Never let $KNYT feel like generic points. It must feel: world-linked, status-relevant, participation-aware, contribution-aware.

---

## User state model

```yaml
knyt_runtime_state:
  patronage_stage: OutsideOrder | Acolyte | Keta | Keji | First | Zero | Satoshi
  pcs_stage: Observer | Collector | Curator | Remixer | Creator | Correspondent | Steward | FranchiseAligned
  entry_state: curious | skeptical | disinterested | exploratory | aligned | committed | distrustful
  trust_state: low | medium | high
  motivation_state: passive | curious | participatory | expressive | contributory | stewardship_oriented
  active_matrix: string
  current_signals: list
  reward_balance: optional
  next_best_step: string
  next_target_patronage_stage: optional
  next_target_pcs_stage: optional
  contributor_pathway_flag: boolean
  stewardship_candidate_flag: boolean
```

---

## Alpha minimum viable surface

Required blocks for alpha:
- World Header
- Dual Status Rail
- Featured Moment
- Signal Action Tray
- Next-Best-Pathway Card
- One Handoff surface
- One Reward surface

---

## Alpha demo sequence

1. User enters KNYT
2. User sees patronage and PCS state
3. User sees featured world moment
4. User performs 2–3 meaningful signal actions
5. User sees reward or eligibility response
6. User sees next-best-step recommendation
7. User sees how KNYT activity could lead toward contribution
8. User sees handoff to metaMe and/or Aigent C

---

## Implementation priority

| Priority | Blocks |
|----------|--------|
| P0 | World Header, Dual Status Rail, Featured Moment, Signal Action Tray, Next Best Step |
| P1 | Reward + Progress, Ask Kn0w1 handoff, metaMe path handoff |
| P2 | Aigent C handoff, Activity feed, deeper stewardship surfaces |

---

## Success criteria

The surface is successful if a user can quickly understand: what KNYT is, where they are, what they can do, why those actions matter, how they are progressing, how rewards work, how to go deeper, how KNYT connects to the larger ecosystem.

---

## Related documents

- `KNYT_EXPERIENCE_PACK_PRD.md` — full strategy, model, matrix families
- `KNYT_MATRIX_SHEET.md` — 5 detailed alpha matrices
- `KNYT_RUNTIME_SURFACE_MAP.md` — wireframe anatomy for Codex and Lovable
