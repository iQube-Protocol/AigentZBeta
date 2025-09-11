#!/bin/bash

# Determine Python executable
PYTHON_CMD=$(command -v python3 || command -v python)

if [ -z "$PYTHON_CMD" ]; then
    echo "Error: Python not found. Please install Python 3."
    exit 1
fi

echo "Using Python executable: $PYTHON_CMD"

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run the web dashboard
echo "Starting QubeAgent Web Dashboard..."
$PYTHON_CMD web_dashboard.py
