# KNYT Runtime Surface Map v1

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06  
**Intended for:** Codex (runtime feature UI) and Lovable (shell/thin-client)

---

## Ownership split

**Codex owns (runtime feature UI inside iframe / Next.js app):**
- All KNYT Runtime cards
- Patronage and PCS status logic
- Featured moment surface
- Signal action surfaces
- Reward surface
- Next-best-step surface
- Handoff cards
- Progression logic and state rendering
- Runtime interactions

**Lovable owns (shell and thin-client only):**
- Clear entry into KNYT from metaMe or Qriptopian
- Shell/header framing showing user has entered a live cartridge world
- Shell support for opening handoff drawers/panels outside iframe
- Smart menu behavior complementing KNYT actions
- Consistent shell treatment between Qriptopian entry and KNYT Runtime entry

Lovable does NOT own: KNYT cards, state rendering, reward logic, progression logic, PCS logic, runtime feature internals.

---

## Core surface layout

Vertical card stack, mobile-first:

```
┌─────────────────────────────────────────┐
│  A. World Header                        │
├─────────────────────────────────────────┤
│  B. Dual Status Rail                    │
│  [Order Status Card] [Path Status Card] │
├─────────────────────────────────────────┤
│  C. Active Experience / Featured Moment │
├─────────────────────────────────────────┤
│  D. Signal Action Tray                  │
├─────────────────────────────────────────┤
│  E. Reward + Progress Card              │
├─────────────────────────────────────────┤
│  F. Next Best Step Card                 │
├─────────────────────────────────────────┤
│  G. Deepening / Handoff Cards           │
├─────────────────────────────────────────┤
│  H. (Optional) Activity / Memory Feed  │
└─────────────────────────────────────────┘
```

---

## A. World Header

```
┌──────────────────────────────────────┐
│ KNYT                                 │
│ The Order is active                  │
│ [Kn0w1 present badge]                │
└──────────────────────────────────────┘
```

**Props:** title, subtitle, theme (optional), kn0w1_available (boolean)  
**Interactions:** tap title → world overview; tap Kn0w1 badge → Kn0w1 panel

---

## B. Dual Status Rail

```
┌───────────────────┐  ┌───────────────────┐
│ Order Status      │  │ Path Status       │
│ Acolyte           │  │ Collector         │
│ Next: Keta  ────▶ │  │ Next: Curator ──▶ │
└───────────────────┘  └───────────────────┘
```

**Order Status Card props:** patronage_stage, next_patronage_stage, upgrade_eligible (boolean)  
**Path Status Card props:** pcs_stage, next_pcs_stage, unlock_cue (optional)  
**Interactions:** tap either card → opens respective ladder modal/drawer

---

## C. Active Experience / Featured Moment

```
┌──────────────────────────────────────┐
│ Featured Moment                      │
│ "Choose which fragment rises next"   │
│ [image/cover/preview]                │
│ Brief contextual explanation         │
│ [Explore]          [Act now]         │
└──────────────────────────────────────┘
```

**Content types:** content | vote | curate | remix | contribute | stewardship  
**Props:** type, title, description, primary_cta, secondary_cta (optional), media_url (optional)  
**Selection logic:** patronage_stage + pcs_stage + active_matrix + recent_signals + campaign_priority

---

## D. Signal Action Tray

```
┌──────────────────────────────────────┐
│ Shape the world                      │
│  [Vote]  [Like]  [Spark]  [Curate]  │
│  [Remix]         [Contribute]        │
└──────────────────────────────────────┘
```

**Props:** available_actions (list — state-filtered)

**State filter rules:**

| Patronage state | Actions shown |
|-----------------|--------------|
| Outside / Acolyte | Like, Spark, Vote, Patronize |
| Keta / Keji | Vote, Curate, Remix, Endorse/Share |
| First / Zero | Remix, Respond/Correspond, Contribute, Upgrade |
| Satoshi | Contribute, Stewardship, Strategic |

**Events emitted per action:**
- `knyt.vote` — `POST /api/codex/knyt/living-canon/vote`
- `knyt.like` — `POST /api/codex/knyt/living-canon/like`
- `knyt.spark` — `POST /api/codex/knyt/living-canon/spark`
- `knyt.remix` — `POST /api/codex/knyt/living-canon/remix`
- `knyt.curate` — (Phase D)
- `knyt.contribute` — (Phase D+)

Each action: register signal → show lightweight feedback → optionally update Reward card → optionally refresh Next Best Step.

---

## E. Reward + Progress Card

```
┌──────────────────────────────────────┐
│ Reward + Progress                    │
│ You earned $KNYT for curation        │
│ Order: Acolyte → Keta progress  ──▶  │
│ Path:  Collector → Curator      ──▶  │
│ [$KNYT balance preview]              │
└──────────────────────────────────────┘
```

**Props:** latest_reward (optional), reward_reason (optional), progression_impact (optional), balance_preview (optional), reward_axis (order | pcs | both)  
**Interactions:** tap reward line → reward logic drawer; tap balance → KNYT reward detail

---

## F. Next Best Step Card

```
┌──────────────────────────────────────┐
│ Your Next Best Step                  │
│ Cast your first vote                 │
│ This moves you from observer to      │
│ active participant in the Order.     │
│ Unlocks: early Keta progression      │
│          [Do this now]               │
└──────────────────────────────────────┘
```

**Props:** action (string), rationale (string), unlock (optional), supports_axis (order | pcs | both)  
**Interaction:** primary CTA launches relevant next action flow

---

## G. Deepening / Handoff Cards

