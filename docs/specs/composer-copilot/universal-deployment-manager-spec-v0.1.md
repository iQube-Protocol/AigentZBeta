# Universal Deployment Manager Spec v0.1

## Purpose

Define a single deployment model that works across:

- Studio preview
- launcher / experience viewer
- metaMe runtime
- metaMe runtime thin client
- MCP app
- Discord
- later XMTP
- later AA API

The system should not be modeled as "Discord deployment with options".
It should be modeled as:

1. choose the right artifact
2. choose the right delivery mode
3. hand that package to a destination adapter

## 1. Core Model

### 1.1 Artifact

The artifact is what is actually being deployed.

Initial artifact classes:

- `generated_image`
- `generated_video`
- `experience_card`
- `runtime_experience`
- `thin_client_runtime`
- `context_image`

Rules:

- `context_image` is fallback only
- generated assets should always win over context imagery when a generated deployment variant is selected
- the same selected artifact should drive:
  - inspector preview
  - deployment payload
  - deployment proof

### 1.2 Delivery Mode

Delivery mode defines how the artifact is consumed.

Initial modes:

- `asset_link`
- `inline_asset`
- `inline_experience`
- `browser_launch`
- `thin_client_handoff`

### 1.3 Destination Adapter

The adapter is where the artifact is sent.

Initial adapters:

- `studio_preview`
- `runtime_launch`
- `mcp_app`
- `discord_mcp`

Later adapters:

- `xmtp`
- `aa_api`

## 2. Inspector and Deployment Proof

The inspector should always display:

- selected artifact type
- preview media chosen for deployment
- delivery mode
- destination adapter
- target URL
- warnings or scaffolded limitations

Deployment proof should persist:

- `artifact_type`
- `artifact_url`
- `preview_media_url`
- `launch_url`
- `delivery_mode`
- `destination_type`
- `destination_adapter`
- `transport_tool`
- `variant`
- `status`
- `warnings`
- `error`
- timestamp

## 3. Variant Mapping

Current coded variants should map into the generic model as follows:

- `asset_link`
  - artifact: generated asset
  - delivery mode: `asset_link`

- `discord_asset_inline`
  - artifact: generated asset
  - delivery mode: `inline_asset`
  - adapter: `discord_mcp`

- `discord_experience_inline`
  - artifact: experience card or runtime experience
  - delivery mode: `inline_experience`
  - adapter: `discord_mcp`
  - current status: scaffolded

- `runtime_thin_client`
  - artifact: runtime experience
  - delivery mode: `thin_client_handoff`
  - adapter: runtime or MCP-distributed runtime handoff

## 4. First Reliability Priorities

### Priority 1

Build a shared artifact resolver.

It must choose:

- latest generated image when image deployment is selected
- latest generated video when video deployment is selected
- only fall back to context imagery when no generated asset exists

### Priority 2

Make inspector preview use the exact artifact chosen by the resolver.

### Priority 3

Make deployment payloads use the same chosen artifact and URL.

### Priority 4

Persist deployment proof so mismatches can be diagnosed later.

## 5. Validation Matrix

The following should be tested explicitly:

1. image -> asset link
2. image -> inline asset
3. image -> runtime thin client
4. video -> asset link
5. video -> inline asset
6. video -> runtime thin client
7. experience card -> inline experience
8. experience card -> runtime thin client

For each case confirm:

- inspector preview matches deployed output
- target URL is correct
- selected generated asset is used
- deployment proof records the same artifact that was deployed

## 6. Exit Criteria

The universal deployment manager is ready enough when:

- artifact selection is explicit
- delivery mode is explicit
- adapter choice is explicit
- Studio and runtime surfaces match deployed output
- deployment proof is reliable across all supported destinations
