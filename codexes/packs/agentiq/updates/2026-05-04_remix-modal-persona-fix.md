# Remix Modal Persona Fix

**Date:** 2026-05-04  
**Branch:** `claude/confirm-aigentz-access-VnNTK`  
**Status:** Shipped to branch, auto-merge to dev pending

---

## Problem

The KNYT cartridge remix modal (`RemixDialog`) was showing the "Sign in to remix" banner even when the user was already authenticated. The sign-in prompt persisted permanently and never resolved.

## Root Cause

`MetaMeRuntimeClient` resolves the active persona via a standalone resolver effect that runs on mount. The resolver checked `nakamoto_knyt_personas` first, then fell back to `localStorage("currentPersonaId")`. Users whose persona was created through the main wallet onboarding flow (not the KNYT-specific signup) are stored in the generic `personas` table — **not** in `nakamoto_knyt_personas`. These users were not found by the resolver, `nakamoto_knyt_personas` returned empty, localStorage was also empty (fresh browser session), and `activePersonaId` stayed `null` permanently.

A secondary problem: even for users whose resolver would eventually succeed, there was no loading state — so the "Sign in" banner flashed on every open while the async resolver was running.

---

## What Changed

### `components/metame/MetaMeRuntimeClient.tsx`

**New `personaResolving` state** — initialized `true`, cleared to `false` when the resolver completes (via `finally`). Passed as a prop to `RuntimeCapsuleRemixEditor`.

**Resolver now has a third lookup step** — after `nakamoto_knyt_personas` fails, calls `/api/wallet/personas` with the Supabase session Bearer token before falling back to localStorage. This is the same resolution chain used by `useSupabaseSessionPersonas`, covering all personas linked via `email → crm_auth_profiles → personas`.

```
Resolution order:
1. PersonaContext / SHELL_READY (sync, immediate) 
2. nakamoto_knyt_personas (KNYT-specific signup)
3. /api/wallet/personas (generic wallet onboarding) ← NEW
4. localStorage("currentPersonaId")
```

When a persona is resolved via step 3, it's also written to localStorage so subsequent visits are instantaneous.

### `components/metame/runtime/RuntimeCapsuleRemixEditor.tsx`

Added optional `personaResolving?: boolean` prop, threaded through to `RemixDialog`.

### `components/metame/runtime/RemixDialog.tsx`

Added `personaResolving?: boolean` prop. While resolving:
- `SignInBanner` is suppressed (replaced with nothing, not even a flash)
- Footer shows "Checking session…" text and a disabled "Loading…" button
- `ComposeView` treats `personaResolving` as equivalent to `hasPersona` (doesn't show the "sign in to see quota" message while checking)

---

## Behaviour After Fix

| User State | Before | After |
|-----------|--------|-------|
| Signed in, persona in nakamoto_knyt_personas | Sign-in banner (if localStorage empty) | Resolves correctly via step 2 |
| Signed in, persona via main wallet flow | Sign-in banner permanently | Resolves correctly via step 3 |
| Signed in, localStorage has persona | Brief flash of sign-in then resolves | No flash — PersonaContext sync is immediate |
| Not signed in | Sign-in banner | Sign-in banner (correct) |

---

## Open Items

- If a user has a Supabase session but genuinely no personas (never onboarded), the sign-in banner correctly shows after resolving. The messaging says "Sign in to remix" but it should say "Create a persona to remix." That UX improvement is a separate follow-on task.
