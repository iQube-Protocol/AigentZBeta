#!/bin/bash

# DIDQube Phase 3 Setup Script
# Runs Supabase migration and creates test personas

set -e

echo "🚀 DIDQube Phase 3 Setup"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Display migration instructions
echo -e "${BLUE}Step 1: Supabase Migration${NC}"
echo "----------------------------"
echo ""
echo "📋 Please run the following migration in your Supabase SQL Editor:"
echo ""
echo -e "${YELLOW}File: /Users/hal1/CascadeProjects/QubeBase/supabase/migrations/20251017_didqube_reputation.sql${NC}"
echo ""
echo "This creates:"
echo "  ✓ reputation_bucket table"
echo "  ✓ reputation_evidence table"
echo "  ✓ sync_reputation_from_rqh() function"
echo "  ✓ persona_with_reputation view"
echo "  ✓ RLS policies and indexes"
echo ""
echo "Press ENTER after you've run the migration in Supabase..."
read -r

echo ""
echo -e "${GREEN}✓ Migration assumed complete${NC}"
echo ""

# Step 2: Create test personas
echo -e "${BLUE}Step 2: Creating Test Personas${NC}"
echo "--------------------------------"
echo ""

cd /Users/hal1/CascadeProjects/AigentZBeta

echo "Running test persona creation script..."
npx tsx scripts/create-test-personas.ts

echo ""
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Visit http://localhost:3000/admin/reputation"
echo "  2. Select a persona to view reputation details"
echo "  3. Submit evidence to test the system"
echo ""
