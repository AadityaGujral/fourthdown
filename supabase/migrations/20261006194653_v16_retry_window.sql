-- Retain retries across the existing daily schedule.
alter table fourthdown_private.alert_queue alter column expires_at set default now()+interval '72 hours';
