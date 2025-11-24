FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source
COPY . .

# Build TypeScript
RUN npm install typescript @types/node --no-save && npm run build

# Expose port
EXPOSE 8080

# Start app
CMD ["node", "dist/index.js"]
