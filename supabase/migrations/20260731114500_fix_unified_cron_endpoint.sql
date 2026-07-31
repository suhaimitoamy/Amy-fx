-- Correct the unified cron jobs for projects whose Vault does not contain
-- supabase_url / supabase_service_role_key. Both target Edge Functions are
-- intentionally deployed with verify_jwt=false; they expose only their narrow
-- server-side jobs and do not return secrets.

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('amyfx-market-central-sync', 'amyfx-scalper-engine-unified')
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$$;

SELECT cron.schedule(
  'amyfx-market-central-sync',
  '*/3 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/market-candles?symbol=XAU%2FUSD&interval=1min&outputsize=2000',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);

SELECT cron.schedule(
  'amyfx-scalper-engine-unified',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/scalper-engine',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
