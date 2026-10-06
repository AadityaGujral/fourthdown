-- V16 stores queue internals outside the exposed API schema.
create schema if not exists fourthdown_private;
revoke all on schema fourthdown_private from public, anon, authenticated;
create table fourthdown_private.job_config (id boolean primary key default true check(id), secret_hash text not null);
-- Reuse the existing credential without copying its hash into source control.
insert into fourthdown_private.job_config(secret_hash)
select (regexp_match(pg_get_functiondef('public.get_v14_email_batch(text)'::regprocedure), '''([0-9a-f]{64})'''))[1];

alter table public.notifications add column if not exists in_app_visible boolean not null default true;
create table fourthdown_private.alert_queue (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 target_key text not null,
 channel text not null check(channel in ('email','push')),
 notification_id bigint references public.notifications(id) on delete cascade,
 subscription_id bigint references public.push_subscriptions(id) on delete cascade,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 locked_until timestamptz,
 expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_error text,
 provider_id text,
 unique(user_id,target_key)
);
alter table fourthdown_private.alert_queue enable row level security;
alter table fourthdown_private.job_config enable row level security;
create index alert_queue_ready on fourthdown_private.alert_queue(status,next_attempt_at);
create table fourthdown_private.job_runs (
 id uuid primary key default gen_random_uuid(),
 mode text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table fourthdown_private.job_runs enable row level security;

create or replace function fourthdown_private.alert_job(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare event jsonb; inserted integer:=0; changed integer; result jsonb; q fourthdown_private.alert_queue; success boolean;
begin
 if p_action='ingest' then
  if jsonb_typeof(p_payload->'events') is distinct from 'array' or jsonb_array_length(p_payload->'events')>100 then raise exception 'Invalid event batch'; end if;
  for event in select value from jsonb_array_elements(p_payload->'events') loop
   if event->>'kind' not in ('game','injury') or left(event->>'dedupe_key',4) is distinct from 'v16:' or length(event->>'title')>200 or length(event->>'body')>2000 or left(event->>'href',1) is distinct from '/' then raise exception 'Invalid event'; end if;
   insert into public.notifications(user_id,kind,title,body,href,dedupe_key,in_app_visible)
   select u.id,event->>'kind',event->>'title',event->>'body',event->>'href',event->>'dedupe_key',
    case when event->>'kind'='game' then coalesce(p.game_alerts,true) else coalesce(p.injury_alerts,true) end
   from auth.users u left join public.notification_preferences p on p.user_id=u.id
   where ((event->>'kind'='game' and exists(select 1 from public.favorite_teams f where f.user_id=u.id and (event->'team_slugs') ? f.team_slug)
     and (coalesce(p.game_alerts,true) or coalesce(p.email_game_alerts,false) or coalesce(p.push_game_alerts,false)))
    or (event->>'kind'='injury' and exists(select 1 from public.saved_players s where s.user_id=u.id and s.player_id=event->>'player_id')
     and (coalesce(p.injury_alerts,true) or coalesce(p.email_injury_alerts,false) or coalesce(p.push_injury_alerts,false))))
   on conflict(user_id,dedupe_key) do nothing;
   get diagnostics changed=row_count;inserted:=inserted+changed;
  end loop;
  return jsonb_build_object('inserted',inserted);
 elsif p_action='enqueue' then
  insert into fourthdown_private.alert_queue(user_id,target_key,channel,notification_id,payload)
  select n.user_id,'email:'||n.dedupe_key,'email',n.id,jsonb_build_object('kind',n.kind,'title',n.title,'body',n.body,'href',n.href)
  from public.notifications n join public.notification_preferences p on p.user_id=n.user_id
  join auth.users u on u.id=n.user_id
  where n.dedupe_key like 'v16:%' and n.created_at>now()-interval '24 hours' and u.email_confirmed_at is not null
   and ((n.kind='game' and p.email_game_alerts) or (n.kind='injury' and p.email_injury_alerts))
  on conflict(user_id,target_key) do nothing;
  get diagnostics inserted=row_count;
  insert into fourthdown_private.alert_queue(user_id,target_key,channel,notification_id,subscription_id,payload)
  select n.user_id,'push:'||s.id||':'||n.dedupe_key,'push',n.id,s.id,jsonb_build_object('kind',n.kind,'title',n.title,'body',n.body,'href',n.href)
  from public.notifications n join public.notification_preferences p on p.user_id=n.user_id
  join public.push_subscriptions s on s.user_id=n.user_id and s.created_at<=n.created_at
  where n.dedupe_key like 'v16:%' and n.created_at>now()-interval '24 hours'
   and ((n.kind='game' and p.push_game_alerts) or (n.kind='injury' and p.push_injury_alerts))
  on conflict(user_id,target_key) do nothing;
  get diagnostics changed=row_count;
  return jsonb_build_object('queued',inserted+changed);
 elsif p_action='weekly' then
  insert into fourthdown_private.alert_queue(user_id,target_key,channel,payload)
  select u.id,'email:v16:weekly:'||to_char(now() at time zone 'America/New_York','IYYY-IW'),'email',
   jsonb_build_object('kind','weekly','title','FourthDown Weekly Digest','body',concat('Your teams: ',coalesce((select string_agg(replace(f.team_slug,'-',' '),', ') from public.favorite_teams f where f.user_id=u.id),'None'),E'\nSaved players: ',coalesce((select string_agg(s.player_name,', ') from public.saved_players s where s.user_id=u.id),'None')),'href','/notifications')
  from auth.users u join public.notification_preferences p on p.user_id=u.id
  where p.email_weekly_digest and u.email_confirmed_at is not null
  on conflict(user_id,target_key) do nothing;
  get diagnostics changed=row_count;return jsonb_build_object('queued',changed);
 elsif p_action='claim' then
  -- Expired leases are retried; opted-out/expired messages are never reclaimed.
  update fourthdown_private.alert_queue j set status='cancelled',updated_at=now(),lease_token=null,locked_until=null
  where j.status in ('pending','processing') and (j.expires_at<=now() or not exists(
   select 1 from public.notification_preferences p where p.user_id=j.user_id and
   ((j.channel='email' and ((j.payload->>'kind'='game' and p.email_game_alerts) or (j.payload->>'kind'='injury' and p.email_injury_alerts) or (j.payload->>'kind'='weekly' and p.email_weekly_digest))) or
    (j.channel='push' and ((j.payload->>'kind'='game' and p.push_game_alerts) or (j.payload->>'kind'='injury' and p.push_injury_alerts))))));
  update fourthdown_private.alert_queue set status='failed',last_error='attempt_limit',updated_at=now()
  where status='processing' and locked_until<now() and attempts>=5;
  with candidates as (
   select j.id from fourthdown_private.alert_queue j
   where (j.status='pending' or (j.status='processing' and j.locked_until<now())) and j.attempts<5 and j.next_attempt_at<=now()
    and (p_payload->'channels') ? j.channel
   order by j.created_at,j.id for update skip locked limit 20
  ), claimed as (
   update fourthdown_private.alert_queue j set status='processing',attempts=j.attempts+1,lease_token=gen_random_uuid(),locked_until=now()+interval '5 minutes',updated_at=now()
   from candidates c where j.id=c.id returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'channel',c.channel,'token',c.lease_token,'attempts',c.attempts,'payload',c.payload,
   'recipient',u.email,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth)),'[]'::jsonb) into result
   from claimed c join auth.users u on u.id=c.user_id left join public.push_subscriptions s on s.id=c.subscription_id;
  return result;
 elsif p_action='settle' then
  select * into q from fourthdown_private.alert_queue where id=(p_payload->>'id')::uuid and status='processing' and lease_token=(p_payload->>'token')::uuid for update;
  if not found then return jsonb_build_object('settled',false);end if;
  success:=coalesce((p_payload->>'success')::boolean,false);
  update fourthdown_private.alert_queue set status=case when success then 'sent' when coalesce((p_payload->>'permanent')::boolean,false) or attempts>=5 then 'failed' else 'pending' end,
   next_attempt_at=now()+least(3600,60*power(2,attempts)::integer)*interval '1 second',
   provider_id=case when success then left(p_payload->>'provider_id',200) else null end,
   last_error=case when success then null else left(p_payload->>'code',80) end,lease_token=null,locked_until=null,updated_at=now()
  where id=q.id;
  if success and q.channel='email' then
   insert into public.email_deliveries(user_id,kind,dedupe_key,recipient,provider_id)
   select q.user_id,q.payload->>'kind',q.target_key,u.email,left(p_payload->>'provider_id',200) from auth.users u where u.id=q.user_id
   on conflict(user_id,dedupe_key) do nothing;
  elsif success and q.channel='push' then
   insert into public.push_deliveries(user_id,notification_id,dedupe_key) values(q.user_id,q.notification_id,q.target_key) on conflict(user_id,dedupe_key) do nothing;
  elsif q.channel='push' and p_payload->>'code' in ('http_404','http_410') then
   delete from public.push_subscriptions where id=q.subscription_id;
  end if;
  return jsonb_build_object('settled',true);
 elsif p_action='record_run' then
  insert into fourthdown_private.job_runs(mode,result) values(left(p_payload->>'mode',20),p_payload->'result');
  delete from fourthdown_private.job_runs where created_at<now()-interval '30 days';
  return jsonb_build_object('recorded',true);
 elsif p_action='status' then
  return jsonb_build_object('queue',(select coalesce(jsonb_object_agg(x.status,x.c),'{}') from (select status,count(*) c from fourthdown_private.alert_queue group by status)x),'last_run',(select jsonb_build_object('mode',mode,'result',result,'at',created_at) from fourthdown_private.job_runs order by created_at desc limit 1));
 else raise exception 'Unknown action';end if;
end;
$$;
revoke all on function fourthdown_private.alert_job(text,jsonb) from public,anon,authenticated;

-- Existing deployment authenticates server jobs using a secret + publishable key.
-- The only exposed entry point checks the credential before accessing private data.
create or replace function public.v16_alert_job(p_secret text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_secret is null or not exists(select 1 from fourthdown_private.job_config where secret_hash=encode(extensions.digest(p_secret::bytea,'sha256'),'hex')) then raise exception 'Unauthorized' using errcode='42501';end if;
 return fourthdown_private.alert_job(p_action,p_payload);
end;
$$;
revoke all on function public.v16_alert_job(text,text,jsonb) from public,authenticated;
grant execute on function public.v16_alert_job(text,text,jsonb) to anon;
