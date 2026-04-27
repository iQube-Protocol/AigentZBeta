-- Access control schema for iQubes
-- Run these statements in your Supabase project's SQL editor.

-- 1) Optional helper column on the main iQubes table
--    Stores the parsed list of allowed addresses for quick reads / debugging.
--    Safe to skip if you prefer to rely only on iqube_access_list.
alter table if exists public.iqubes
add column if not exists allowed_addresses jsonb;


-- 2) Per‑address access list for \"Specific addresses\" policy
create table if not exists public.iqube_access_list (
  id          bigserial primary key,
  token_id    bigint not null,
  address     text   not null,
  granted_by  text   not null,
  granted_at  timestamptz not null default now(),

  constraint iqube_access_list_token_fk
    foreign key (token_id) references public.iqubes (token_id)
    on delete cascade
);

-- Optional index to speed up lookups by (token_id, address)
create index if not exists iqube_access_list_token_address_idx
  on public.iqube_access_list (token_id, lower(address));

