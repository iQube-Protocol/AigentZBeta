#!/bin/bash

# QubeAgent Development Startup Script
# This script starts both the Python Flask backend and Next.js frontend

echo "🚀 Starting QubeAgent Development Environment"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux is not installed. Please install it with: brew install tmux"
    exit 1
fi

# Create a new tmux session
SESSION_NAME="qubeagent-dev"
tmux new-session -d -s $SESSION_NAME

# Split the window horizontally
tmux split-window -h -t $SESSION_NAME

# Start the Flask backend in the left pane
tmux send-keys -t $SESSION_NAME:0.0 "cd $(pwd) && echo '🔧 Starting Flask Backend...' && python app.py" C-m

# Start the Next.js frontend in the right pane
tmux send-keys -t $SESSION_NAME:0.1 "cd $(pwd) && echo '🌐 Starting Next.js Frontend...' && npm run dev" C-m

# Attach to the tmux session
echo "✅ Development servers starting in tmux session. Attaching..."
echo "📝 Use Ctrl+B then D to detach from the session without stopping the servers."
echo "📝 To reattach later, run: tmux attach -t $SESSION_NAME"
tmux attach -t $SESSION_NAME
