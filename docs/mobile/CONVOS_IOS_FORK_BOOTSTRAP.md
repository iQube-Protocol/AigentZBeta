# Convos iOS Fork Bootstrap (metaMe Runtime)

## Objective
Create and initialize a maintained fork of `xmtplabs/convos-ios` as the native foundation for `MetaMeRuntimeApp`, while preserving upstream mergeability.

## Naming
- Upstream remote: `upstream`
- Fork remote: `origin`
- Default branch: `main`
- Working integration branch: `metame/runtime-ios`

## 1) Fork + Clone
1. Fork `xmtplabs/convos-ios` to your org (GitHub UI).
2. Clone fork locally:
```bash
git clone git@github.com:<your-org>/convos-ios.git metame-convos-ios
cd metame-convos-ios
git remote add upstream git@github.com:xmtplabs/convos-ios.git
git fetch upstream
git checkout -b metame/runtime-ios origin/main
```

## 2) Branch Protection
Apply protections on `main`:
- Require PR review.
- Require passing checks.
- Restrict direct pushes.

## 3) Add metaMe Runtime App Target
In Xcode:
1. Duplicate the main app target to `MetaMeRuntimeApp`.
2. Keep `ConvosCore` and `NotificationService` targets unchanged.
3. Update bundle IDs:
   - `com.metame.runtime`
   - `com.metame.runtime.NotificationService`
4. Add build configurations:
   - `Debug-Dev`
   - `Release-Staging`
   - `Release-Prod`

## 4) Runtime Bridge Module
Create a new Swift module/group:
- `MetaMeMessagingBridge/`
- `MetaMeEnvelope.swift`
- `MetaMeEnvelopeCodec.swift`
- `MetaMeXMTPAdapter.swift`
- `MetaMeQubeTalkAdapter.swift`
- `MetaMeRuntimeStateStore.swift`

Contract:
- Use `metame.envelope.v1` as canonical payload.
- Fallback to text-only parsing if envelope decode fails.

## 5) Config + Secrets
Add `.xcconfig` files (do not commit secrets):
- `Config/RuntimeDev.xcconfig`
- `Config/RuntimeStaging.xcconfig`
- `Config/RuntimeProd.xcconfig`

Required keys:
- `AA_API_BASE_URL`
- `QUBETALK_WS_URL`
- `METAME_TENANT_ID`
- `RUNTIME_DEFAULT_AGENT_ID`
- `XMTP_ENV` (`dev` or `production`)

## 6) CI Pipeline (GitHub Actions)
Add workflow:
- Build + test all schemes.
- Archive `MetaMeRuntimeApp`.
- Export IPA for TestFlight on tagged release.

Required secrets:
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` (if needed by lane setup)

## 7) Upstream Sync Strategy
Weekly:
```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

Then rebase integration:
```bash
git checkout metame/runtime-ios
git rebase main
git push origin metame/runtime-ios --force-with-lease
```

## 8) First Acceptance Milestone
Done when all are true:
1. `MetaMeRuntimeApp` runs on iPhone simulator.
2. App can initialize XMTP client using Convos infrastructure.
3. Runtime shell screen replaces default Convos home view.
4. `metame.envelope.v1` can be sent/received in one test DM/group.

