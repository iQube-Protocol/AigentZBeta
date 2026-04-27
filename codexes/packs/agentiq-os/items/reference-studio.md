# Reference Studio

The AgentiQ OS Reference Studio is the canonical pattern for experience authoring — composing cartridges, ExperienceQubes, and StudioArtifacts.

## Studio vs Runtime

| Studio | Runtime |
|--------|---------|
| Authoring environment | Delivery environment |
| Creates StudioArtifacts | Renders StudioArtifacts |
| Drafts and reviews | Published and live |
| Working state | Canonical state |
| Private (platform layer) | Public (cartridge layer) |

Working state is never canonical state. Artifacts move through the lifecycle:
```
Working → Review → Published → Canonical → Archival
```

## StudioArtifact Schema

Every output from the studio is a `StudioArtifact` — the canonical handoff format between Studio and Runtime:

```typescript
interface StudioArtifact {
  artifact_id: string
  artifact_type: 'cartridge' | 'experience_qube' | 'skill_qube' | 'prompt' | 'content'
  title: string
  description: string
  content: Record<string, unknown>       // The artifact payload
  author_agent: AgentRoleId              // Who created it
  author_root_did: string                // Root DiD — accountability
  status: 'draft' | 'review' | 'published' | 'canonical' | 'archived'
  version: string                        // Semver
  rollback_sha?: string                  // Previous version SHA for rollback
  receipt_eligible: boolean
  created_at: string
  updated_at: string
}
```

## Composing an Experience

### Step 1 — Define the Depth Ladder

```typescript
const experience: ExperienceQube = {
  id: "exp_my_feature",
  title: "My Feature Introduction",
  depths: {
    pill: {
      type: 'static',
      content: "30-second hook — what is this and why should you care?",
      duration_seconds: 30,
    },
    capsule: {
      type: 'interactive',
      component: 'MyFeatureCapsule',
      props: { demoMode: true },
      duration_seconds: 120,
    },
    mini_runtime: {
      type: 'stateful',
      component: 'MyFeatureRuntime',
      props: { personaId: '{{persona_id}}' },
      duration_seconds: 600,
    },
    codex: {
      type: 'cartridge',
      cartridgeId: 'my-cartridge',
      tab: 'start-here',
    },
  },
};
```

### Step 2 — Define the NBE Plan

```typescript
const nbePlan: NBEPlan = {
  plan_id: crypto.randomUUID(),
  persona_id: '{{persona_id}}',
  disposition: 'act',                    // ask | act | wait | escalate | deny
  next_experience: {
    experience_id: 'exp_my_feature',
    target_depth: 'capsule',             // One step at a time
  },
  reasoning: 'User is at acolyte stage with no prior exposure to this feature',
  confidence: 0.85,
};
```

### Step 3 — Publish

```bash
npx agentiq publish --artifact exp_my_feature --trust-band L2_VERIFIED_COMMUNITY
```

This creates a `StudioArtifact` with `status: 'published'` and emits an `artifact_synced` OrchestrationEvent (receipt_eligible: true).

## Rollback Protocol

Every publish stores the previous version SHA. To roll back:

```bash
npx agentiq rollback --artifact exp_my_feature --version 0.1.2
```

This:
1. Reverts `status` to the previous `StudioArtifact`
2. Emits `rollback_triggered` OrchestrationEvent (receipt_eligible: true)
3. Removes the current version from the live runtime within one deploy cycle

## Codex ↔ Studio Sync

Studio artifacts can be promoted directly into a cartridge pack:

```typescript
// Sync published artifact to codex pack
await studioSync.promote({
  artifactId: 'exp_my_feature',
  targetPack: 'my-cartridge',
  targetCollection: 'col_experiences',
});
```

This writes the artifact manifest to `codexes/packs/my-cartridge/items/` and registers it in `collections.json`.

## Controlled Execution Assets

Crown-jewel assets (policy graphs, sensitive prompts, core agent logic) must follow controlled execution rules:

- **Server-side only** — never bundled to the client
- **Encrypted at rest** — stored in DataQube with `disclosure_class: 'sovereign'`
- **Version-pinned** — breaking changes require explicit migration
- **Rollback-capable** — every version stores `rollback_sha`
- **Receipt-anchored** — every change emits a receipt_eligible OrchestrationEvent
