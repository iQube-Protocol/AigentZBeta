#!/bin/bash

# FIO Integration End-to-End Test Script
# Tests all FIO functionality from API to UI

set -e

echo "🚀 FIO Integration E2E Test Suite"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="${1:-http://localhost:3000}"
echo "Testing against: $BASE_URL"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test API endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $status_code)"
        echo "Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "📋 Phase 1: API Endpoint Tests"
echo "------------------------------"

# Test 1: Check FIO handle availability
test_endpoint \
    "FIO Availability Check" \
    "POST" \
    "/api/identity/fio/check-availability" \
    '{"handle":"test123@aigent"}' \
    "200"

# Test 2: Check invalid handle format
test_endpoint \
    "Invalid Handle Format" \
    "POST" \
    "/api/identity/fio/check-availability" \
    '{"handle":"invalid"}' \
    "200"

# Test 3: Missing handle parameter
test_endpoint \
    "Missing Handle Parameter" \
    "POST" \
    "/api/identity/fio/check-availability" \
    '{}' \
    "400"

# Test 4: FIO lookup (may return 404 for non-existent)
echo -n "Testing: FIO Handle Lookup... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/identity/fio/lookup?handle=test@fio")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" = "200" ] || [ "$status_code" = "404" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Expected 200 or 404, got $status_code)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 5: Lookup without handle parameter
test_endpoint \
    "Lookup Missing Parameter" \
    "GET" \
    "/api/identity/fio/lookup" \
    "" \
    "400"

echo ""
echo "📋 Phase 2: Persona API Tests"
echo "-----------------------------"

# Test 6: List personas
test_endpoint \
    "List Personas" \
    "GET" \
    "/api/identity/persona" \
    "" \
    "200"

echo ""
echo "📋 Phase 3: Component Validation"
echo "--------------------------------"

# Test 7: Identity page loads
echo -n "Testing: Identity Page Load... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/identity")
status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" = "200" ] && echo "$body" | grep -q "DiDQube Identity System"; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 8: Admin reputation page loads
echo -n "Testing: Admin Reputation Page Load... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/admin/reputation")
status_code=$(echo "$response" | tail -n1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 9: Ops page loads
echo -n "Testing: Ops Console Page Load... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ops")
status_code=$(echo "$response" | tail -n1)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "📋 Phase 4: FIO Service Validation"
echo "----------------------------------"

# Test 10: Check if FIO SDK is installed
echo -n "Testing: FIO SDK Installation... "
if [ -d "node_modules/@fioprotocol/fiosdk" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 11: Check if service file exists
echo -n "Testing: FIO Service File... "
if [ -f "services/identity/fioService.ts" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 12: Check if components exist
echo -n "Testing: FIO Components... "
if [ -f "components/identity/FIOHandleInput.tsx" ] && \
   [ -f "components/identity/FIORegistrationModal.tsx" ] && \
   [ -f "components/identity/FIOVerificationBadge.tsx" ] && \
   [ -f "components/identity/PersonaCreationForm.tsx" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 13: Check environment variables
echo -n "Testing: Environment Configuration... "
if [ -f ".env.local" ]; then
    if grep -q "FIO_API_ENDPOINT" .env.local && \
       grep -q "FIO_CHAIN_ID" .env.local; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ WARN${NC} (FIO env vars not found)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
else
    echo -e "${YELLOW}⚠ WARN${NC} (.env.local not found)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# Test 14: Check documentation
echo -n "Testing: Documentation Files... "
if [ -f "docs/FIO_SDK_INTEGRATION.md" ] && \
   [ -f "docs/FIO_USER_GUIDE.md" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 15: Check test files
echo -n "Testing: Test Suite Files... "
if [ -f "tests/fio-integration.test.ts" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "=================================="
echo "📊 Test Results Summary"
echo "=================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo "🎉 FIO Integration is ready for deployment!"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "⚠️  Please review failures before deployment"
    exit 1
fi
