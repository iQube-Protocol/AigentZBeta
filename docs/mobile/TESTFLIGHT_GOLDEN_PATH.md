# TestFlight Golden Path (metaMe Runtime iOS)

## Goal
Ship `MetaMeRuntimeApp` to internal then external TestFlight with deterministic release gates and rollback controls.

## Golden Path Summary
1. Fork + bootstrap `metame-convos-ios`.
2. Add `MetaMeRuntimeApp` target and runtime bridge.
3. Wire AA API + QubeTalk + XMTP envs.
4. Pass CI build/test + signing checks.
5. Archive and upload with Fastlane.
6. Internal TestFlight rollout.
7. External TestFlight rollout.

## Preconditions
- Apple Developer Program active.
- App Store Connect app record created.
- Bundle IDs reserved:
  - `com.metame.runtime`
  - `com.metame.runtime.NotificationService`
- Certificates/profiles valid for all targets.
- App Privacy questionnaire drafted.

## Release Branching
- `main`: stable release branch.
- `release/ios/<version>`: release candidate branch.
- Tag format: `ios-v<major>.<minor>.<patch>`.

## CI/CD Layout
Required workflows:
1. `ios-pr-check.yml`
   - build debug schemes
   - unit tests
   - lint/static checks
2. `ios-release.yml`
   - archive Release-Prod
   - upload to TestFlight
   - publish release notes

## Fastlane Lanes
Create lanes:
- `lane :build_dev`
- `lane :build_release`
- `lane :upload_testflight_internal`
- `lane :upload_testflight_external`

Required secrets:
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `MATCH_PASSWORD` (if using match)

## Gate Checklist
### Gate A: Build Readiness
- App compiles on iOS latest + previous major.
- No critical crashes in startup path.
- Runtime shell loads with hydrated header/menu state.

### Gate B: Messaging Readiness
- XMTP DM and group thread load.
- `metame.envelope.v1` send/receive verified.
- Text fallback verified for non-envelope payload.

### Gate C: Platform Integration
- AA API hydration succeeds in prod-like env.
- QubeTalk channel connectivity stable.
- iQube refs resolve and render.

### Gate D: Operational Readiness
- Push notifications route to correct runtime thread.
- Basic analytics + crash reporting enabled.
- Kill-switch/config rollback path tested.

## Upload Sequence
1. Merge `release/ios/<version>` to `main`.
2. Tag release (`ios-vX.Y.Z`).
3. CI runs `ios-release.yml`.
4. Fastlane uploads build to TestFlight internal group.
5. Smoke test internal build (24h).
6. Promote same build to external testers.

## Smoke Test Matrix
- Devices:
  - iPhone (small + max)
  - iPad (portrait + landscape)
- Scenarios:
  - fresh install + login
  - open runtime + prompt send
  - receive inference
  - open wallet/task/reward actions from chat
  - push -> deep-link -> correct thread/context

## Rollback Plan
- Keep last known-good TestFlight build active.
- If regression found:
  1. Disable rollout for latest build.
  2. Promote previous build notes as current recommended.
  3. Hotfix on `release/ios/<version>-hotfix`.

## Week-by-Week Golden Path
### Week 1
- Fork bootstrap + target creation + CI baseline.

### Week 2
- Runtime shell integration + bridge module.

### Week 3
- AA/QubeTalk/iQube integration + notifications.

### Week 4
- Internal TestFlight + bugfix loop.

### Week 5
- External TestFlight pilot.

## Definition of Done
- TestFlight external build available.
- Core runtime flows pass smoke matrix.
- No Sev-1 crash in 48h pilot window.
- Release checklist signed by product + engineering.

