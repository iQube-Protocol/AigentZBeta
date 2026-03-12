# Runtime Identity and CRM Readiness Spec v0.1

## Purpose

This spec defines the minimum identity, ownership, and CRM readiness model required to support:

- Phase 2 ownership and persistence
- Phase 3 deployment of ExperienceQubes into runtime
- Phase 3 MCP deployment
- future audience, commerce, and lifecycle management

The goal is to avoid building generated asset persistence and ExperienceQube ownership on top of an unstable user model.

## 1. Core Principle

The Composer and Studio can generate assets and experiences, but those outputs only become operationally useful when they are attached to a stable runtime identity.

That means we need a minimum identity substrate before deeper Phase 2 persistence is completed.

## 2. Identity Model

### 2.1 Runtime User

The runtime user is the top-level account identity.

Required fields:

- `user_id`
- `account_id`
- authentication provider reference
- tenant relationship
- creation timestamp

### 2.2 Persona

A persona is the active identity used within runtime experiences and should be the main owner-facing context for experience creation and usage.

Required fields:

- `persona_id`
- `user_id`
- display name
- codex/domain affinity
- role or archetype where relevant

### 2.3 Active Persona

At any time, the runtime should be able to identify the user’s active persona.

This active persona should be the default owner/creator binding for:

- generated assets
- ExperienceQubes
- saved drafts
- review actions
- deployment actions

## 3. Ownership Model

### 3.1 ExperienceQube Ownership

Each ExperienceQube should carry:

- `creator_user_id`
- `creator_persona_id`
- `creator_persona_name`
- `origin_template_id`
- `codex_context`

This should be explicit metadata, not inferred indirectly from session state.

### 3.2 Generated Asset Ownership

Each generated asset should carry:

- `asset_id`
- `asset_type` (`image` or `video`)
- `owner_user_id`
- `owner_persona_id`
- `experience_id`
- `provider`
- prompt reference
- orientation where relevant
- receipt reference where available
- stable asset URL or storage path

### 3.3 Session Ownership

Composer sessions should retain:

- `session_id`
- `user_id`
- `persona_id`
- `codex_context`
- `selected_template_id`
- generated asset refs
- resulting experience refs

## 4. Minimum Phase 2 Identity Requirements

Phase 2 does not require a full polished registration and onboarding system, but it does require:

- stable runtime `user_id`
- stable `persona_id`
- active persona resolution
- account-scoped storage target for generated assets
- ability to attach creator metadata to ExperienceQubes

This is the minimum identity substrate.

## 5. Generated Asset Persistence

Generated assets should be saved as durable runtime-owned records rather than transient generation outputs.

### 5.1 Required asset record fields

- `asset_id`
- `type`
- `provider`
- `prompt`
- `orientation`
- `asset_url`
- `storage_path`
- `receipt_ref`
- `user_id`
- `persona_id`
- `experience_id`

### 5.2 Save behavior

When generation succeeds:

1. persist the media asset
2. bind it to the active persona
3. bind it to the relevant ExperienceQube
4. attach receipt references when available

## 6. CRM Readiness Model

CRM should not be treated as a later bolt-on. It should begin as a readiness layer in late Phase 2 and become operational in Phase 3.

### 6.1 CRM Core Entities

Minimum CRM-relevant entities:

- account
- user
- persona
- contact/profile
- ExperienceQube
- generated asset
- receipt/event

### 6.2 CRM-Relevant Events

The following should be representable:

- experience created
- experience edited
- experience deployed
- asset generated
- asset saved
- receipt issued
- runtime unlock
- purchase/payment
- reward completion
- audience engagement event

### 6.3 Persona-to-CRM Mapping

For the roadmap, assume:

- one user may have multiple personas
- CRM may need to operate at both:
  - account/contact level
  - persona/context level

That means persona should not be collapsed into account identity.

## 7. Deployment Touchpoints

### 7.1 Runtime Deployment

When ExperienceQubes are deployed to runtime, they should carry:

- creator persona metadata
- codex context
- generated asset refs
- receipt refs
- CRM/event hooks

### 7.2 MCP Deployment

MCP deployment should also preserve:

- origin experience id
- creator persona id
- deployment target
- receipt lineage
- CRM event linkage where relevant

## 8. Phase Mapping

### Phase 2A: Identity Foundation

- runtime registration/login sanity
- stable user id
- stable persona id
- active persona resolution

### Phase 2B: Ownership and Persistence

- save generated assets to account/persona
- bind receipts
- bind creator metadata to ExperienceQubes
- editable generation persistence

### Phase 2C: CRM Readiness

- CRM entity model
- CRM event hooks
- persona/contact/account mapping

### Phase 3: Deployment and Lifecycle

- deploy ExperienceQubes to runtime
- deploy via MCP
- CRM-integrated lifecycle
- trust-and-cost-aware execution routing

## 9. Recommended Immediate Implementation Order

1. confirm active runtime persona resolution
2. define generated asset record structure
3. define ExperienceQube creator metadata structure
4. persist generated assets + receipts to persona/account scope
5. add CRM event hook stubs

## 10. Design Principle

The Composer can create experiences, but the runtime must know who owns them, who can use them, and how they participate in a broader lifecycle.

Identity makes persistence trustworthy.
CRM makes deployment operational.
