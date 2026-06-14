# Commit Brief: `db509a3` — add /api/ens/ccip-read/health diagnostic endpoint

| Field | Value |
|-------|-------|
| SHA | [`db509a3`](https://github.com/iQube-Protocol/AigentZBeta/commit/db509a301c14e2ea6d5fbc6d4436744ea4d201ae) |
| Author | Claude |
| Date | 2026-06-14T00:39:03Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add /api/ens/ccip-read/health diagnostic endpoint

operator can sanity-check the signing pipeline before spending sepolia
gas on the resolver contract deploy. returns:

- issuer_address: the polity issuer public addr the contract will
  validate against
- issuer_mode: production (env-keyed) vs dev (deterministic seed)
- gateway_url_pattern
- db_resolution: whether a queried subname exists in
  persona_ens_names / locker_ens_names (lets operator verify the
  mint endpoints wrote something before they expect resolution to
  return data)
- signing_roundtrip:
    sig_matches_issuer (must be true or the contract will reject
      every response)
    sample_signature + recovered_address + message_hash for debug
- next_steps: actionable guidance with the right command line

usage:
  curl -s 'https://dev-beta.aigentz.me/api/ens/ccip-read/health' | jq

if sig_matches_issuer=false, do NOT deploy yet — fix the
POLITY_ISSUER_PRIVATE_KEY env var on the server first. saves a
wasted contract deploy + roundtrip.
```

## Body

operator can sanity-check the signing pipeline before spending sepolia
gas on the resolver contract deploy. returns:

- issuer_address: the polity issuer public addr the contract will
  validate against
- issuer_mode: production (env-keyed) vs dev (deterministic seed)
- gateway_url_pattern
- db_resolution: whether a queried subname exists in
  persona_ens_names / locker_ens_names (lets operator verify the
  mint endpoints wrote something before they expect resolution to
  return data)
- signing_roundtrip:
    sig_matches_issuer (must be true or the contract will reject
      every response)
    sample_signature + recovered_address + message_hash for debug
- next_steps: actionable guidance with the right command line

usage:
  curl -s 'https://dev-beta.aigentz.me/api/ens/ccip-read/health' | jq

if sig_matches_issuer=false, do NOT deploy yet — fix the
POLITY_ISSUER_PRIVATE_KEY env var on the server first. saves a
wasted contract deploy + roundtrip.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/ens/ccip-read/health/route.ts` |

## Stats

 1 file changed, 143 insertions(+)
