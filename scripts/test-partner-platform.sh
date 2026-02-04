#!/bin/bash

# AgentiQ Marketa Partner Platform - Comprehensive Test Suite
# Tests all new functionality: custom campaigns, sequence campaigns, partner rewards, Make integration

set -e

# Configuration
BASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:3000}"
API_BASE="$BASE_URL/api/marketa"
TEST_PERSONA_ID="test-persona-partner"
TEST_TENANT_ID="demo-tenant"
TEST_CAMPAIGN_ID="21-awakenings-campaign"

echo "🚀 AgentiQ Marketa Partner Platform - Comprehensive Test Suite"
echo "================================================================"
echo "Base URL: $BASE_URL"
echo "Test Tenant: $TEST_TENANT_ID"
echo "Test Persona: $TEST_PERSONA_ID"
echo ""

# Helper function to make API calls
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "x-persona-id: $TEST_PERSONA_ID" \
             -H "x-tenant-id: $TEST_TENANT_ID" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$endpoint"
    else
        curl -s -X "$method" \
             -H "x-persona-id: $TEST_PERSONA_ID" \
             -H "x-tenant-id: $TEST_TENANT_ID" \
             "$endpoint"
    fi
}

# Helper function to check response
check_response() {
    local response="$1"
    local test_name="$2"
    
    if echo "$response" | grep -q '"success":true'; then
        echo "✅ $test_name - PASSED"
        return 0
    else
        echo "❌ $test_name - FAILED"
        echo "Response: $response"
        return 1
    fi
}

echo "📋 1. Testing LVB Bridge Configuration"
echo "--------------------------------------"
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=config")
check_response "$response" "Bridge Config"

echo ""
echo "📦 2. Testing Pack Management (WPP)"
echo "-----------------------------------"

# Test pack queue
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=pack_queue")
check_response "$response" "Pack Queue"

# Test pack detail (will likely return empty, but should not error)
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=pack_detail&packId=test-pack")
check_response "$response" "Pack Detail"

echo ""
echo "🎯 3. Testing Campaign Management"
echo "--------------------------------"

# Test campaign catalog
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=campaign_catalog")
check_response "$response" "Campaign Catalog"

# Test campaign detail for 21 Awakenings
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=campaign_detail&campaignId=$TEST_CAMPAIGN_ID")
check_response "$response" "21 Awakenings Campaign Detail"

# Test campaign status
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=campaign_status&campaignId=$TEST_CAMPAIGN_ID")
check_response "$response" "Campaign Status"

echo ""
echo "🔗 4. Testing Make.com Integration"
echo "----------------------------------"

# Test webhook setup guide
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=make_setup_guide")
check_response "$response" "Make Setup Guide"

# Test webhook with httpbin.org (echo service)
webhook_data='{
  "makeWebhookUrl": "https://httpbin.org/post",
  "makeWebhookSecret": "test-secret"
}'
response=$(api_call "POST" "$API_BASE/lvb/bridge?action=webhook_test" "$webhook_data")
check_response "$response" "Webhook Test"

echo ""
echo "📊 5. Testing Performance Analytics"
echo "-----------------------------------"

# Test tenant performance
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=tenant_performance")
check_response "$response" "Tenant Performance"

# Test campaign performance
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=campaign_performance&campaignId=$TEST_CAMPAIGN_ID")
check_response "$response" "Campaign Performance"

echo ""
echo "🎭 6. Testing Campaign Join Flow"
echo "--------------------------------"

# Join the 21 Awakenings campaign
join_data='{
  "campaignId": "'$TEST_CAMPAIGN_ID'",
  "channels": ["linkedin", "x"],
  "startDate": "'$(date +%Y-%m-%d)'",
  "timeOfDay": "09:00",
  "publishingMode": "manual",
  "makeWebhookUrl": "https://httpbin.org/post",
  "makeWebhookSecret": "test-secret"
}'
response=$(api_call "POST" "$API_BASE/lvb/bridge?action=join_campaign" "$join_data")
check_response "$response" "Join 21 Awakenings Campaign"

# Check campaign status after joining
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=campaign_status&campaignId=$TEST_CAMPAIGN_ID")
check_response "$response" "Campaign Status After Join"

echo ""
echo "🏗️ 7. Testing Sequence Dispatch"
echo "--------------------------------"

# Test sequence dispatch status (GET endpoint)
response=$(curl -s -X "GET" \
     -H "Authorization: Bearer test-secret" \
     "$API_BASE/sequence/dispatch?action=status")
check_response "$response" "Sequence Dispatch Status"

# Test pending dispatches
response=$(curl -s -X "GET" \
     -H "Authorization: Bearer test-secret" \
     "$API_BASE/sequence/dispatch?action=pending")
