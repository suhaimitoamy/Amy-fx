-- Amy FX unified market/scalper backend.
-- One cron owns Twelve Data REST synchronization; all consumers read Supabase.

DO $$
DECLARE
  job_record record;
BEGIN
  FOR job_record IN
    SELECT jobid
    FROM cron.job
    WHERE command ILIKE '%/functions/v1/market-candles%'
       OR jobname IN ('amyfx-market-sync', 'amyfx-market-central-sync')
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'amyfx-market-central-sync',
  '*/3 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/market-candles?sync=1&symbol=XAU%2FUSD&interval=1min',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);

DO $$
DECLARE
  job_record record;
BEGIN
  FOR job_record IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('amyfx-preview-scalper-engine', 'amyfx-scalper-engine-unified')
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'amyfx-scalper-engine-unified',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/scalper-engine',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);

UPDATE public.amyfx_preview_scalper_setups
SET
  status = 'CANCELLED',
  recommendation_status = 'RETIRED',
  notification_enabled = false,
  exit_time = COALESCE(exit_time, EXTRACT(EPOCH FROM now())::bigint),
  updated_at = now(),
  quality = COALESCE(quality, '{}'::jsonb) || jsonb_build_object(
    'retired_by', 'amyfx_unified_market_scalper_20260731',
    'retirement_reason', 'Engine atau driver legacy tidak lagi menjadi otoritas eksekusi.'
  )
WHERE status IN ('WAITING_TRIGGER', 'WAITING_NEXT_OPEN', 'ENTRY_READY', 'ACTIVE', 'BE_ACTIVE')
  AND (
    engine_version IS DISTINCT FROM 'amyfx-preview-scalper-multidriver-v2.0'
    OR driver_id IS NULL
    OR COALESCE(schema_version, 1) < 2
  );

CREATE INDEX IF NOT EXISTS amyfx_scalper_current_engine_active_idx
  ON public.amyfx_preview_scalper_setups (engine_version, status, signal_candle_close_time DESC);
