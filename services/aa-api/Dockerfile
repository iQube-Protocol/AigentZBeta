# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (better cache)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy built dist and needed files
COPY --from=builder /app/dist ./dist
COPY .env.example ./

# The app listens on 8080 internally
EXPOSE 8080

# Start
CMD ["node", "dist/index.js"]
