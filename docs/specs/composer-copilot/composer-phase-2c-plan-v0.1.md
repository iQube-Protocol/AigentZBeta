# Composer Phase 2C Plan v0.1

## Objective

Add the first CRM and lifecycle layer to the Composer/Studio flow so generated media,
experience previews, and launches become trackable user events rather than only local UI actions.

This phase extends the Phase 2A identity foundation and Phase 2B persistence/editability work.

## Scope

### 1. Lifecycle event capture

Record the following events against the active persona and experience:

- `experience_preview`
- `experience_launch`
- `generated_image`
- `generated_video`

These events should be reflected in:

- CRM contribution records
- ExperienceQube lifecycle metadata

### 2. Lifecycle summary on ExperienceQube

Persist lightweight summary fields into ExperienceQube metadata:

- `previewCount`
- `launchCount`
- `generatedImageCount`
- `generatedVideoCount`
- `lastPreviewAt`
- `lastLaunchAt`
- `lastGeneratedAt`
- `lastLifecyclePersonaId`

### 3. Codex-aware lifecycle continuity

Lifecycle hooks should preserve the active codex and persona context already assembled in Phase 2A/2B.

## Initial implementation strategy

### CRM path

Use the existing `/api/crm/contributions` endpoint as the first public event sink.

This is intentionally narrow:

- no new auth surface
- no new event tables
- no parallel CRM pipeline

### Studio/runtime hooks

Hook lifecycle capture into:

- generated asset persistence
- Studio preview open
- Studio launch action

## Out of scope for v0.1

- full CRM audience/contact ingestion
- downstream campaign automation
- deployment-target event propagation
- persona/account-level media library UI
- analytics dashboards

## Exit criteria

Phase 2C v0.1 is successful when:

- generated image/video actions create CRM contribution records
- preview and launch actions create CRM contribution records
- ExperienceQube metadata reflects lifecycle counters and timestamps
- the existing golden paths continue to function without altering user flow
