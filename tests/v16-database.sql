begin;
do $$
declare uid uuid:=gen_random_uuid(); s1 bigint;s2 bigint;r jsonb;j jsonb;e jsonb; other jsonb; n integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values(uid,'v16-audit-'||uid||'@example.invalid',now());
 insert into public.favorite_teams(user_id,team_slug) values(uid,'new-york-jets');
 insert into public.notification_preferences(user_id,game_alerts,email_game_alerts,push_game_alerts,email_weekly_digest) values(uid,true,true,true,true) on conflict(user_id) do update set game_alerts=true,email_game_alerts=true,push_game_alerts=true,email_weekly_digest=true;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(uid,'https://audit.invalid/one','test','test') returning id into s1;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(uid,'https://audit.invalid/two','test','test') returning id into s2;
 e:=jsonb_build_object('events',jsonb_build_array(jsonb_build_object('kind','game','title','Test','body','Test','href','/notifications','dedupe_key','v16:audit:'||uid,'team_slugs',jsonb_build_array('new-york-jets'))));
 r:=fourthdown_private.alert_job('ingest',e);
 if not exists(select 1 from public.notifications where user_id=uid and dedupe_key='v16:audit:'||uid) then raise exception 'ingestion failed';end if;
 perform fourthdown_private.alert_job('ingest',e);
 select count(*) into n from public.notifications where user_id=uid and dedupe_key='v16:audit:'||uid;
 if n<>1 then raise exception 'duplicate notification';end if;
 perform fourthdown_private.alert_job('enqueue');perform fourthdown_private.alert_job('enqueue');
 select count(*) into n from fourthdown_private.alert_queue where user_id=uid;
 if n<>3 then raise exception 'expected email plus two device jobs, got %',n;end if;
 -- Claims may include pre-existing pending deliveries, but no messages are sent and all changes roll back.
 r:=fourthdown_private.alert_job('claim','{"channels":["email","push"]}');
 select value into j from jsonb_array_elements(r) where value->>'recipient'='v16-audit-'||uid||'@example.invalid' and value->>'channel'='email';
 if j is null then raise exception 'email claim missing';end if;
 if (fourthdown_private.alert_job('settle',jsonb_build_object('id',j->>'id','token',gen_random_uuid(),'success',true))->>'settled')::boolean then raise exception 'stale token accepted';end if;
 perform fourthdown_private.alert_job('settle',jsonb_build_object('id',j->>'id','token',j->>'token','success',true,'provider_id','audit'));
 if not exists(select 1 from public.email_deliveries where user_id=uid and provider_id='audit') then raise exception 'email receipt missing';end if;
 select value into j from jsonb_array_elements(r) where value->>'endpoint'='https://audit.invalid/one';
 perform fourthdown_private.alert_job('settle',jsonb_build_object('id',j->>'id','token',j->>'token','success',true));
 select value into other from jsonb_array_elements(r) where value->>'endpoint'='https://audit.invalid/two';
 perform fourthdown_private.alert_job('settle',jsonb_build_object('id',other->>'id','token',other->>'token','success',false,'code','http_503','permanent',false));
 if not exists(select 1 from fourthdown_private.alert_queue where id=(other->>'id')::uuid and status='pending' and attempts=1 and next_attempt_at>now()) then raise exception 'retry state invalid';end if;
 update fourthdown_private.alert_queue set next_attempt_at=now()-interval '1 second' where id=(other->>'id')::uuid;
 r:=fourthdown_private.alert_job('claim','{"channels":["email","push"]}');
 if exists(select 1 from jsonb_array_elements(r) x where x->>'id'=j->>'id') then raise exception 'delivered device reclaimed';end if;
 select value into other from jsonb_array_elements(r) where value->>'endpoint'='https://audit.invalid/two';
 if other is null then raise exception 'failed device suppressed';end if;
 -- An expired lease is reclaimed with a new token; the old worker is fenced out.
 j:=other;
 update fourthdown_private.alert_queue set locked_until=now()-interval '1 second' where id=(j->>'id')::uuid;
 r:=fourthdown_private.alert_job('claim','{"channels":["push"]}');
 select value into other from jsonb_array_elements(r) where value->>'id'=j->>'id';
 if other is null or other->>'token'=j->>'token' then raise exception 'expired lease not refreshed';end if;
 if (fourthdown_private.alert_job('settle',jsonb_build_object('id',j->>'id','token',j->>'token','success',true))->>'settled')::boolean then raise exception 'expired token accepted';end if;
 -- Opt-out cancels a leased retry and invalidates its token.
 update public.notification_preferences set push_game_alerts=false where user_id=uid;
 perform fourthdown_private.alert_job('claim','{"channels":["push"]}');
 if (fourthdown_private.alert_job('settle',jsonb_build_object('id',other->>'id','token',other->>'token','success',true))->>'settled')::boolean then raise exception 'cancelled lease accepted';end if;
 perform fourthdown_private.alert_job('weekly');perform fourthdown_private.alert_job('weekly');
 select count(*) into n from fourthdown_private.alert_queue where user_id=uid and payload->>'kind'='weekly';
 if n<>1 then raise exception 'duplicate weekly job';end if;
 -- Exhausted leases fail permanently, and expired pending jobs cancel.
 update fourthdown_private.alert_queue set status='processing',attempts=5,locked_until=now()-interval '1 second' where user_id=uid and payload->>'kind'='weekly';
 perform fourthdown_private.alert_job('claim','{"channels":["email"]}');
 if not exists(select 1 from fourthdown_private.alert_queue where user_id=uid and payload->>'kind'='weekly' and status='failed') then raise exception 'exhausted lease not failed';end if;
 update fourthdown_private.alert_queue set status='pending',attempts=0,expires_at=now()-interval '1 second' where user_id=uid and payload->>'kind'='weekly';
 perform fourthdown_private.alert_job('claim','{"channels":["email"]}');
 if not exists(select 1 from fourthdown_private.alert_queue where user_id=uid and payload->>'kind'='weekly' and status='cancelled') then raise exception 'expired job not cancelled';end if;
 begin
  perform public.v16_alert_job(null,'status');raise exception 'null secret accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.v16_alert_job('invalid-audit-secret','status');raise exception 'wrong secret accepted';
 exception when insufficient_privilege then null;end;
 if has_schema_privilege('anon','fourthdown_private','USAGE') then raise exception 'private schema exposed';end if;
end $$;
select 'PASS: ingestion, dedupe, per-device delivery, lease fencing, retries, opt-out, weekly dedupe, secret guards, private access; all records rolled back' as result;
rollback;
