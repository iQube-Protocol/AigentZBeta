-- Additive migration for x402 + identity aliasing
create table if not exists identity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_did text not null,
  alias_type text not null,
  alias_value text not null,
  verified boolean not null default false,
  proof_ref text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_identity_alias on identity_aliases(entity_did, alias_type, alias_value);

create table if not exists fio_cache (
  handle text primary key,
  owner_pubkey text,
  raw_response jsonb,
  expires_at timestamptz
);

create table if not exists x402_messages (
  id uuid primary key default gen_random_uuid(),
  intent text not null,
  headers jsonb not null,
  payload jsonb not null,
  state text not null default 'received',
  bridge_message_id text,
  identity_proofs jsonb,
  resolved_sender_did text,
  resolved_recipient_did text,
  proofs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_x402_state on x402_messages(state);

create table if not exists x402_settlements (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references x402_messages(id) on delete cascade,
  asset text not null,
  amount text not null,
  escrow_tx text,
  release_tx text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_x402_settlement_msg on x402_settlements(message_id);

create table if not exists iqube_capabilities (
  id uuid primary key default gen_random_uuid(),
  iqube_ref text not null,
  audience_did text not null,
  audience_alias jsonb,
  scope jsonb not null,
  ttl timestamptz,
  state text not null default 'active',
  acl_delta_sig text,
  created_at timestamptz not null default now()
);
create index if not exists idx_iqube_cap_audience on iqube_capabilities(audience_did);

create table if not exists iqube_events (
  id uuid primary key default gen_random_uuid(),
  iqube_ref text not null,
  type text not null,
  x402_message_id uuid references x402_messages(id) on delete set null,
  state_proof jsonb,
  identity_snapshot jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_iqube_events_ref on iqube_events(iqube_ref);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references x402_messages(id) on delete cascade,
  meta_cid text,
  blak_uri text,
  hashes jsonb,
  pod_proof jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
