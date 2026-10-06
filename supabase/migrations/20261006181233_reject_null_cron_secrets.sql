DO $repair$
DECLARE
  signature regprocedure;
  original text;
  repaired text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.delete_v15_push_subscription(text,bigint)'::regprocedure,
    'public.record_v14_email_delivery(text,uuid,text,text,text,text)'::regprocedure,
    'public.record_v15_push_delivery(text,uuid,bigint,text)'::regprocedure
  ]
  LOOP
    original := pg_get_functiondef(signature);
    repaired := replace(original,
      'if encode(extensions.digest(p_secret::bytea,''sha256''),''hex'') <>',
      'if encode(extensions.digest(p_secret::bytea,''sha256''),''hex'') IS DISTINCT FROM');
    IF repaired = original AND position('IS DISTINCT FROM' in original) = 0 THEN
      RAISE EXCEPTION 'Expected cron secret guard missing: %', signature;
    END IF;
    EXECUTE repaired;
  END LOOP;
END;
$repair$;
