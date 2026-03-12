# Runtime Identity Phase 2A Checklist v0.1

## Purpose

This checklist translates the Runtime Identity and CRM Readiness spec into a concrete Phase 2A implementation checklist based on the current codebase.

The goal is to confirm what already exists, what is fragmented, and what must be stabilized before deeper Composer ownership and persistence work is completed.

## Current State Summary

The codebase already has the following identity-related pieces:

- Supabase-backed auth/user access
- persona records and persona APIs
- local active persona resolution
- persona-aware policy gates
- CRM routes that already accept `personaId`

However, these are not yet unified into a single stable runtime identity contract for Studio and deployment.

## Observed Current Implementations

### 1. Active persona resolution exists, but is browser-storage driven

Current implementation:

- [app/services/personaService.ts](/Users/hal1/CascadeProjects/AigentZBeta/app/services/personaService.ts)

What exists:

- `getCurrentPersonaId()`
- `setCurrentPersonaId()`
- `resolveCurrentPersona()`
- Supabase-backed `getMyPersonas()`

Current limitation:

- active persona is primarily resolved from local/session storage
- this is not yet guaranteed as a server-visible runtime identity

### 2. Persona storage and wallet persona APIs already exist

Current implementation:

- [services/wallet/personaService.ts](/Users/hal1/CascadeProjects/AigentZBeta/services/wallet/personaService.ts)

What exists:

- persona creation
- persona fetch/update
- auth-profile binding
- wallet persona endpoints

Current limitation:

- this service uses a separate auth-profile/storage pattern that needs alignment with Studio/runtime identity resolution

### 3. Server-side Supabase access exists

Current implementation:

- [app/api/_lib/supabaseServer.ts](/Users/hal1/CascadeProjects/AigentZBeta/app/api/_lib/supabaseServer.ts)

What exists:

- shared server Supabase client factory

Current limitation:

- no unified runtime identity loader is built on top of it yet

### 4. CRM already accepts persona-based events

Current implementation:

- [app/api/marketa/crm/contributions/route.ts](/Users/hal1/CascadeProjects/AigentZBeta/app/api/marketa/crm/contributions/route.ts)

What exists:

- CRM contributions keyed by `personaId`

Current implication:

- CRM can already operate on persona identity
- this is a good base for Phase 2C

## Phase 2A Checklist

### A. Stable runtime identity

- [ ] Define one canonical runtime identity resolver for Studio/runtime use
- [ ] Resolve and return:
  - `user_id`
  - `account_id` if applicable
  - `active_persona_id`
  - `active_persona_name`
  - `tenant_id`
- [ ] Stop relying on ad hoc local storage lookups inside multiple feature areas

### B. Persona resolution contract

- [ ] Decide whether active persona is:
  - browser-selected and synced to server
  - server-resolved from profile/session
  - or a hybrid
- [ ] Expose active persona to Studio session context
- [ ] Expose active persona to generation and ExperienceQube completion paths

### C. Studio identity binding

- [ ] Bind current `user_id` and `persona_id` to Composer session creation
- [ ] Bind current `user_id` and `persona_id` to completed ExperienceQubes
- [ ] Bind current `persona_id` to generated asset records

### D. Runtime account storage target

- [ ] Define where generated assets are saved for a user/persona
- [ ] Confirm whether the storage target is:
  - runtime account scoped
  - persona scoped
  - or both
- [ ] Define how saved asset refs are retrieved in runtime

### E. Metadata contract

- [ ] Standardize ExperienceQube metadata fields:
  - `creator_persona`
  - `codex_context`
  - `generated_assets`
- [ ] Standardize generated asset metadata fields:
  - `provider`
  - `prompt`
  - `orientation`
  - `receipt_ref`
  - `owner_user_id`
  - `owner_persona_id`

### F. Phase 2C CRM readiness hooks

- [ ] Define an event shape for:
  - asset generated
  - asset saved
  - experience created
  - experience deployed
- [ ] Make sure all event shapes accept `personaId`
- [ ] Confirm whether CRM should key off:
  - user/account
  - persona
  - or both

## Gaps to Close Before Full Phase 2 Persistence

These should be treated as blockers or near-blockers for full persistence:

- no single runtime identity resolver yet
- active persona not yet guaranteed server-visible in Studio flows
- no canonical generated asset ownership record yet
- no standardized receipt linkage model for saved generated assets

## Recommended Immediate Next Steps

1. Build a small runtime identity resolver service
2. Expose active persona into Studio/Composer state
3. Standardize ExperienceQube and generated asset metadata
4. Add save-to-persona/account persistence flow
5. Add CRM event hook stubs once persistence is stable

## Readiness Conclusion

The codebase is not starting from zero. The needed ingredients already exist.

Phase 2A is primarily an integration and normalization task:

- unify identity
- stabilize persona resolution
- make ownership explicit
- prepare CRM-facing event shapes

Once that is done, Phase 2B persistence work can proceed with much less risk.
