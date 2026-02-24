-- Remote custody and claim support tables
-- dvn_attestations: stores DVN attestation roots tied to x402 message
create table if not exists dvn_attestations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references x402_messages(id) on delete cascade,
  root text not null,
  msg_hash text,
  received_at timestamptz default now()
);
create index if not exists dvn_attestations_message_id_idx on dvn_attestations(message_id);

-- custody_events: records custody grants on origin chain
create table if not exists custody_events (
  id uuid primary key default gen_random_uuid(),
  iqube_ref text not null,
  to_did text not null,
  scope text[] not null,
  ttl timestamptz,
  x402_message_id uuid references x402_messages(id) on delete set null,
  x402_hash text,
  dvn_root text,
  chain text,
  block_number bigint,
  tx_hash text,
  created_at timestamptz default now()
);
create index if not exists custody_events_lookup_idx on custody_events(iqube_ref, to_did);

-- claims: lazy-mint claim tracking
create table if not exists claims (
  claim_id text primary key,
  asset text not null,
  amount numeric not null,
  from_chain text not null,
  to_chain text not null,
  to_did text not null,
  expiry timestamptz,
  dvn_root text not null,
  status text not null check (status in ('open','redeemed','expired','cancelled')),
  created_at timestamptz default now()
);
create index if not exists claims_to_did_status_idx on claims(to_did, status);
