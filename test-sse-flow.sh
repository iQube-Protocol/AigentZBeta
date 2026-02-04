#!/bin/bash

# Test SSE + Query flow
SESSION_ID="test_sse_flow_$(date +%s)"

echo "=== Testing SSE Stream + Query Flow ==="
echo "SessionId: $SESSION_ID"
echo ""

# Start SSE stream in background
echo "1. Starting SSE stream..."
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/a2a/agui/stream?sessionId=$SESSION_ID&personaId=guest&device=desktop" 2>&1 | \
  grep -E "event:|data:" | head -20 &
SSE_PID=$!

sleep 2

# Send query
echo ""
echo "2. Sending query..."
curl -s -X POST http://localhost:3000/api/codex/query \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"show me the characters\",\"sessionId\":\"$SESSION_ID\",\"personaId\":\"guest\",\"context\":{\"realm\":\"digiterra\",\"device\":\"desktop\"}}" | python3 -m json.tool

sleep 3

# Kill SSE
kill $SSE_PID 2>/dev/null

echo ""
echo "=== Test Complete ==="
echo "Expected: STATE_SNAPSHOT followed by STATE_DELTA with template and content"