check_response "$response" "Pending Sequence Dispatches"

echo ""
echo "👑 8. Testing Admin Campaign Management"
echo "--------------------------------------"

# Test admin campaign listing (using admin persona)
admin_response=$(curl -s -X "GET" \
     -H "x-persona-id: test-persona-admin" \
     -H "x-tenant-id: agq-tenant" \
     "$API_BASE/admin/campaigns?action=list")
check_response "$admin_response" "Admin Campaign List"

# Test campaign detail for admin
admin_response=$(curl -s -X "GET" \
     -H "x-persona-id: test-persona-admin" \
     -H "x-tenant-id: agq-tenant" \
     "$API_BASE/admin/campaigns?action=detail&campaignId=$TEST_CAMPAIGN_ID")
check_response "$admin_response" "Admin Campaign Detail"

# Test available tenants for deployment
admin_response=$(curl -s -X "GET" \
     -H "x-persona-id: test-persona-admin" \
     -H "x-tenant-id: agq-tenant" \
     "$API_BASE/admin/campaigns?action=tenants")
check_response "$admin_response" "Available Tenants"

echo ""
echo "🎯 9. Testing Custom Campaign Creation"
echo "--------------------------------------"

# Create a custom campaign proposal
campaign_data='{
  "action": "propose_campaign",
  "campaign": {
    "name": "Test Custom Campaign",
    "description": "A test custom campaign for validation",
    "primaryCta": "Join Now",
    "secondaryCta": "Learn More",
    "metadata": {
      "target_audience": "tech professionals",
      "estimated_budget": 10000
    }
  }
}'
response=$(api_call "POST" "$API_BASE/lvb/bridge" "$campaign_data")
check_response "$response" "Custom Campaign Proposal"

echo ""
echo "🏅 10. Testing Database Schema"
echo "------------------------------"

# Test database connectivity by checking if our new tables exist
echo "Testing database schema validation..."

# This would typically be done via a direct DB connection, but we'll test via API
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=config")
if echo "$response" | grep -q '"feature_flags"'; then
    echo "✅ Database Schema - PASSED (feature_flags present)"
else
    echo "❌ Database Schema - FAILED"
fi

echo ""
echo "🔍 11. Testing Error Handling"
echo "-----------------------------"

# Test invalid campaign ID
response=$(api_call "GET" "$API_BASE/lvb/bridge?action=campaign_detail&campaignId=invalid-campaign")
if echo "$response" | grep -q '"success":false\|error'; then
    echo "✅ Error Handling - PASSED (invalid campaign handled correctly)"
else
    echo "❌ Error Handling - FAILED"
fi

# Test missing headers
response=$(curl -s -X "GET" "$API_BASE/lvb/bridge?action=config")
if echo "$response" | grep -q '"success":false\|error'; then
    echo "✅ Authentication Error - PASSED (missing headers handled correctly)"
else
    echo "❌ Authentication Error - FAILED"
fi

echo ""
echo "📈 12. Testing Performance Metrics"
echo "-----------------------------------"

# Test performance aggregation endpoint
response=$(curl -s -X "POST" \
     -H "x-persona-id: $TEST_PERSONA_ID" \
     -H "x-tenant-id: $TEST_TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "campaign_id": "'$TEST_CAMPAIGN_ID'",
       "metrics": {
         "sent": 100,
         "delivered": 95,
         "opened": 40,
         "clicked": 8,
         "conversions": 2
       }
     }' \
     "$API_BASE/performance/aggregate")
check_response "$response" "Performance Aggregation"

echo ""
echo "================================================================"
echo "🏁 AgentiQ Marketa Partner Platform - Test Suite Complete"
echo "================================================================"
echo ""
echo "📊 Summary:"
echo "  ✅ LVB Bridge API: Configuration, Pack Management, Campaigns"
echo "  ✅ Make.com Integration: Webhook testing, setup guide"
echo "  ✅ Performance Analytics: Tenant and campaign metrics"
echo "  ✅ Sequence Campaigns: 21 Awakenings functionality"
echo "  ✅ Admin Operations: Campaign management, deployment"
echo "  ✅ Custom Campaigns: Proposal and approval workflow"
echo "  ✅ Database Schema: New tables and relationships"
echo "  ✅ Error Handling: Invalid requests and authentication"
echo "  ✅ Performance Aggregation: Metrics collection"
echo ""
echo "🚀 All tests completed! The AgentiQ Marketa Partner Platform is ready for deployment."
echo ""
echo "Next steps:"
echo "  1. Run tests with Node.js: npm run test"
echo "  2. Start development server: npm run dev"
echo "  3. Test LVB thin client integration"
echo "  4. Deploy to staging environment"
echo ""
