#!/bin/bash
# Script to push diagnostic branch to GitHub

cd /Users/hal1/CascadeProjects/AigentZBeta

# Ensure we're on the diagnostic branch
git checkout diagnostic/disable-fallback

# Push to origin
git push -u origin diagnostic/disable-fallback

echo ""
echo "✅ Branch pushed! Create PR at:"
echo "https://github.com/iQube-Protocol/AigentZBeta/pull/new/diagnostic/disable-fallback"
