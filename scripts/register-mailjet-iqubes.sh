#!/usr/bin/env bash
# register-mailjet-iqubes.sh
#
# Registers setup-mailjet-service (SkillQube) and mailjet-service-config (DataQube)
# through the factory pipeline (intake → classify → package → validate → publish).
#
# Prerequisites: dev server running on localhost:3000
# Usage: bash scripts/register-mailjet-iqubes.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:3000

set -euo pipefail

BASE="${1:-http://localhost:3000}"
TENANT="metame"
SUBMITTER="dele-atanda"

echo "=== Registering Mailjet iQubes ==="
echo "Base URL: $BASE"
echo ""

# ─── 1. Register SkillQube via fast-lane endpoint ────────────────────────────

echo "→ Registering setup-mailjet-service (SkillQube)..."

SKILL_RESPONSE=$(curl -s -X POST "$BASE/api/registry/intake/package-skill" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "'"$TENANT"'",
    "submittedBy": "'"$SUBMITTER"'",
    "name": "Setup Mailjet Email Service",
    "description": "End-to-end Mailjet campaign email service setup. Validates credentials, embeds a logo image, creates responsive HTML+text templates from a copy document, sends test emails, and outputs all template IDs as ready-to-paste env vars. Idempotent — safe to re-run to update existing templates.",
    "version": "1.0.0",
    "assetClass": "SkillQube",
    "capabilities": [
      "validate_credentials",
      "embed_logo",
      "create_templates",
      "send_test",
      "output_env_vars"
    ],
    "tags": ["email", "mailjet", "campaign", "templates", "operator-tool", "setup"],
    "steps": [
      { "name": "load_env",         "tool": "python",    "prompt": "Load credentials and config from .env.local" },
      { "name": "validate_creds",   "tool": "http_get",  "prompt": "GET /v3/REST/template to verify credentials and fetch existing template names" },
      { "name": "embed_logo",       "tool": "python",    "prompt": "Read logo file, resize with Pillow (560px max), encode as base64 data URI" },
      { "name": "parse_copy_doc",   "tool": "python",    "prompt": "Parse campaign copy markdown doc to extract subject, preheader, body, and CTA per email" },
      { "name": "create_templates", "tool": "http_post", "prompt": "POST /v3/REST/template for each email in sequence (skip if exists and not --update)" },
      { "name": "set_content",      "tool": "http_post", "prompt": "POST /v3/REST/template/{id}/detailcontent with HTML shell + parsed copy per email" },
      { "name": "send_test",        "tool": "http_post", "prompt": "POST /v3.1/send test email if MAILJET_TEST_EMAIL provided" },
      { "name": "output_ids",       "tool": "stdout",    "prompt": "Print MAILJET_TEMPLATE_{CAMPAIGN}_{N} env var block ready for Amplify" }
    ],
    "interfaceSchema": {
      "inputs": {
        "MAILJET_API_KEY":     { "type": "string", "source": "env", "required": true },
        "MAILJET_SECRET_KEY":  { "type": "string", "source": "env", "required": true },
        "MAILJET_FROM_NAME":   { "type": "string", "source": "env", "required": true },
        "MAILJET_FROM_EMAIL":  { "type": "string", "source": "env", "required": true },
        "MAILJET_LOGO_PATH":   { "type": "string", "source": "env", "required": false, "default": "public/images/metaknyt-logo.png" },
        "MAILJET_CAMPAIGN_ID": { "type": "string", "source": "arg", "required": true },
        "MAILJET_COPY_DOC":    { "type": "string", "source": "arg", "required": true },
        "MAILJET_TEST_EMAIL":  { "type": "string", "source": "arg", "required": false },
        "MAILJET_EMAIL_NUMBER":{ "type": "integer","source": "arg", "required": false },
        "MAILJET_UPDATE":      { "type": "boolean","source": "arg", "required": false, "default": false }
      },
      "outputs": {
        "template_ids":       { "type": "object",  "description": "Map of env var name → Mailjet template ID" },
        "amplify_env_block":  { "type": "string",  "description": "Ready-to-paste block of MAILJET_TEMPLATE_* env vars" },
        "templates_created":  { "type": "integer", "description": "Number of new templates created" },
        "templates_updated":  { "type": "integer", "description": "Number of existing templates updated" }
      }
    }
  }')

