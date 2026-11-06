-- Give each customer's first meter an account-based asset number.
-- Replacement and transferred meters retain their own permanent generated identity.

create or replace function public.meter_number_from_account(p_account_number text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(btrim(p_account_number)) ~ '^ACC-[0-9]+$'
      then 'NMMPC-MTR-' || lpad((substring(upper(btrim(p_account_number)) from '^ACC-([0-9]+)$')::bigint)::text, 6, '0')
    else null
  end;
$$;

revoke all on function public.meter_number_from_account(text) from public, anon, authenticated;

create temporary table meter_account_number_backfill on commit drop as
with ranked as (
  select
    assignment.id as assignment_id,
    assignment.customer_id,
    assignment.meter_id,
    customer.account_number,
    meter.meter_number as old_meter_number,
    public.meter_number_from_account(customer.account_number) as target_meter_number,
    row_number() over (partition by assignment.customer_id order by assignment.started_at, assignment.created_at, assignment.id) as customer_order,
    row_number() over (partition by assignment.meter_id order by assignment.started_at, assignment.created_at, assignment.id) as meter_order
  from public.meter_assignments assignment
  join public.customers customer on customer.id = assignment.customer_id
  join public.meters meter on meter.id = assignment.meter_id
), candidates as (
  select *, count(*) over (partition by target_meter_number) as target_count
  from ranked
  where customer_order = 1 and meter_order = 1 and target_meter_number is not null
)
select assignment_id, customer_id, meter_id, account_number, old_meter_number, target_meter_number
from candidates
where target_count = 1;

-- A target held by a meter outside this controlled backfill is left untouched.
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'meter.account_backfill_conflict', 'meter', candidate.meter_id,
  jsonb_build_object(
    'customer_id', candidate.customer_id,
    'account_number', candidate.account_number,
    'current_meter_number', candidate.old_meter_number,
    'requested_meter_number', candidate.target_meter_number,
    'conflicting_meter_id', holder.id
  )
from meter_account_number_backfill candidate
join public.meters holder on holder.meter_number = candidate.target_meter_number and holder.id <> candidate.meter_id
where not exists (
  select 1 from meter_account_number_backfill moving
  where moving.meter_id = holder.id and moving.old_meter_number <> moving.target_meter_number
);

delete from meter_account_number_backfill candidate
where exists (
  select 1 from public.meters holder
  where holder.meter_number = candidate.target_meter_number
    and holder.id <> candidate.meter_id
    and not exists (
      select 1 from meter_account_number_backfill moving
      where moving.meter_id = holder.id and moving.old_meter_number <> moving.target_meter_number
    )
);

-- Temporary UUID-based values allow safe swaps without violating the unique constraint.
update public.meters meter
set meter_number = 'NMMPC-TMP-' || meter.id
from meter_account_number_backfill candidate
where meter.id = candidate.meter_id
  and candidate.old_meter_number <> candidate.target_meter_number;

update public.meters meter
set meter_number = candidate.target_meter_number
from meter_account_number_backfill candidate
where meter.id = candidate.meter_id
  and candidate.old_meter_number <> candidate.target_meter_number;

insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
select
  null,
  'meter.number_backfilled_from_account',
  'meter',
  candidate.meter_id,
  jsonb_build_object('meter_number', candidate.old_meter_number),
  jsonb_build_object('meter_number', candidate.target_meter_number),
  jsonb_build_object('customer_id', candidate.customer_id, 'account_number', candidate.account_number, 'assignment_id', candidate.assignment_id)
from meter_account_number_backfill candidate
where candidate.old_meter_number <> candidate.target_meter_number;

-- Continue automatic replacement numbering above every account-derived or generated value.
select setval(
  'public.meter_number_seq',
  coalesce((
    select max(substring(meter_number from '^NMMPC-MTR-([0-9]+)$')::bigint)
    from public.meters
    where meter_number ~ '^NMMPC-MTR-[0-9]+$'
  ), 1),
  exists (select 1 from public.meters where meter_number ~ '^NMMPC-MTR-[0-9]+$')
);

create or replace function public.apply_first_meter_account_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_number_value text;
  target_number text;
  old_number text;
begin
  -- Only the first assignment for both the customer and physical meter is eligible.
  if exists (select 1 from public.meter_assignments where customer_id = new.customer_id and id <> new.id)
    or exists (select 1 from public.meter_assignments where meter_id = new.meter_id and id <> new.id) then
    return new;
  end if;

  select account_number into account_number_value from public.customers where id = new.customer_id;
  target_number := public.meter_number_from_account(account_number_value);
  if target_number is null then return new; end if;

  if exists (select 1 from public.meters where meter_number = target_number and id <> new.meter_id) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'meter.account_number_conflict', 'meter', new.meter_id,
      jsonb_build_object('customer_id', new.customer_id, 'account_number', account_number_value, 'requested_meter_number', target_number));
    return new;
  end if;

  select meter_number into old_number from public.meters where id = new.meter_id for update;
  if old_number = target_number then return new; end if;
  update public.meters set meter_number = target_number where id = new.meter_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  values ((select auth.uid()), 'meter.number_assigned_from_account', 'meter', new.meter_id,
    jsonb_build_object('meter_number', old_number), jsonb_build_object('meter_number', target_number),
    jsonb_build_object('customer_id', new.customer_id, 'account_number', account_number_value, 'assignment_id', new.id));
  return new;
end;
$$;

drop trigger if exists meter_assignments_apply_first_account_number on public.meter_assignments;
create trigger meter_assignments_apply_first_account_number
  after insert on public.meter_assignments
  for each row execute function public.apply_first_meter_account_number();

comment on function public.meter_number_from_account is 'Maps ACC-#### account identifiers to NMMPC-MTR-###### first-meter asset numbers.';
comment on function public.apply_first_meter_account_number is 'Applies an account-derived identity only to a customer and meter first assignment; replacements retain generated identities.';
