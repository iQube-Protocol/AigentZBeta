# Aigent Z Beta – Docs Update (Direct Chain Writes & Key Visibility)

This drop updates the architecture and API to:
- Submit **on-chain transactions directly from the API** (EVM contracts, LayerZero, ICP canisters, BTC via ICP dual-lock).
- Provide **global metaQube visibility** (templates and instances) + **blakQube key discovery** (keys/metadata only).

Artifacts:
- `AigentZ_Architecture_UPDATE.md`
- `diagrams/*.mmd` (GitHub-safe Mermaid)
- `openapi_updated.yaml` (v1.1.0-alpha)
- `AigentZ_Updated.postman_collection.json`

How to use:
1) View diagrams in GitHub by copying Mermaid blocks into Markdown, or render locally with mermaid-cli.
2) Mock the API: `npx @stoplight/prism-cli@5 mock openapi_updated.yaml --port 4011`
3) Test with Postman using `AigentZ_Updated.postman_collection.json` (set `baseUrl`).

Last updated: 2025-09-09
