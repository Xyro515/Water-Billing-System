-- Customer membership classification and approved member/non-member water rates.

create type public.customer_type as enum ('member', 'non_member');

alter table public.customers
  add column customer_type public.customer_type not null default 'member';

alter table public.tariffs
  add column customer_type public.customer_type not null default 'member';

create index tariffs_customer_type_effective_idx
  on public.tariffs (customer_type, effective_from desc, effective_to)
  where archived_at is null and is_approved;

create or replace function public.validate_invoice_customer_tariff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.customers customer
    join public.tariffs tariff on tariff.id = new.tariff_id
    where customer.id = new.customer_id
      and customer.customer_type = tariff.customer_type
  ) then
    raise exception 'Tariff customer type does not match the customer account' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invoices_validate_customer_tariff
  before insert or update of customer_id, tariff_id on public.invoices
  for each row execute function public.validate_invoice_customer_tariff();

do $$
declare
  member_tariff_id uuid;
  non_member_tariff_id uuid;
begin
  select id into member_tariff_id from public.tariffs where code = 'MEMBER_RESIDENTIAL' and version = 1;
  if member_tariff_id is null then
    insert into public.tariffs (
      code, name, version, effective_from, fixed_charge, minimum_charge,
      customer_type, tax_name, tax_rate, due_days, is_approved
    ) values (
      'MEMBER_RESIDENTIAL', 'Organization Member Water Service', 1, date '2026-01-01', 150, 150,
      'member', 'None', 0, 15, false
    ) returning id into member_tariff_id;
    insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order) values
      (member_tariff_id, 0, 10, 0, 1),
      (member_tariff_id, 10, null, 10, 2);
    update public.tariffs set is_approved = true, approved_at = now() where id = member_tariff_id;
  end if;

  select id into non_member_tariff_id from public.tariffs where code = 'NON_MEMBER_RESIDENTIAL' and version = 1;
  if non_member_tariff_id is null then
    insert into public.tariffs (
      code, name, version, effective_from, fixed_charge, minimum_charge,
      customer_type, tax_name, tax_rate, due_days, is_approved
    ) values (
      'NON_MEMBER_RESIDENTIAL', 'Non-Member Water Service', 1, date '2026-01-01', 200, 200,
      'non_member', 'None', 0, 15, false
    ) returning id into non_member_tariff_id;
    insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order) values
      (non_member_tariff_id, 0, 10, 0, 1),
      (non_member_tariff_id, 10, null, 10, 2);
    update public.tariffs set is_approved = true, approved_at = now() where id = non_member_tariff_id;
  end if;
end;
$$;

comment on column public.customers.customer_type is 'Determines whether member or non-member billing tariffs apply.';
comment on column public.tariffs.customer_type is 'Customer classification eligible for this tariff version.';
