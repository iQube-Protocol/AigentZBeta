-- Additive: TTL and verification timestamps for identity_aliases
alter table identity_aliases
  add column if not exists expires_at timestamptz,
  add column if not exists last_verified_at timestamptz;

create index if not exists idx_identity_alias_expiry on identity_aliases(expires_at);
