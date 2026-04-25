#!/bin/bash

# Navigate to the project directory
cd /Users/hal1/Desktop/CascadeProjects/iQube-Protocol/Front_Endv2

# Source NVM to ensure correct Node.js version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use a specific Node.js version
nvm use 18

# Install dependencies if not already installed
npm install

# Start the development server
npm run dev -- --host 0.0.0.0 --port 3000
