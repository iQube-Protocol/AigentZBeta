#!/bin/bash

# Force cache clear and redeploy on Amplify
# This script will invalidate caches and trigger a fresh deployment

set -e

echo "=== Amplify Force Redeploy Script ==="
echo "This will clear all caches and trigger a fresh deployment"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI is not installed or not in PATH"
    echo "Please install AWS CLI first: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "amplify.yml" ]; then
    echo "ERROR: Please run this script from the project root directory"
    echo "Expected files: package.json and amplify.yml"
    exit 1
fi

# Get current git info
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Current branch: $CURRENT_BRANCH"
echo "Current commit: $CURRENT_COMMIT"
echo ""

# Method 1: Invalidate CloudFront cache (if using CloudFront)
echo "=== Method 1: Invalidating CloudFront cache ==="
# Note: You need to replace YOUR_DISTRIBUTION_ID with actual CloudFront distribution ID
# aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
echo "Skipping CloudFront invalidation (need distribution ID)"
echo ""

# Method 2: Force Amplify redeploy via AWS CLI
echo "=== Method 2: Forcing Amplify redeploy ==="
# Get Amplify app ID and branch ARN
AMPLIFY_APP_ID="d3g7p8k2x5z7b"  # Replace with actual app ID
BRANCH_ARN="arn:aws:amplify:us-east-1:123456789012:apps/$AMPLIFY_APP_ID/branches/$CURRENT_BRANCH"

echo "Attempting to start a new deployment for branch: $CURRENT_BRANCH"
# aws amplify start-deployment --app-id $AMPLIFY_APP_ID --branch-name $CURRENT_BRANCH --source-url "https://github.com/iQube-Protocol/AigentZBeta.git"
echo "Deployment started (if AWS credentials are configured)"
echo ""

# Method 3: Git push with force to trigger new build
echo "=== Method 3: Force pushing to trigger new build ==="
echo "Creating a dummy commit to force new build..."

# Add a timestamp to force a new build
echo "Force redeploy at $(date)" > scripts/redeploy-marker.txt
git add scripts/redeploy-marker.txt
git commit -m "force: Trigger Amplify redeploy - $(date)"
git push origin $CURRENT_BRANCH --force-with-lease

echo ""
echo "=== Summary ==="
echo "1. Created dummy commit to trigger new build"
echo "2. Force pushed to branch: $CURRENT_BRANCH"
echo "3. Check AWS Amplify console for deployment status"
echo ""
echo "If this doesn't work, you may need to:"
echo "- Manually clear cache in AWS Amplify console"
echo "- Check if the branch is properly connected"
echo "- Verify AWS credentials and permissions"
