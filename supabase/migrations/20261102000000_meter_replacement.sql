-- Atomically replace an active meter. Only active administrators may execute it.
create or replace function public.replace_customer_meter(
  target_customer_id uuid,
  new_meter_number text,
  new_serial_number text default null,
  new_manufacturer text default null,
  new_model text default null,
  replacement_date date default current_date,
  new_initial_reading numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_assignment public.meter_assignments%rowtype;
  created_meter_id uuid := gen_random_uuid();
begin
  if not (select private.is_administrator()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if btrim(new_meter_number) = '' or new_initial_reading < 0 then
    raise exception 'Invalid replacement meter details' using errcode = '22023';
  end if;

  select * into old_assignment
  from public.meter_assignments
  where customer_id = target_customer_id and ended_at is null
  for update;
  if not found then raise exception 'Customer has no active meter' using errcode = 'P0002'; end if;
  if replacement_date < old_assignment.started_at then raise exception 'Replacement date precedes current assignment' using errcode = '22023'; end if;

  update public.meter_assignments set ended_at = replacement_date where id = old_assignment.id;
  update public.meters set status = 'replaced' where id = old_assignment.meter_id;
  insert into public.meters (id, meter_number, serial_number, qr_code, manufacturer, model, status, installed_at, initial_reading)
  values (created_meter_id, btrim(new_meter_number), nullif(btrim(new_serial_number), ''), 'nmmpc:meter:' || created_meter_id, nullif(btrim(new_manufacturer), ''), nullif(btrim(new_model), ''), 'active', replacement_date, new_initial_reading);
  insert into public.meter_assignments (customer_id, meter_id, assigned_by, started_at)
  values (target_customer_id, created_meter_id, (select auth.uid()), replacement_date);
  return created_meter_id;
end;
$$;

revoke all on function public.replace_customer_meter(uuid, text, text, text, text, date, numeric) from public, anon;
grant execute on function public.replace_customer_meter(uuid, text, text, text, text, date, numeric) to authenticated;

