-- Owner-only report: run in Supabase SQL Editor, never expose auth.users publicly.
-- Accounts and recent backup activity do not count offline/guest users or installs.
select
 (select count(*) from auth.users) as cloud_accounts,
 (select count(distinct owner_id) from public.daily_vaults) as accounts_with_backups,
 (select count(distinct owner_id) from public.daily_vaults where updated_at >= now()-interval '7 days') as accounts_backed_up_last_7_days,
 (select count(distinct owner_id) from public.daily_vaults where updated_at >= now()-interval '30 days') as accounts_backed_up_last_30_days;
