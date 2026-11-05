-- Complete, auditable billing-rule configuration.
-- Monetary and tax values remain zero until an authorized tariff is approved.

create extension if not exists btree_gist with schema extensions;
create type public.rounding_mode as enum ('half_up', 'half_even', 'up', 'down');

alter table public.tariffs
  add column tax_name text not null default 'None',
  add column tax_rate numeric(7, 6) not null default 0,
  add column discount_rate numeric(7, 6) not null default 0,
  add column subsidy_amount numeric(12, 2) not null default 0,
  add column penalty_rate numeric(7, 6) not null default 0,
  add column penalty_grace_days smallint not null default 0,
  add column due_days smallint not null default 15,
  add column minimum_charge numeric(12, 2) not null default 0,
  add column apply_previous_balance boolean not null default true,
  add column meter_rollover_value numeric(14, 3) not null default 1000,
  add column rounding_scale smallint not null default 2,
  add column rounding_mode public.rounding_mode not null default 'half_up',
  add constraint tariffs_tax_name_not_blank check (btrim(tax_name) <> ''),
  add constraint tariffs_rates_valid check (
    tax_rate between 0 and 1
    and discount_rate between 0 and 1
    and penalty_rate between 0 and 1
  ),
  add constraint tariffs_rule_amounts_nonnegative check (
    subsidy_amount >= 0 and minimum_charge >= 0
  ),
  add constraint tariffs_rule_days_valid check (
    penalty_grace_days >= 0 and due_days > 0
  ),
  add constraint tariffs_rollover_positive check (meter_rollover_value > 0),
  add constraint tariffs_rounding_scale_valid check (rounding_scale between 0 and 4),
  add constraint tariffs_tax_consistent check (
    (tax_rate = 0 and tax_name = 'None') or (tax_rate > 0 and tax_name <> 'None')
  );

-- Approved versions of the same tariff code may not cover the same day.
alter table public.tariffs
  add constraint tariffs_approved_effective_period_excl
  exclude using gist (
    code with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (is_approved and archived_at is null);

-- Tiers are progressive [minimum, maximum); only the final tier is open-ended.
alter table public.tariff_tiers
  add constraint tariff_tiers_volume_range_excl
  exclude using gist (
    tariff_id with =,
    numrange(minimum_volume, maximum_volume, '[)') with &&
  );

create or replace function public.validate_tariff_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_approved and not old.is_approved then
    if not exists (select 1 from public.tariff_tiers where tariff_id = new.id) then
      raise exception 'An approved tariff requires at least one tier';
    end if;
    if (select min(minimum_volume) from public.tariff_tiers where tariff_id = new.id) <> 0 then
      raise exception 'The first tariff tier must start at zero';
    end if;
    if (select count(*) from public.tariff_tiers where tariff_id = new.id and maximum_volume is null) <> 1 then
      raise exception 'Exactly one open-ended final tariff tier is required';
    end if;
    if exists (
      select 1
      from (
        select minimum_volume,
               lag(maximum_volume) over (order by minimum_volume) as previous_maximum,
               row_number() over (order by minimum_volume) as row_number
        from public.tariff_tiers
        where tariff_id = new.id
      ) tiers
      where row_number > 1 and previous_maximum is distinct from minimum_volume
    ) then
      raise exception 'Tariff tiers must be contiguous';
    end if;
    if exists (
      select 1 from public.tariff_tiers
      where tariff_id = new.id and maximum_volume is null
        and minimum_volume <> (select max(minimum_volume) from public.tariff_tiers where tariff_id = new.id)
    ) then
      raise exception 'Only the final tariff tier may be open-ended';
    end if;
  end if;
  return new;
end;
$$;

create trigger tariffs_validate_approval
  before update of is_approved on public.tariffs
  for each row execute function public.validate_tariff_approval();

create or replace function public.protect_approved_tariff()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_approved then
    raise exception 'Approved tariffs are immutable; create a new version';
  end if;
  return old;
end;
$$;

create trigger tariffs_protect_approved
  before update or delete on public.tariffs
  for each row when (old.is_approved)
  execute function public.protect_approved_tariff();

create or replace function public.protect_approved_tariff_tier()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_tariff_id uuid := coalesce(new.tariff_id, old.tariff_id);
begin
  if exists (select 1 from public.tariffs where id = target_tariff_id and is_approved) then
    raise exception 'Tiers of an approved tariff are immutable; create a new tariff version';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger tariff_tiers_protect_approved
  before insert or update or delete on public.tariff_tiers
  for each row execute function public.protect_approved_tariff_tier();

comment on column public.tariffs.tax_rate is 'Customer-facing tax rate. Keep zero until an authorized tax treatment is approved.';
comment on column public.tariffs.discount_rate is 'Standard percentage discount applied before tax; customer-specific eligibility is recorded with the invoice.';
comment on column public.tariffs.subsidy_amount is 'Standard fixed subsidy applied after the percentage discount and before tax.';
comment on column public.tariffs.penalty_rate is 'Rate applied to eligible overdue previous balance after penalty_grace_days.';
comment on column public.tariffs.due_days is 'Calendar days after billing_period_end used to calculate the due date.';
comment on column public.tariffs.minimum_charge is 'Minimum current-period charge before discounts, subsidy, tax, penalties, and previous balance.';
comment on column public.tariffs.meter_rollover_value is 'Register value added when a confirmed rollover makes the current reading lower than the previous reading.';
comment on column public.tariffs.rounding_scale is 'Decimal places used for invoice line items and totals.';

