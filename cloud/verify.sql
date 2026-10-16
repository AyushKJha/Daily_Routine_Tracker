-- Run as postgres in Supabase SQL Editor. All fixtures are rolled back.
begin;
insert into auth.users(id) values
 ('a4756e11-2963-4c63-b86d-6ad900f2b111'),
 ('a4756e11-2963-4c63-b86d-6ad900f2b222');
set local role authenticated;
select set_config('request.jwt.claim.sub','a4756e11-2963-4c63-b86d-6ad900f2b111',true);
do $$
declare v jsonb; e jsonb := '{"id":"daily-a4756e11-2963-4c63-b86d-6ad900f2b333","version":1,"payload":{},"password":{},"recovery":{}}';
begin
 v := public.save_daily_vault(e->>'id',0,e);
 if v->>'ok' <> 'true' or v->>'version' <> '1' then raise exception 'Initial save failed'; end if;
 v := public.save_daily_vault(e->>'id',0,e);
 if v->>'ok' <> 'false' then raise exception 'Stale version overwrote data'; end if;
 v := public.save_daily_vault(e->>'id',1,e);
 if v->>'version' <> '2' then raise exception 'Revision did not advance'; end if;
 if (select count(*) from public.daily_vaults where id=e->>'id') <> 1 then raise exception 'Owner read failed'; end if;
 begin
  perform public.save_daily_vault(e->>'id',null,e);
  raise exception 'Null revision accepted';
 exception when raise_exception then
  if sqlerrm <> 'Invalid expected version' then raise; end if;
 end;
 begin
  update public.daily_vaults set version=999 where id=e->>'id';
  raise exception 'Direct write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','a4756e11-2963-4c63-b86d-6ad900f2b222',true);
do $$ begin
 if exists(select 1 from public.daily_vaults where id='daily-a4756e11-2963-4c63-b86d-6ad900f2b333') then
  raise exception 'Cross-account read allowed';
 end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform 1 from public.daily_vaults;
  raise exception 'Anonymous read allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.save_daily_vault(null,0,null);
  raise exception 'Anonymous RPC allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
select 'PASS: owner access, account isolation, anonymous denial, direct-write denial, stale/null revision protection; fixtures rolled back' as verification;
