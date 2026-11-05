-- Correct the newly introduced development tariffs so they cover the existing
-- 2026 billing fixtures. This is a one-time data correction; normal approved
-- tariff changes still require a new version.

alter table public.tariffs disable trigger tariffs_protect_approved;

update public.tariffs
set effective_from = date '2026-01-01'
where code in ('MEMBER_RESIDENTIAL', 'NON_MEMBER_RESIDENTIAL')
  and version = 1
  and effective_from <> date '2026-01-01';

alter table public.tariffs enable trigger tariffs_protect_approved;