```
┌──────────────────────────────────────┐
│ Go Deeper                            │
│  [Ask Kn0w1]                         │
│  [See your broader path]             │
│  [Explore builder path]  ← conditional
└──────────────────────────────────────┘
```

**Props:** kn0w1 (boolean), metame (boolean), aigent_c (boolean), marketa (boolean)

| Card | Show condition |
|------|---------------|
| Ask Kn0w1 | Always available |
| See your path in metaMe | Once user has visible progression state |
| Explore builder path (Aigent C) | `contributor_pathway_flag = true` or repeated builder intent |
| Launch/campaign (Marketa) | Onboarding, campaign framing, ecosystem activation |

---

## H. Optional Activity / Memory Feed

```
┌──────────────────────────────────────┐
│ Recent Activity                      │
│ • You sparked "The 21st Fragment"    │
│ • You voted in the Order poll        │
│ • You moved closer to Keta           │
└──────────────────────────────────────┘
```

**Props:** items (list — optional)  
Minimal in alpha.

---

## Runtime states → card priority

| Mode | Who | P0 blocks |
|------|-----|-----------|
| 1 — Entry | Outside the Order | World Header, Featured Moment, Signal Actions, Next Best Step |
| 2 — Initiation | Acolyte / early Keta | Status Rail, Featured Moment, Signal Actions, Reward, Next Best Step, Kn0w1 |
| 3 — Participation | Keta / Keji | Status Rail, Signal Actions, Featured Moment, Reward, Next Best Step |
| 4 — Contribution | First / high-agency | Status Rail, Contribution Moment, Signal Actions, Next Best Step, metaMe + Aigent C |
| 5 — Stewardship | Zero / Satoshi | Status Rail, Stewardship Moment, Reward, Next Best Step, metaMe + Aigent C strategic |

---

## Example screens

### Screen A — Outside the Order (Entry Mode)

```
[World Header]
KNYT — The Order is active

[Featured Moment]
What is the Order?
[Explore the world]  [Join the first circle]

[Signal Actions]
Like | Spark | Vote

[Next Best Step]
Enter as an Acolyte to begin shaping the world
[Do this now]

[Ask Kn0w1]
"What does joining the Order mean?"
```

---

### Screen B — Acolyte / Collector (Initiation Mode)

```
[World Header]

[Status Rail]
Order: Acolyte → Next: Keta    Path: Collector → Next: Curator

[Featured Moment]
Vote on which fragment rises next
[Vote now]

[Signal Actions]
Vote | Like | Spark | Join discussion

[Reward + Progress]
You moved closer to Keta through repeat participation

[Next Best Step]
Cast your first vote to become an active participant
[Do this now]

[Ask Kn0w1]  [See your broader path in metaMe]
```

---

### Screen C — Keta / Curator (Participation Mode)

```
[World Header]

[Status Rail]
Order: Keta → Next: Keji    Path: Curator → Next: Remixer

[Featured Moment]
Curate your first world set
[Start curating]

[Signal Actions]
Vote | Curate | Spark | Remix

[Reward + Progress]
You earned $KNYT for meaningful curation

[Next Best Step]
Curate this thread to begin shaping the Order with your taste
[Curate now]

[Ask Kn0w1]  [See your broader path in metaMe]
```

---

### Screen D — First KNYT / Creator (Contribution Mode)

```
[World Header]

[Status Rail]
Order: First → Next: Zero    Path: Creator → Next: Correspondent

[Featured Moment]
Submit a worldbuilding fragment
[Open submission]

[Signal Actions]
Remix | Correspond | Contribute

[Reward + Progress]
Contribution unlock available

[Next Best Step]
Submit your first world-relevant contribution
[Submit now]

[Ask Kn0w1]  [See your broader path in metaMe]
[Explore builder path with Aigent C]
```

---

### Screen E — Zero / Steward (Stewardship Mode)

```
[World Header]

[Status Rail]
Order: Zero → Next: Satoshi    Path: Steward → Next: Franchise-aligned

[Featured Moment]
Lead a stewardship initiative
[Take stewardship action]

[Reward + Progress]
Stewardship impact recognized

[Next Best Step]
Take on a world-supportive leadership action to deepen your apex path
[Act now]

[See your broader path in metaMe]  [Explore strategic builder path]
```

---

## Data contract (for Codex)

```yaml
knyt_runtime_surface:
  world_header:
    title: string
    subtitle: string
    theme: optional string
    kn0w1_available: boolean

  status:
    patronage_stage: string
    next_patronage_stage: optional string
    pcs_stage: string
    next_pcs_stage: optional string
    active_matrix: string

  featured_moment:
    type: content | vote | curate | remix | contribute | stewardship
    title: string
    description: string
    primary_cta: string
    secondary_cta: optional string

  signal_actions:
    available_actions: list[string]

  reward_progress:
    latest_reward: optional string
    reward_reason: optional string
    progression_impact: optional string
    balance_preview: optional number

  next_best_step:
    action: string
    rationale: string
    unlock: optional string
    supports_axis: order | pcs | both

  handoffs:
    kn0w1: boolean
    metame: boolean
    aigent_c: boolean
    marketa: boolean

  activity_feed:
    items: optional list
```

---

## Alpha acceptance test

The KNYT Runtime surface passes alpha if a user can:

1. Identify the KNYT world
2. See their Order stage or at least their next step
3. See their PCS stage or at least their next growth step
4. Take at least 2–3 meaningful signal actions
5. See that those actions changed something
6. See one visible reward or progress response
7. Understand one clear next-best-step
8. Access Kn0w1 and at least one deeper pathway
