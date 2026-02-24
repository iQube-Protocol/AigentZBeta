-- QubeTalk Database Functions
-- Helper functions for tenant context and operations

-- Function to set tenant context for RLS
create or replace function set_tenant_context(tenant_id text)
returns void as $$
begin
  perform set_config('app.current_tenant_id', tenant_id, true);
end;
$$ language plpgsql security definer;

-- Function to get tenant context
create or replace function get_tenant_context()
returns text as $$
begin
  return current_setting('app.current_tenant_id', true);
end;
$$ language plpgsql security definer;

-- Function to create a channel with participants
create or replace function create_qubetalk_channel(
  p_channel_id text,
  p_tenant_id text,
  p_participants text[] default '{}'
)
returns void as $$
begin
  insert into qubetalk_channels (channel_id, tenant_id, participants)
  values (p_channel_id, p_tenant_id, p_participants);
end;
$$ language plpgsql security definer;

-- Function to add participant to channel
create or replace function add_channel_participant(
  p_channel_id text,
  p_participant_id text
)
returns boolean as $$
begin
  update qubetalk_channels 
  set participants = array_append(participants, p_participant_id)
  where channel_id = p_channel_id
  and not (p_participant_id = any(participants));
  
  return found;
end;
$$ language plpgsql security definer;

-- Function to remove participant from channel
create or replace function remove_channel_participant(
  p_channel_id text,
  p_participant_id text
)
returns boolean as $$
begin
  update qubetalk_channels 
  set participants = array_remove(participants, p_participant_id)
  where channel_id = p_channel_id
  and (p_participant_id = any(participants));
  
  return found;
end;
$$ language plpgsql security definer;

-- Function to get channel message count
create or replace function get_channel_message_count(p_channel_id text)
returns integer as $$
declare
  message_count integer;
begin
  select count(*) into message_count
  from qubetalk_messages
  where channel_id = p_channel_id;
  
  return message_count;
end;
$$ language plpgsql security definer;

-- Function to get channel delegation count
create or replace function get_channel_delegation_count(p_channel_id text)
returns integer as $$
declare
  delegation_count integer;
begin
  select count(*) into delegation_count
  from qubetalk_delegations
  where channel_id = p_channel_id;
  
  return delegation_count;
end;
$$ language plpgsql security definer;

-- Function to get channel statistics
create or replace function get_channel_statistics(p_channel_id text)
returns json as $$
declare
  stats json;
begin
  select json_build_object(
    'message_count', get_channel_message_count(p_channel_id),
    'delegation_count', get_channel_delegation_count(p_channel_id),
    'participant_count', (select array_length(participants, 1) from qubetalk_channels where channel_id = p_channel_id),
    'last_activity', (select max(created_at) from qubetalk_messages where channel_id = p_channel_id)
  ) into stats;
  
  return stats;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function set_tenant_context to authenticated, anon;
grant execute on function get_tenant_context to authenticated, anon;
grant execute on function create_qubetalk_channel to authenticated;
grant execute on function add_channel_participant to authenticated;
grant execute on function remove_channel_participant to authenticated;
grant execute on function get_channel_message_count to authenticated, anon;
grant execute on function get_channel_delegation_count to authenticated, anon;
grant execute on function get_channel_statistics to authenticated, anon;
