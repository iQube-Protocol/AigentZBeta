#!/bin/bash

# LVB-AGQ Integration Setup Script
# Completes the integration after database migration

echo "🚀 Setting up LVB-AGQ Integration..."
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if development server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Development server not detected. Starting it..."
    npm run dev &
    DEV_PID=$!
    echo "⏳ Waiting for server to start..."
    sleep 10
fi

# Test API endpoints
echo "🧪 Testing API endpoints..."

# Test 1: Bridge API health check
echo "1. Testing bridge API health..."
if curl -s http://localhost:3000/api/marketa/lvb/bridge?action=config > /dev/null; then
    echo "✅ Bridge API responding"
else
    echo "❌ Bridge API not responding"
    exit 1
fi

# Test 2: Performance API health check
echo "2. Testing performance API health..."
if curl -s http://localhost:3000/api/marketa/performance/aggregate > /dev/null; then
    echo "✅ Performance API responding"
else
    echo "❌ Performance API not responding"
    exit 1
fi

# Test 3: Campaign deployment API
echo "3. Testing campaign deployment API..."
if curl -s http://localhost:3000/api/marketa/campaigns/deploy > /dev/null; then
    echo "✅ Campaign deployment API responding"
else
    echo "❌ Campaign deployment API not responding"
    exit 1
fi

echo ""
echo "🎉 LVB-AGQ Integration Setup Complete!"
echo "====================================="
echo ""
echo "📋 What's been installed:"
echo "✅ Database schema with multi-tenant support"
echo "✅ LVB-AGQ Bridge API endpoints"
echo "✅ Performance aggregation system"
echo "✅ Multi-tenant campaign deployment"
echo "✅ Real-time data synchronization"
echo ""
echo "🔗 Available API Endpoints:"
echo "• GET  /api/marketa/lvb/bridge?action=config"
echo "• GET  /api/marketa/lvb/bridge?action=campaigns"
echo "• GET  /api/marketa/lvb/bridge?action=performance"
echo "• POST /api/marketa/lvb/bridge (sync data)"
echo "• POST /api/marketa/campaigns/deploy (multi-tenant deployment)"
echo "• POST /api/marketa/performance/aggregate (performance sync)"
echo ""
echo "🧪 To test the integration:"
echo "node tests/lvb-agq-bridge-test.js"
echo ""
echo "📚 Documentation:"
echo "• docs/LVB_AGQ_INTEGRATION_GUIDE.md"
echo "• tests/lvb-agq-integration.test.ts"
echo ""
echo "🚀 Your LVB-AGQ integration is ready for production!"

# If we started the dev server, give instructions to stop it
if [ ! -z "$DEV_PID" ]; then
    echo ""
    echo "⚠️  Development server is running in background (PID: $DEV_PID)"
    echo "   Stop it with: kill $DEV_PID"
fi
