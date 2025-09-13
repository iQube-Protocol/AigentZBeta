# Operators Manual: Minting, Library, and Registry Behavior

## Overview
This manual explains how iQube minting, saving to Library, and Registry visibility work in the Aigent Z Registry UI. It also clarifies what is persisted locally versus on the server, and the difference between Public and Private registry visibility.

## Key Concepts
- **Library (Private)**
  - A client-side convenience state saved in the browser's `localStorage`.
  - Indicates the user has saved a template locally for private use or drafting.
  - Displayed as a `Library (Private)` badge on cards and takes precedence over Registry badges when present.

- **Registry (Public/Private)**
  - A server-side state persisted via Next.js API routes (backed by Supabase).
  - `visibility` field on a template determines if it is publicly visible or private to the owner.

## Where Things Are Saved
- **Local (Browser)**
  - `localStorage` keys:
    - `library_<templateId>`: marks item saved to your private library.
    - `minted_<templateId>`: legacy/local hint that an item has been minted.
    - `owner_minted_<templateId>`: local flag to indicate ownership locally.
    - `active_private_<templateId>`, `active_registry_<templateId>`: local activation hints.
  - Purpose: immediate UI responsiveness without waiting for server roundtrips.

- **Server (Registry)
  - Template records and their fields, including:
    - `visibility`: `public` or `private`.
    - `userId` (where applicable) to associate ownership.
  - Mutations happen through:
    - `POST /api/registry/templates` (create/fork)
    - `PATCH /api/registry/templates/:id` (update/visibility changes)

## Minting Flow
1. User clicks `Mint to Registry` in `IQubeDetailModal`.
2. An application notice (`ConfirmDialog`) opens asking to choose `Public` or `Private`.
3. After confirmation, the UI issues a `PATCH /api/registry/templates/:id` with `visibility` set to the chosen option and (if available) a `userId` from `/api/dev/user`.
4. On success, the UI:
   - Clears `library_<id>` so cards now show Registry badges.
   - Dispatches `registryTemplateUpdated` to refresh the grid.
   - Closes the modal.

## Badge Logic (Cards)
- If `library_<id>` exists in `localStorage`, the card shows `Library (Private)`.
- Else if `visibility === 'public'`, the card shows `Registry (Public)`.
- Else if `visibility === 'private'`, the card shows `Registry (Private)`.
- Else, if legacy local `minted_<id>` exists, it shows `Registry (Public)` as a fallback hint (kept for backward compatibility).

## Mint Button Visibility Rules
- In edit mode: shows the Mint button when `visibility` is not set (i.e., not minted server-side).
- In view mode: shows the Mint button when:
  - The template is not minted server-side (`visibility` not set), and
  - Any of the following are true:
    - Local owner flag (`owner_minted_<id>`) is present, or
    - Server owner matches the current user (when available), or
    - No server owner recorded (legacy), or
    - Item is in the local Library (`library_<id>` present).
- The visibility check is computed client-side in a `useEffect` to avoid SSR hydration mismatches.

## Public vs Private (Implications)
- **Public**
  - Visible to all registry users.
  - Others can view, fork, and mint derived versions.
  - This choice is irreversible; the app notice communicates this clearly.

- **Private**
  - Visible only to the owner on the server-side registry.
  - Can be activated to Public later via PATCH (`visibility: 'public'`).

## Troubleshooting
- **Mint button missing** when the item is in Library:
  - Ensure the template has no `visibility` set server-side; minted items won’t offer Mint.
  - Hard refresh to ensure client-only rules are applied.
- **Hydration errors**:
  - Caused by reading `localStorage` in SSR branches.
  - Resolved by computing visibility in `useEffect` and rendering from state.

## Operational Best Practices
- Prefer server `visibility` as source-of-truth for minted state.
- Use `registryTemplateUpdated` to trigger list refreshes after mutations.
- Keep local flags for immediate UX, but don’t hide server-minted items behind local-only state.

