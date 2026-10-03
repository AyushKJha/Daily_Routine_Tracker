-- Run in a new Supabase project's SQL editor. Journal content stays encrypted.
create table if not exists public.daily_vaults (
 owner_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 envelope jsonb not null,
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(owner_id,id),
 check (id ~ '^daily-[a-f0-9-]{36}$'),
 check (octet_length(envelope::text) < 14000000)
);
alter table public.daily_vaults enable row level security;
revoke all on public.daily_vaults from anon,authenticated;
grant select on public.daily_vaults to authenticated;
create policy "Read own encrypted vaults" on public.daily_vaults
 for select to authenticated using (owner_id=auth.uid());

create or replace function public.save_daily_vault(workspace_id text,expected_version bigint,encrypted_envelope jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_version bigint; new_version bigint; account uuid:=auth.uid();
begin
 if account is null then raise exception 'Sign in required'; end if;
 if workspace_id !~ '^daily-[a-f0-9-]{36}$' or encrypted_envelope->>'id' is distinct from workspace_id
  or encrypted_envelope->>'version' is distinct from '1' or octet_length(encrypted_envelope::text)>=14000000
  or jsonb_typeof(encrypted_envelope->'payload') is distinct from 'object'
  or jsonb_typeof(encrypted_envelope->'password') is distinct from 'object'
  or jsonb_typeof(encrypted_envelope->'recovery') is distinct from 'object'
 then raise exception 'Invalid encrypted envelope'; end if;
 perform pg_advisory_xact_lock(hashtextextended(account::text||workspace_id,0));
 select version into current_version from public.daily_vaults where owner_id=account and id=workspace_id;
 if coalesce(current_version,0)<>expected_version then return jsonb_build_object('ok',false,'version',current_version); end if;
 new_version:=coalesce(current_version,0)+1;
 insert into public.daily_vaults(owner_id,id,envelope,version) values(account,workspace_id,encrypted_envelope,new_version)
 on conflict(owner_id,id) do update set envelope=excluded.envelope,version=excluded.version,updated_at=now();
 return jsonb_build_object('ok',true,'version',new_version);
end;
$$;
revoke all on function public.save_daily_vault(text,bigint,jsonb) from public,anon;
grant execute on function public.save_daily_vault(text,bigint,jsonb) to authenticated;
