# Makefile for AigentZBeta

SHELL := /bin/bash
PORT ?= 3001
TS := $(shell date +%Y%m%d_%H%M%S)
BACKUP_DIR := backups/$(TS)

.PHONY: help dev build start backup backup-verify restore clean-backups

help:
	@echo "Targets:"
	@echo "  dev              - Start Next.js dev server on PORT=$(PORT)"
	@echo "  build            - Build the Next.js app"
	@echo "  start            - Start Next.js in production mode"
	@echo "  backup           - Create timestamped tarball + snapshot under backups/"
	@echo "  backup-verify    - List latest backup contents and tarball head"
	@echo "  restore          - Restore latest backup to restore/<timestamp> and start (use vars PORT)"
	@echo "  clean-backups    - Remove all local backups (use with care)"

## Dev servers

dev:
	PORT=$(PORT) npm run dev

build:
	npm run build

start:
	npm start

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
