-- Development seed data intentionally contains no authentication users.
-- Create test users through Supabase Auth, then associate customers with their profile IDs.

insert into public.tariffs (
  code,
  name,
  version,
  effective_from,
  fixed_charge,
  is_approved
)
values (
  'RESIDENTIAL',
  'Residential Water Service',
  1,
  date '2026-01-01',
  85.00,
  false
)
on conflict (code, version) do nothing;

insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order)
select id, 0, 10, 20.0000, 1 from public.tariffs where code = 'RESIDENTIAL' and version = 1
on conflict (tariff_id, sort_order) do nothing;

insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order)
select id, 10, 20, 26.5000, 2 from public.tariffs where code = 'RESIDENTIAL' and version = 1
on conflict (tariff_id, sort_order) do nothing;

insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order)
select id, 20, null, 32.0000, 3 from public.tariffs where code = 'RESIDENTIAL' and version = 1
on conflict (tariff_id, sort_order) do nothing;

update public.tariffs
set is_approved = true, approved_at = now()
where code = 'RESIDENTIAL' and version = 1 and not is_approved;
