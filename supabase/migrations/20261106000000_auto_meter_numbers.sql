-- Generate stable meter asset numbers independently of customer names.

create sequence if not exists public.meter_number_seq;

select setval(
  'public.meter_number_seq',
  coalesce((
    select max(substring(meter_number from '^NMMPC-MTR-([0-9]+)$')::bigint)
    from public.meters
    where meter_number ~ '^NMMPC-MTR-[0-9]+$'
  ), 1),
  exists (select 1 from public.meters where meter_number ~ '^NMMPC-MTR-[0-9]+$')
);

create or replace function public.set_generated_meter_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(new.meter_number), '') is null then
    new.meter_number := 'NMMPC-MTR-' || lpad(nextval('public.meter_number_seq')::text, 6, '0');
  else
    new.meter_number := upper(btrim(new.meter_number));
  end if;
  return new;
end;
$$;

drop trigger if exists meters_generate_number on public.meters;
create trigger meters_generate_number
  before insert or update of meter_number on public.meters
  for each row execute function public.set_generated_meter_number();

create or replace function public.replace_customer_meter(
  target_customer_id uuid,
  new_meter_number text default null,
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
  if new_initial_reading < 0 then
    raise exception 'Initial reading must be zero or greater' using errcode = '22023';
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
  values (created_meter_id, nullif(btrim(new_meter_number), ''), nullif(btrim(new_serial_number), ''), 'nmmpc:meter:' || created_meter_id, nullif(btrim(new_manufacturer), ''), nullif(btrim(new_model), ''), 'active', replacement_date, new_initial_reading);
  insert into public.meter_assignments (customer_id, meter_id, assigned_by, started_at)
  values (target_customer_id, created_meter_id, (select auth.uid()), replacement_date);
  return created_meter_id;
end;
$$;

revoke all on function public.replace_customer_meter(uuid, text, text, text, text, date, numeric) from public, anon;
grant execute on function public.replace_customer_meter(uuid, text, text, text, text, date, numeric) to authenticated;

comment on sequence public.meter_number_seq is 'Concurrency-safe sequence for NMMPC-managed meter asset numbers.';
comment on function public.set_generated_meter_number is 'Generates NMMPC-MTR-###### for meters registered without an explicit legacy identifier.';
