-- Allows authenticated administrators to append structured dashboard audit events.
-- Authorization remains database-enforced; clients cannot update or delete logs.

create or replace function public.record_admin_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id bigint;
begin
  if not (select private.is_administrator()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if nullif(btrim(p_action), '') is null or nullif(btrim(p_entity_type), '') is null then
    raise exception 'Audit action and entity type are required' using errcode = '23514';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), btrim(p_action), btrim(p_entity_type), p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.record_admin_audit(text, text, uuid, jsonb) from public, anon;
grant execute on function public.record_admin_audit(text, text, uuid, jsonb) to authenticated;

comment on function public.record_admin_audit is
  'Appends an administrator-only dashboard audit event without granting direct audit_logs inserts.';

