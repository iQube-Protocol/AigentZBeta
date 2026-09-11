# Commit Brief: `3853b5f` — Venture iQube Phase A2: commit ExperienceQube hydration on ingest

| Field | Value |
|-------|-------|
| SHA | [`3853b5f`](https://github.com/iQube-Protocol/AigentZBeta/commit/3853b5ff6bbaa11c8b902110ee6279e7d55888ad) |
| Author | Claude |
| Date | 2026-05-31T18:40:44Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Venture iQube Phase A2: commit ExperienceQube hydration on ingest

Operator correctly flagged that Phase A1 was preview-only — the route
validated + computed what WOULD be hydrated but never wrote anything
to ExperienceQube. After ingesting Operation metaWill, the Experience
Model / Strategy / cartridges were still empty and the Brief / Move-
forward / Venture progress CTAs were still generic because the
persona's state hadn't changed.

Phase A2 wires upsertExperienceQube(personaId, …) on the success path
so the ExperienceQube actually updates:
  - meta.experienceName     ← strategy.headline (≤140)
  - meta.primaryGoal        ← strategy.headline (≤200)
  - meta.currentStage       ← stage-map from metaMe ladder
                              (prospect/acolyte→setup,
                               keta/keji→alpha_activation,
                               first/zero→launch)
  - meta.activeCartridges   ← sub-surface-translated union, filtered
                              to VALID_CARTRIDGES (metame, knyt,
                              qriptopian, marketa, avl) by the upsert
  - blak.strategicGoals     ← headline + each venture's northStarKpi
                              (≤10, for Briefs)
  - blak.experienceGoals    ← all objective titles across ventures
                              (≤30, for NBE goalKeyword scoring)
  - blak.confidentialStrategyNotes ← strategy.thesis (T0; LLM-only,
                              never browser-emitted)

Out of scope for A2 (still needs the wizard, on purpose):
  - PersonalGuide 7×7 sphere × maturity lattice (lived state, can't
    be derived from venture strategy)
  - Experience Matrix (depends on PersonalGuide)

Deferred to a later pass — IntentQube row creation per objective. The
preview payload still surfaces the intentQubeQueue so the operator
can see what will be queued; Phase A3 will commit it once we sort
the nbe_plans gating + routing for non-LLM-emitted intents.

Response shape changes: phase now reports 'hydrated' on success
(vs 'preview-only' before) and carries an experienceQube block with
the committed values. UploadDrawer's Ingest button already logs the
full response payload to console; the new fields surface there too.

Failure path: if upsertExperienceQube throws (RLS, network, etc.),
the route returns 500 with the preview payload intact and clearly
labels phase='preview-only' so the operator knows no partial state
landed.
```

## Body

Operator correctly flagged that Phase A1 was preview-only — the route
validated + computed what WOULD be hydrated but never wrote anything
to ExperienceQube. After ingesting Operation metaWill, the Experience
Model / Strategy / cartridges were still empty and the Brief / Move-
forward / Venture progress CTAs were still generic because the
persona's state hadn't changed.

Phase A2 wires upsertExperienceQube(personaId, …) on the success path
so the ExperienceQube actually updates:
  - meta.experienceName     ← strategy.headline (≤140)
  - meta.primaryGoal        ← strategy.headline (≤200)
  - meta.currentStage       ← stage-map from metaMe ladder
                              (prospect/acolyte→setup,
                               keta/keji→alpha_activation,
                               first/zero→launch)
  - meta.activeCartridges   ← sub-surface-translated union, filtered
                              to VALID_CARTRIDGES (metame, knyt,
                              qriptopian, marketa, avl) by the upsert
  - blak.strategicGoals     ← headline + each venture's northStarKpi
                              (≤10, for Briefs)
  - blak.experienceGoals    ← all objective titles across ventures
                              (≤30, for NBE goalKeyword scoring)
  - blak.confidentialStrategyNotes ← strategy.thesis (T0; LLM-only,
                              never browser-emitted)

Out of scope for A2 (still needs the wizard, on purpose):
  - PersonalGuide 7×7 sphere × maturity lattice (lived state, can't
    be derived from venture strategy)
  - Experience Matrix (depends on PersonalGuide)

Deferred to a later pass — IntentQube row creation per objective. The
preview payload still surfaces the intentQubeQueue so the operator
can see what will be queued; Phase A3 will commit it once we sort
the nbe_plans gating + routing for non-LLM-emitted intents.

Response shape changes: phase now reports 'hydrated' on success
(vs 'preview-only' before) and carries an experienceQube block with
the committed values. UploadDrawer's Ingest button already logs the
full response payload to console; the new fields surface there too.

Failure path: if upsertExperienceQube throws (RLS, network, etc.),
the route returns 500 with the preview payload intact and clearly
labels phase='preview-only' so the operator knows no partial state
landed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/persona/venture-iqube/ingest/route.ts` |

## Stats

 1 file changed, 107 insertions(+), 14 deletions(-)
