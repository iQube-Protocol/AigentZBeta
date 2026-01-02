#!/bin/bash
# Quick E2E Test for Referral & Rewards System

API_BASE="${VITE_AIGENT_API_URL:-http://localhost:3000}"
TIMESTAMP=$(date +%s)

echo "========================================="
echo "🧪 E2E Test: Referral & Rewards System"
echo "========================================="

# Test 1: Validate Referrer API
echo -e "\n[TEST 1] Validating referrer API..."
VALIDATE_RESULT=$(curl -s -X POST "$API_BASE/api/referrals/validate" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@knyt"}')
echo "Result: $VALIDATE_RESULT"

# Test 2: Generate Referral Link
echo -e "\n[TEST 2] Generating referral link..."
LINK_RESULT=$(curl -s "$API_BASE/api/referrals/link?personaId=test-123")
echo "Result: $LINK_RESULT"

# Test 3: Social Share Tracking
echo -e "\n[TEST 3] Testing social share tracking..."
SHARE_ID="share_${TIMESTAMP}"
TRACK_RESULT=$(curl -s -X POST "$API_BASE/api/social/track" \
  -H "Content-Type: application/json" \
  -d "{\"shareId\":\"$SHARE_ID\",\"eventType\":\"create\",\"personaId\":\"test-123\",\"contentId\":\"content-1\",\"platform\":\"twitter\"}")
echo "Result: $TRACK_RESULT"

# Test 4: Engagement Tracking
echo -e "\n[TEST 4] Testing engagement tracking..."
ENGAGE_RESULT=$(curl -s -X POST "$API_BASE/api/engagement/track" \
  -H "Content-Type: application/json" \
  -d '{"personaId":"test-123","eventType":"content_complete","contentId":"ep1-article1"}')
echo "Result: $ENGAGE_RESULT"

echo -e "\n========================================="
echo "✅ Tests Complete"
echo "========================================="
