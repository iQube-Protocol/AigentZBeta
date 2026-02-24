# Multi-Email Identity Controls

## Overview
Provides users agency to merge or segregate personas across multiple email addresses, with fine-grained persona-level access preferences.

## Tables Added
- `crm_auth_profile_emails`: Email aliases per auth profile (normalized, canonical, status)
- `crm_auth_profile_links`: Links between auth profiles with relationship_mode (merged/segregated)
- `crm_persona_access_preferences`: Owner auth profile -> persona access mode (allow/deny)

## API Endpoints

### Email Aliases
- `GET /api/wallet/identity/emails` – List caller’s email aliases
- `POST /api/wallet/identity/emails` – Add/update an email alias (isPrimary flag)
- `DELETE /api/wallet/identity/emails?email=<email>` – Deactivate an email alias

### Auth Profile Links
- `GET /api/wallet/identity/links` – List linked auth profiles and relationship mode
- `POST /api/wallet/identity/links` – Link an auth profile with relationship_mode (merged/segregated)
- `DELETE /api/wallet/identity/links?linkedAuthProfileId=<id>` – Deactivate a link

### Persona Access Preferences
- `GET /api/wallet/identity/preferences` – List persona access preferences for an owner auth profile
- `POST /api/wallet/identity/preferences` – Set access_mode (allow/deny) for a persona
- `DELETE /api/wallet/identity/preferences?personaId=<id>` – Remove a preference

## Persona Visibility Logic
The `/api/wallet/personas` endpoint now:
1. Resolves the caller’s canonical auth profile ID by normalized email
2. Fetches personas from the caller’s auth profile
3. Includes personas from auth profiles linked in merged mode
4. Applies persona-level allow/deny preferences from merged owners

## Helper Functions (multiEmailIdentity.ts)
- `normalizeEmail(email)` – Lowercase and trim email
- `listEmailAliases(authProfileId)` – List active email aliases
- `upsertEmailAlias(authProfileId, email, isPrimary)` – Add/update alias
- `resolveAuthProfileIdByEmail(email)` – Resolve canonical auth profile by email
- `getMergedAuthProfiles(authProfileId)` – Fetch linked auth profiles in merged mode
- `getPersonaAccessPreferences(ownerAuthProfileId)` – Get persona access overrides

## Rollout & Migration
1. Deploy migration `20260220130000_multi_email_identity_controls.sql`
2. Backfill canonical email aliases for existing auth profiles
3. Update persona list APIs to use merged logic
4. Expose email/link/preference management endpoints to UI
5. Educate users on merging vs segregating identities

## Security & Notes
- Email normalization ensures deduplication
- Links and preferences are soft-deleted (active=false)
- Persona visibility always respects tenant scoping and persona grants
- Preferences override defaults: deny hides even merged personas
