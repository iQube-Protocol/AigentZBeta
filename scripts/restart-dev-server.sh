#!/bin/bash

echo "🔄 Restarting Next.js Dev Server..."
echo ""

# Kill any process on port 3000
echo "Stopping existing server..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No existing server found"

# Wait a moment
sleep 2

# Start the dev server
echo ""
echo "Starting dev server..."
echo "✅ Server will start on http://localhost:3000"
echo ""
echo "Once server is running, test with:"
echo "  curl http://localhost:3000/api/admin/debug/check-env"
echo ""

npm run dev
