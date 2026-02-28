# QubeTalk Ready Posts (Convos iOS Workstream)

Channel: `metame-runtime-thinclient`  
Use these as copy/paste payloads in the correct threads.

## 1) `#spec`
```json
{
  "type": "decision",
  "thread": "spec",
  "severity": "info",
  "title": "Convos iOS adoption with canonical envelope",
  "body": "Adopt xmtplabs/convos-ios as transport/core substrate and enforce metame.envelope.v1 as canonical payload for XMTP, QubeTalk, and runtime shell message exchange.",
  "acceptance": [
    "metame.envelope.v1 is used for prompt/action/inference/iqube_ref/system messages",
    "Bridge adapters can parse envelope and fallback to text-only",
    "No ad-hoc runtime payload formats introduced"
  ],
  "refs": {
    "repo": "AigentZBeta",
    "paths": [
      "packages/metame-contracts/src/types/runtimeEnvelope.ts",
      "clawhack-group-agents/schemas/metameEnvelope.ts"
    ],
    "endpoints": [],
    "env": []
  },
  "control": {
    "id": "ios-post-spec-001",
    "supersedes_id": null,
    "depends_on": [],
    "assignee": "aigent_z",
    "status": "open"
  },
  "attestations": {
    "authority": "chatgpt",
    "signature": ""
  }
}
```

## 2) `#dev-exec`
```json
{
  "type": "task",
  "thread": "dev-exec",
  "severity": "blocker",
  "title": "Bootstrap metame-convos-ios fork and target",
  "body": "Fork xmtplabs/convos-ios and add MetaMeRuntimeApp target while preserving ConvosCore and NotificationService for XMTP rails and push handling.",
  "acceptance": [
    "MetaMeRuntimeApp builds on iPhone and iPad simulators",
    "Convos original target still builds in same workspace",
    "Build configs wired for dev/staging/prod"
  ],
  "refs": {
    "repo": "metame-convos-ios",
    "paths": [],
    "endpoints": [],
    "env": [
      "AA_API_BASE_URL",
      "QUBETALK_WS_URL",
      "METAME_TENANT_ID",
      "XMTP_ENV"
    ]
  },
  "control": {
    "id": "ios-post-dev-001",
    "supersedes_id": null,
    "depends_on": [
      "ios-post-spec-001"
    ],
    "assignee": "windsurf_cascade",
    "status": "open"
  },
  "attestations": {
    "authority": "chatgpt",
    "signature": ""
  }
}
```

## 3) `#ui-shell`
```json
{
  "type": "task",
  "thread": "ui-shell",
  "severity": "info",
  "title": "Implement MetaMeMessagingBridge in iOS runtime target",
  "body": "Create iOS bridge layer to map XMTP events to metame.envelope.v1 and route runtime shell actions/prompts through XMTP + QubeTalk surfaces.",
  "acceptance": [
    "Swift envelope codec supports metame.envelope.v1",
    "Prompt send emits envelope",
    "Inbound envelope updates runtime chat/inference state"
  ],
  "refs": {
    "repo": "metame-convos-ios",
    "paths": [],
    "endpoints": [],
    "env": []
  },
  "control": {
    "id": "ios-post-ui-001",
    "supersedes_id": null,
    "depends_on": [
      "ios-post-dev-001"
    ],
    "assignee": "lovable_agent",
    "status": "open"
  },
  "attestations": {
    "authority": "chatgpt",
    "signature": ""
  }
}
```

## 4) `#api-wiring`
```json
{
  "type": "task",
  "thread": "api-wiring",
  "severity": "info",
  "title": "AA API iOS shell-config profile support",
  "body": "Add explicit mobile/tablet profile hints in runtime shell-config for native iOS runtime rendering and trust/selector hydration compatibility.",
  "acceptance": [
    "shell-config includes iOS profile hints",
    "mobile/tablet density/layout are distinguished",
    "web thin client behavior remains unchanged"
  ],
  "refs": {
    "repo": "AigentZBeta",
    "paths": [
      "app/api/aa/v1/runtime/_lib/runtimeShell.ts"
    ],
    "endpoints": [
      "GET /aa/v1/runtime/shell-config"
    ],
    "env": []
  },
  "control": {
    "id": "ios-post-api-001",
    "supersedes_id": null,
    "depends_on": [
      "ios-post-spec-001"
    ],
    "assignee": "aigent_z",
    "status": "open"
  },
  "attestations": {
    "authority": "aigent_z",
    "signature": ""
  }
}
```

