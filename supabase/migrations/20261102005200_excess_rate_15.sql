-- Version 2 changes only the excess rate above the included first 10 m³.
-- Version 1 remains available for historical invoice reproduction.

alter table public.tariffs disable trigger tariffs_protect_approved;

update public.tariffs
set effective_to = date '2026-11-01'
where code in ('MEMBER_RESIDENTIAL', 'NON_MEMBER_RESIDENTIAL')
  and version = 1
  and effective_to is null;

alter table public.tariffs enable trigger tariffs_protect_approved;

do $$
declare
  member_tariff_id uuid;
  non_member_tariff_id uuid;
begin
  if not exists (select 1 from public.tariffs where code = 'MEMBER_RESIDENTIAL' and version = 2) then
    insert into public.tariffs (
      code, name, version, effective_from, fixed_charge, minimum_charge,
      customer_type, tax_name, tax_rate, due_days, is_approved
    ) values (
      'MEMBER_RESIDENTIAL', 'Organization Member Water Service', 2, date '2026-11-02', 150, 150,
      'member', 'None', 0, 15, false
    ) returning id into member_tariff_id;
    insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order) values
      (member_tariff_id, 0, 10, 0, 1),
      (member_tariff_id, 10, null, 15, 2);
    update public.tariffs set is_approved = true, approved_at = now() where id = member_tariff_id;
  end if;

  if not exists (select 1 from public.tariffs where code = 'NON_MEMBER_RESIDENTIAL' and version = 2) then
    insert into public.tariffs (
      code, name, version, effective_from, fixed_charge, minimum_charge,
      customer_type, tax_name, tax_rate, due_days, is_approved
    ) values (
      'NON_MEMBER_RESIDENTIAL', 'Non-Member Water Service', 2, date '2026-11-02', 200, 200,
      'non_member', 'None', 0, 15, false
    ) returning id into non_member_tariff_id;
    insert into public.tariff_tiers (tariff_id, minimum_volume, maximum_volume, rate_per_unit, sort_order) values
      (non_member_tariff_id, 0, 10, 0, 1),
      (non_member_tariff_id, 10, null, 15, 2);
    update public.tariffs set is_approved = true, approved_at = now() where id = non_member_tariff_id;
  end if;
end;
$$;
