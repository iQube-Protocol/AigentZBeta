# Makefile for AigentZBeta

SHELL := /bin/bash
PORT ?= 3001
TS := $(shell date +%Y%m%d_%H%M%S)
BACKUP_DIR := backups/$(TS)

.PHONY: help dev build start backup backup-verify restore clean-backups install test lint format clean status wallet-dev aa-dev deploy-qct anchor

help:
	@echo "AigentZ Development Commands:"
	@echo ""
	@echo "Core Development:"
	@echo "  dev              - Start Next.js dev server on PORT=$(PORT)"
	@echo "  build            - Build the Next.js app"
	@echo "  start            - Start Next.js in production mode"
	@echo "  install          - Install all dependencies"
	@echo "  status           - Check system status"
	@echo ""
	@echo "Code Quality:"
	@echo "  test             - Run test suite"
	@echo "  lint             - Run linting"
	@echo "  format           - Format code"
	@echo "  clean            - Clean build artifacts"
	@echo ""
	@echo "Backups:"
	@echo "  backup           - Create timestamped tarball + snapshot under backups/"
	@echo "  backup-verify    - List latest backup contents and tarball head"
	@echo "  restore          - Restore latest backup to restore/<timestamp> and start"
	@echo "  clean-backups    - Remove all local backups (use with care)"
	@echo ""
	@echo "Services:"
	@echo "  wallet-dev       - Start wallet service"
	@echo "  aa-dev           - Start AA service"
	@echo ""
	@echo "Blockchain:"
	@echo "  deploy-qct       - Deploy QCT contracts"
	@echo "  anchor           - Trigger BTC anchor"

## Dev servers

dev:
	PORT=$(PORT) npm run dev

install:
	@echo "📦 Installing dependencies..."
	npm install
	npm run wallet:install
	npm run aa:install

status:
	@echo "🔍 Checking system status..."
	@echo "Node version: $$(node --version)"
	@echo "NPM version: $$(npm --version)"
	@echo "Next.js version: $$(npx next --version)"
	@echo ""
	@echo "Environment variables:"
	@if [ -f .env.local ]; then \
		echo "✅ .env.local exists"; \
	else \
		echo "❌ .env.local missing"; \
	fi
	@echo ""
	@echo "Services status:"
	@curl -s http://localhost:3000/api/health || echo "❌ Main API not responding"

build:
	npm run build

start:
	npm start

## Code Quality

test:
	@echo "🧪 Running test suite..."
	npm run test:ci

lint:
	@echo "🔍 Running linting..."
	npm run lint:check

format:
	@echo "✨ Formatting code..."
	npm run format

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf .next
	rm -rf out
	rm -rf dist
	rm -rf coverage
	rm -rf .nyc_output
	find . -name "*.log" -delete
	find . -name ".DS_Store" -delete

## Services

wallet-dev:
	@echo "👛 Starting wallet service..."
	npm run wallet:dev

aa-dev:
	@echo "🤖 Starting AA service..."
	npm run aa:dev

## Blockchain Operations

deploy-qct:
	@echo "⛓️  Deploying QCT contracts..."
	npm run deploy:qct-erc20
	npm run deploy:qct-spl
	npm run deploy:qct-reserve

anchor:
	@echo "⚓ Triggering BTC anchor..."
	curl -X POST http://localhost:3000/api/ops/btc/anchor

## Backups

backup:
	@mkdir -p $(BACKUP_DIR)/snapshot
	@echo "Creating tarball at $(BACKUP_DIR)/AigentZBeta_full.tar.gz"
	@tar --exclude='./backups' -czf $(BACKUP_DIR)/AigentZBeta_full.tar.gz .
	@echo "Creating snapshot directory mirror"
	@rsync -a --delete --exclude 'backups' ./ $(BACKUP_DIR)/snapshot/
	@echo "Backup complete: $(BACKUP_DIR)"

backup-verify:
	@TS=$$(ls -1 backups | sort | tail -n1); \
	echo "Verifying backups/$$TS"; \
	ls -lah backups/$$TS; \
	echo "--- Tarball head ---"; \
	tar -tzf backups/$$TS/AigentZBeta_full.tar.gz | head -n 40

restore:
	@chmod +x scripts/restore_from_backup.sh || true
	@./scripts/restore_from_backup.sh --install --start --port $(PORT)

clean-backups:
	rm -rf backups/*
