-- QubeTalk Database Migration
-- Create tables for agent-to-agent messaging system

-- Channels table for managing communication channels
create table if not exists qubetalk_channels (
  channel_id text primary key,
  tenant_id text not null,
  participants text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Delegations table for agent delegation requests
create table if not exists qubetalk_delegations (
  delegation_id text primary key,
  tenant_id text not null,
  channel_id text not null references qubetalk_channels(channel_id) on delete cascade,
  request_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'failed')),
  from_agent jsonb not null,
  to_agent jsonb not null,
  task jsonb not null,
  context jsonb default '{}'::jsonb,
  result jsonb default '{}'::jsonb,
  receipt_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages table for channel communications
create table if not exists qubetalk_messages (
  message_id text primary key,
  channel_id text not null references qubetalk_channels(channel_id) on delete cascade,
  in_reply_to text references qubetalk_messages(message_id) on delete set null,
  from_agent jsonb not null,
  type text not null default 'text' check (type in ('text', 'delegation', 'response', 'system', 'receipt')),
  content text not null,
  iqube_refs text[] default '{}',
  receipt_ref text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_qubetalk_channels_tenant on qubetalk_channels(tenant_id);
create index if not exists idx_qubetalk_channels_participants on qubetalk_channels using GIN(participants);

create index if not exists idx_qubetalk_delegations_tenant on qubetalk_delegations(tenant_id);
create index if not exists idx_qubetalk_delegations_channel on qubetalk_delegations(channel_id);
create index if not exists idx_qubetalk_delegations_status on qubetalk_delegations(status);
create index if not exists idx_qubetalk_delegations_request_id on qubetalk_delegations(request_id);

create index if not exists idx_qubetalk_messages_channel on qubetalk_messages(channel_id);
create index if not exists idx_qubetalk_messages_in_reply_to on qubetalk_messages(in_reply_to);
create index if not exists idx_qubetalk_messages_type on qubetalk_messages(type);
create index if not exists idx_qubetalk_messages_created_at on qubetalk_messages(created_at);

-- Row Level Security (RLS) policies
alter table qubetalk_channels enable row level security;
alter table qubetalk_delegations enable row level security;
alter table qubetalk_messages enable row level security;

-- Channels RLS policies
create policy "Users can view channels they participate in" on qubetalk_channels
  for select using (tenant_id = current_setting('app.current_tenant_id')::text);

create policy "Users can insert channels for their tenant" on qubetalk_channels
  for insert with check (tenant_id = current_setting('app.current_tenant_id')::text);

-- Delegations RLS policies
create policy "Users can view delegations in their tenant" on qubetalk_delegations
  for select using (tenant_id = current_setting('app.current_tenant_id')::text);

create policy "Users can insert delegations for their tenant" on qubetalk_delegations
  for insert with check (tenant_id = current_setting('app.current_tenant_id')::text);

-- Messages RLS policies
create policy "Users can view messages in their tenant channels" on qubetalk_messages
  for select using (
    exists (
      select 1 from qubetalk_channels 
      where channel_id = qubetalk_messages.channel_id 
      and tenant_id = current_setting('app.current_tenant_id')::text
    )
  );

create policy "Users can insert messages in their tenant channels" on qubetalk_messages
  for insert with check (
    exists (
      select 1 from qubetalk_channels 
      where channel_id = qubetalk_messages.channel_id 
      and tenant_id = current_setting('app.current_tenant_id')::text
    )
  );

-- Functions for automatic timestamp updates
create or replace function update_qubetalk_timestamps()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for automatic timestamp updates
create trigger update_qubetalk_channels_timestamp
  before update on qubetalk_channels
  for each row execute function update_qubetalk_timestamps();

create trigger update_qubetalk_delegations_timestamp
  before update on qubetalk_delegations
  for each row execute function update_qubetalk_timestamps();

-- Function to clean up old messages (optional, for maintenance)
create or replace function cleanup_old_qubetalk_messages(days_old integer default 90)
returns integer as $$
declare
  deleted_count integer;
begin
  delete from qubetalk_messages 
  where created_at < now() - interval '1 day' * days_old;
  
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql;

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant select on qubetalk_channels to anon, authenticated;
grant select on qubetalk_delegations to anon, authenticated;
grant select on qubetalk_messages to anon, authenticated;

grant insert on qubetalk_channels to authenticated;
grant insert on qubetalk_delegations to authenticated;
grant insert on qubetalk_messages to authenticated;

grant update on qubetalk_channels to authenticated;
grant update on qubetalk_delegations to authenticated;
grant update on qubetalk_messages to authenticated;

grant delete on qubetalk_channels to authenticated;
grant delete on qubetalk_delegations to authenticated;
grant delete on qubetalk_messages to authenticated;