echo "SkillQube response:"
echo "$SKILL_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SKILL_RESPONSE"

SKILL_ASSET_ID=$(echo "$SKILL_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('assetId',''))" 2>/dev/null || true)

if [ -n "$SKILL_ASSET_ID" ]; then
  echo ""
  echo "→ Validating SkillQube ($SKILL_ASSET_ID)..."
  curl -s -X POST "$BASE/api/registry/assets/$SKILL_ASSET_ID/validate" \
    -H "Content-Type: application/json" \
    -d '{"tenantId":"'"$TENANT"'"}' | python3 -m json.tool 2>/dev/null

  echo ""
  echo "→ Publishing SkillQube ($SKILL_ASSET_ID)..."
  curl -s -X POST "$BASE/api/registry/assets/$SKILL_ASSET_ID/publish" \
    -H "Content-Type: application/json" \
    -d '{"tenantId":"'"$TENANT"'","submittedBy":"'"$SUBMITTER"'"}' | python3 -m json.tool 2>/dev/null
fi

echo ""
echo "────────────────────────────────────────────────────────────────────────────"
echo ""

# ─── 2. Register DataQube via general intake pipeline ────────────────────────

echo "→ Registering mailjet-service-config (DataQube)..."

INTAKE_RESPONSE=$(curl -s -X POST "$BASE/api/registry/intake" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "'"$TENANT"'",
    "submittedBy": "'"$SUBMITTER"'",
    "sourceType": "manual_bundle",
    "sourcePayload": {
      "name": "Mailjet Email Service Config",
      "description": "Configuration iQube for the Mailjet email service setup skill. Populate with your Mailjet credentials, sender identity, logo path, and campaign copy doc before running /setup-mailjet-service. Template IDs are written back here after creation.",
      "assetClass": "DataQube",
      "version": "1.0.0",
      "tags": ["email", "mailjet", "campaign", "config", "ks-prospects"],
      "capabilities": [],
      "interfaceSchema": {
        "credentials": {
          "MAILJET_API_KEY":    { "type": "string", "required": true, "secret": true },
          "MAILJET_SECRET_KEY": { "type": "string", "required": true, "secret": true }
        },
        "sender_identity": {
          "MAILJET_FROM_NAME":  { "type": "string", "required": true, "example": "Dele Atanda" },
          "MAILJET_FROM_EMAIL": { "type": "string", "required": true, "example": "dele@metaknyt.com" }
        },
        "branding": {
          "MAILJET_LOGO_PATH":  { "type": "string", "required": false, "default": "public/images/metaknyt-logo.png" }
        },
        "campaign": {
          "MAILJET_CAMPAIGN_ID": { "type": "string", "required": true, "example": "ks_prospects" },
          "MAILJET_COPY_DOC":    { "type": "string", "required": true, "example": "docs/alpha/agentiq-knyt/32-ks-backers-email-sequence.md" }
        },
        "template_ids": {
          "description": "Populated automatically by /setup-mailjet-service after template creation"
        }
      }
    }
  }')

echo "Intake response:"
echo "$INTAKE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$INTAKE_RESPONSE"

INTAKE_ID=$(echo "$INTAKE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('intakeId',''))" 2>/dev/null || true)

if [ -n "$INTAKE_ID" ]; then
  echo ""
  echo "→ Intake created: $INTAKE_ID"
  echo "  DataQube will complete packaging via the intake pipeline."
  echo "  Check status at: GET $BASE/api/registry/intake/$INTAKE_ID"
fi

echo ""
echo "=== Done ==="
echo ""
echo "SkillQube asset ID : ${SKILL_ASSET_ID:-<see response above>}"
echo "DataQube intake ID : ${INTAKE_ID:-<see response above>}"
echo ""
echo "After packaging completes, validate and publish the DataQube:"
echo "  curl -s -X POST $BASE/api/registry/assets/<dataqube-asset-id>/validate -H 'Content-Type: application/json' -d '{\"tenantId\":\"$TENANT\"}'"
echo "  curl -s -X POST $BASE/api/registry/assets/<dataqube-asset-id>/publish  -H 'Content-Type: application/json' -d '{\"tenantId\":\"$TENANT\",\"submittedBy\":\"$SUBMITTER\"}'"
