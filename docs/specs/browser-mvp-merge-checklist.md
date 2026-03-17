# Browser MVP Merge Checklist

Use this checklist before merging the browser workstream into `dev`.

## Browser-local verification

- Run `npm run browser:verify`
- Confirm [apps/metame-runtime-shell/app/page.tsx](/Users/hal1/CascadeProjects/AigentZBeta/apps/metame-runtime-shell/app/page.tsx) still typechecks
- Confirm [scripts/browser-smoke.mjs](/Users/hal1/CascadeProjects/AigentZBeta/scripts/browser-smoke.mjs) still passes the AA browser lifecycle smoke

## Workspace verification

- Run root `npm run type-check -- --pretty false`
- Run a clean root build after the Studio boot issue is fixed
- If the root build fails, separate browser-slice failures from unrelated Studio/runtime-preview failures before merging

## Diff review

- Keep browser work confined to:
  - [apps/metame-runtime-shell/app/components/browser](/Users/hal1/CascadeProjects/AigentZBeta/apps/metame-runtime-shell/app/components/browser)
  - [apps/metame-runtime-shell/app/page.tsx](/Users/hal1/CascadeProjects/AigentZBeta/apps/metame-runtime-shell/app/page.tsx)
  - [components/metame/browser/useBrowserCapabilityController.ts](/Users/hal1/CascadeProjects/AigentZBeta/components/metame/browser/useBrowserCapabilityController.ts)
  - [packages/browser-contracts/src/index.ts](/Users/hal1/CascadeProjects/AigentZBeta/packages/browser-contracts/src/index.ts)
  - [packages/aa-client/src/index.ts](/Users/hal1/CascadeProjects/AigentZBeta/packages/aa-client/src/index.ts)
  - [services/aa-api/src/browser](/Users/hal1/CascadeProjects/AigentZBeta/services/aa-api/src/browser)
  - [services/aa-api/src/routes/browser.ts](/Users/hal1/CascadeProjects/AigentZBeta/services/aa-api/src/routes/browser.ts)
- Do not reintroduce browser-hook edits into [components/metame/MetaMeRuntimeClient.tsx](/Users/hal1/CascadeProjects/AigentZBeta/components/metame/MetaMeRuntimeClient.tsx)
- Do not merge unrelated Studio/composer work with the browser branch

## Dist decision

- Decide whether tracked AA-API build outputs should merge:
  - [services/aa-api/dist/browser/estateService.js](/Users/hal1/CascadeProjects/AigentZBeta/services/aa-api/dist/browser/estateService.js)
  - [services/aa-api/dist/browser/sessionService.js](/Users/hal1/CascadeProjects/AigentZBeta/services/aa-api/dist/browser/sessionService.js)
  - [services/aa-api/dist/routes/browser.js](/Users/hal1/CascadeProjects/AigentZBeta/services/aa-api/dist/routes/browser.js)
- If the repo policy is to keep `dist` checked in, rebuild AA-API immediately before merge
- If the repo policy is to avoid generated artifacts in app branches, drop those files before merge

## Final confidence pass

- Run one true local shell -> runtime -> AA-API browser smoke outside the current sandbox if available
- Confirm Lovable has the final browser bridge contract:
  - `browser.drawer.refresh.request`
  - `browser.extract.request`
  - `browser.save.request`
  - `browser.drawer.data`
  - `browser.action.status`
