-- QubeBase core tables for assets/payments/entitlements
create extension if not exists "uuid-ossp";

create table if not exists did_identities (
  id uuid primary key default uuid_generate_v4(),
  did text unique not null,
  kybe_did text,
  agent_handle text,
  created_at timestamptz default now()
);

create table if not exists content_assets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null,
  owner_did text not null,
  title text,
  description text,
  tags text[],
  media_kind text check (media_kind in ('image','video','audio','pdf','other')),
  bytes bigint,
  sha256 text,
  storage_uri text not null,
  registry_ref text,
  status text default 'draft',
  created_at timestamptz default now()
);

create table if not exists asset_policies (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references content_assets(id) on delete cascade,
  rights text[] not null default '{view,stream}',
  price_amount numeric(18,8) default 0,
  price_asset text default 'QCT',
  pay_to_did text not null,
  tokenqube_template text,
  visibility text default 'private',
  created_at timestamptz default now()
);

create table if not exists x402_transactions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null,
  buyer_did text not null,
  seller_did text not null,
  asset_id uuid not null references content_assets(id),
  amount numeric(18,8) not null,
  asset_symbol text not null,
  src_chain text,
  dest_chain text,
  status text default 'initiated',
  request_id text unique not null,
  facilitator_ref text,
  created_at timestamptz default now()
);

create table if not exists entitlements (
  id uuid primary key default uuid_generate_v4(),
  x402_id uuid not null references x402_transactions(id) on delete cascade,
  asset_id uuid not null references content_assets(id),
  holder_did text not null,
  rights text[] not null,
  tokenqube_id text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Quotes stream for MoneyPenny (tenant-scoped)
create table if not exists quotes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null,
  symbol text not null,
  bid numeric(18,8),
  ask numeric(18,8),
  mid numeric(18,8),
  source text,
  extra jsonb,
  ts timestamptz not null default now()
);
