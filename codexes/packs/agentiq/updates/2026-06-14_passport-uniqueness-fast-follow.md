# Passport Uniqueness — Fast-Follow Backlog

**Date:** 2026-06-14
**Status:** Backlog — deferred from Sprint 8 hackathon
**Priority:** High (identity integrity)

## Design Decision

Citizens must have exactly one active Citizen Passport per Kybe DID. The current flow allows submitting multiple Citizen Passport applications even when a Kybe DID already exists and a Citizen Passport is already bound to it. This needs guardrails.

## Rules to Implement

### 1. One active Citizen Passport per Kybe DID

- When a user with an existing Kybe DID applies for a Citizen Passport, the server must check whether a Citizen Passport already exists under that Kybe DID.
- If one exists: block the duplicate Citizen application. Surface a clear message: "You already have a Citizen Passport under this identity."

### 2. Repeat applications auto-convert to Participant class

- If a Citizen Passport already exists and the user starts a new application flow, auto-convert it to a Participant Passport application.
- The Participant Passport can then be assigned to an agent via bounded delegation.
- UX: show a banner on the Apply tab: "You already hold a Citizen Passport. New applications will be issued as Participant Passports, which you can assign to an agent."

### 3. One active root DID per Kybe DID at a time

- A citizen can create additional root DIDs (for agents, via bounded delegation), but only one root DID may be active against their Kybe DID at a time.
- Creating a new root DID deactivates the previous one (or requires explicit deactivation first).

## Touch Points

- `POST /api/polity-passport/submit` — add Kybe DID uniqueness check before accepting Citizen applications
- `POST /api/passport/applications/submit` — same check
- `PassportBureauApplyTab.tsx` — client-side: detect existing Citizen Passport early (via wallet endpoint) and auto-switch to Participant flow
- `services/passport/` — server-side uniqueness enforcement

## Current Behavior (as of 2026-06-14)

- The flow correctly detects an existing Kybe DID and says it will bind to the pre-existing one
- The submit button is not blocked — a user can submit a duplicate Citizen Passport application
- No server-side uniqueness check prevents the duplicate from being created

## Operator Note

This was identified during the Sprint 8 hackathon. The flow works end-to-end but lacks the uniqueness guardrail. Deferred to avoid scope creep during the hackathon push.
