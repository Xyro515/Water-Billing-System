-- Append-only audit records for administrator tariff and tier changes.

create or replace function public.audit_tariff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid := coalesce(new.id, old.id);
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  values ((select auth.uid()), case tg_op when 'INSERT' then 'tariff_created' when 'UPDATE' then 'tariff_updated' else 'tariff_deleted' end,
    'tariff', target_id, case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end, jsonb_build_object('source', 'database_trigger'));
  return coalesce(new, old);
end;
$$;

create or replace function public.audit_tariff_tier_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid := coalesce(new.id, old.id);
  target_tariff_id uuid := coalesce(new.tariff_id, old.tariff_id);
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  values ((select auth.uid()), case tg_op when 'INSERT' then 'tariff_tier_created' when 'UPDATE' then 'tariff_tier_updated' else 'tariff_tier_deleted' end,
    'tariff_tier', target_id, case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    jsonb_build_object('source', 'database_trigger', 'tariff_id', target_tariff_id));
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_tariff_change() from public, anon, authenticated;
revoke all on function public.audit_tariff_tier_change() from public, anon, authenticated;

create trigger tariffs_append_audit after insert or update or delete on public.tariffs
  for each row execute function public.audit_tariff_change();
create trigger tariff_tiers_append_audit after insert or update or delete on public.tariff_tiers
  for each row execute function public.audit_tariff_tier_change();

comment on function public.audit_tariff_change is 'Records every tariff version change in the append-only audit log.';
comment on function public.audit_tariff_tier_change is 'Records every tariff tier change in the append-only audit log.';

