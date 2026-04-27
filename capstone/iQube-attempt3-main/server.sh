#!/bin/bash

case "$1" in
  start)
    echo "Starting dev server..."
    # Create logs directory if it doesn't exist
    mkdir -p logs
    # Run with output logging instead of nullifying
    nohup npm run dev > logs/dev-server.log 2>&1 &
    echo $! > .dev-server.pid
    echo "Server started! PID saved in .dev-server.pid"
    echo "You can access the server at http://localhost:5174"
    echo "Check logs/dev-server.log for server output"
    ;;
  stop)
    if [ -f .dev-server.pid ]; then
      PID=$(cat .dev-server.pid)
      echo "Stopping dev server (PID: $PID)..."
      kill $PID 2>/dev/null || pkill -f "vite"
      rm .dev-server.pid
      echo "Server stopped!"
    else
      echo "No PID file found. Trying to stop any running vite servers..."
      pkill -f "vite"
    fi
    ;;
  status)
    if pgrep -f "vite" > /dev/null; then
      echo "Dev server is running"
      echo "You can access it at http://localhost:5174"
      echo "Check logs/dev-server.log for server output"
    else
      echo "Dev server is not running"
    fi
    ;;
  logs)
    if [ -f logs/dev-server.log ]; then
      tail -f logs/dev-server.log
    else
      echo "No log file found at logs/dev-server.log"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    exit 1
    ;;
esac
