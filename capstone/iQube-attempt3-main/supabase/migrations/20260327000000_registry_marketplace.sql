-- Registry marketplace tables: access requests + purchase records
-- Run in your Supabase SQL editor.

-- 1) Access requests — users request access to iQubes they don't own
create table if not exists public.access_requests (
  id            bigserial     primary key,
  token_id      bigint        not null,
  requester_address text      not null,
  owner_address text          not null,
  status        text          not null default 'pending',  -- pending | approved | denied
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),

  constraint access_requests_token_fk
    foreign key (token_id) references public.iqubes (token_id)
    on delete cascade
);

-- Prevent duplicate pending requests from the same address for the same token
create unique index if not exists access_requests_unique_pending_idx
  on public.access_requests (token_id, lower(requester_address))
  where status = 'pending';

-- Speed up lookups by owner (for the "incoming requests" panel)
create index if not exists access_requests_owner_idx
  on public.access_requests (lower(owner_address), status);

-- 2) Purchase records — tracks completed purchases for auditability
create table if not exists public.purchase_records (
  id              bigserial     primary key,
  token_id        bigint        not null,
  buyer_address   text          not null,
  seller_address  text          not null,
  tx_hash         text,                       -- on-chain transaction hash (null for free)
  amount          text,                       -- price paid (in POL)
  business_model  text          not null,     -- Free, Buy, Subscribe, Rent, License, Donate
  created_at      timestamptz   not null default now(),

  constraint purchase_records_token_fk
    foreign key (token_id) references public.iqubes (token_id)
    on delete cascade
);

create index if not exists purchase_records_token_idx
  on public.purchase_records (token_id);

create index if not exists purchase_records_buyer_idx
  on public.purchase_records (lower(buyer_address));
