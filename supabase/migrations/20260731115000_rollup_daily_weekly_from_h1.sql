-- PostgREST may cap one candle query at 1,000 rows. That is sufficient for
-- intraday aggregation, but not for a full M1 day. D1 is therefore rolled up
-- from H1, which is itself produced from the single central M1 ingestion path.
-- W1 is rolled up from D1. No additional provider request is introduced.

CREATE OR REPLACE FUNCTION public.amyfx_refresh_daily_weekly_from_h1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_rows integer := 0;
  weekly_rows integer := 0;
BEGIN
  WITH h1 AS (
    SELECT
      symbol,
      date_trunc('day', to_timestamp(open_time) AT TIME ZONE 'UTC') AS day_utc,
      extract(dow FROM to_timestamp(open_time) AT TIME ZONE 'UTC')::integer AS dow,
      open_time,
      open,
      high,
      low,
      close,
      COALESCE(volume_tick, 0)::bigint AS volume_tick
    FROM public.candles
    WHERE symbol = 'XAU/USD'
      AND timeframe = 'H1'
      AND is_closed = true
  ), grouped AS (
    SELECT
      symbol,
      day_utc,
      dow,
      count(*)::integer AS bar_count,
      min(open_time) AS first_open_time,
      max(open_time) AS last_open_time,
      (array_agg(open ORDER BY open_time ASC))[1] AS day_open,
      max(high) AS day_high,
      min(low) AS day_low,
      (array_agg(close ORDER BY open_time DESC))[1] AS day_close,
      sum(volume_tick)::bigint AS day_volume
    FROM h1
    GROUP BY symbol, day_utc, dow
  ), complete_days AS (
    SELECT *
    FROM grouped
    WHERE (
      day_utc < date_trunc('day', now() AT TIME ZONE 'UTC')
      OR (
        day_utc = date_trunc('day', now() AT TIME ZONE 'UTC')
        AND dow = 5
        AND extract(hour FROM now() AT TIME ZONE 'UTC') >= 22
      )
    )
    AND (
      (dow = 0 AND bar_count = 2
        AND first_open_time = extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint + 22 * 3600
        AND last_open_time = extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint + 23 * 3600)
      OR
      (dow BETWEEN 1 AND 4 AND bar_count = 24
        AND first_open_time = extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint
        AND last_open_time = extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint + 23 * 3600)
      OR
      (dow = 5 AND bar_count = 22
        AND first_open_time = extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint
        AND last_open_time = extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint + 21 * 3600)
    )
  )
  INSERT INTO public.candles (
    symbol, timeframe, open_time, close_time,
    open, high, low, close, volume_tick, is_closed
  )
  SELECT
    symbol,
    'D1',
    extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint,
    extract(epoch FROM (day_utc AT TIME ZONE 'UTC'))::bigint + 86400,
    day_open, day_high, day_low, day_close, day_volume, true
  FROM complete_days
  ON CONFLICT (symbol, timeframe, open_time)
  DO UPDATE SET
    close_time = EXCLUDED.close_time,
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume_tick = EXCLUDED.volume_tick,
    is_closed = true;

  GET DIAGNOSTICS daily_rows = ROW_COUNT;

  WITH d1 AS (
    SELECT
      symbol,
      open_time,
      open,
      high,
      low,
      close,
      COALESCE(volume_tick, 0)::bigint AS volume_tick,
      extract(dow FROM to_timestamp(open_time) AT TIME ZONE 'UTC')::integer AS dow,
      CASE
        WHEN extract(dow FROM to_timestamp(open_time) AT TIME ZONE 'UTC')::integer = 0
          THEN date_trunc('week', to_timestamp(open_time) AT TIME ZONE 'UTC') + interval '7 days'
        ELSE date_trunc('week', to_timestamp(open_time) AT TIME ZONE 'UTC')
      END AS week_utc
    FROM public.candles
    WHERE symbol = 'XAU/USD'
      AND timeframe = 'D1'
      AND is_closed = true
      AND extract(dow FROM to_timestamp(open_time) AT TIME ZONE 'UTC')::integer <> 6
  ), complete_weeks AS (
    SELECT
      symbol,
      week_utc,
      (array_agg(open ORDER BY open_time ASC))[1] AS week_open,
      max(high) AS week_high,
      min(low) AS week_low,
      (array_agg(close ORDER BY open_time DESC))[1] AS week_close,
      sum(volume_tick)::bigint AS week_volume
    FROM d1
    GROUP BY symbol, week_utc
    HAVING count(*) FILTER (WHERE dow BETWEEN 1 AND 5) = 5
       AND count(*) FILTER (WHERE dow = 5) = 1
  )
  INSERT INTO public.candles (
    symbol, timeframe, open_time, close_time,
    open, high, low, close, volume_tick, is_closed
  )
  SELECT
    symbol,
    'W1',
    extract(epoch FROM (week_utc AT TIME ZONE 'UTC'))::bigint,
    extract(epoch FROM (week_utc AT TIME ZONE 'UTC'))::bigint + 604800,
    week_open, week_high, week_low, week_close, week_volume, true
  FROM complete_weeks
  ON CONFLICT (symbol, timeframe, open_time)
  DO UPDATE SET
    close_time = EXCLUDED.close_time,
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume_tick = EXCLUDED.volume_tick,
    is_closed = true;

  GET DIAGNOSTICS weekly_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'daily_rows', daily_rows,
    'weekly_rows', weekly_rows,
    'source', 'H1_FROM_CENTRAL_M1'
  );
END;
$$;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'amyfx-market-central-sync'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$$;

SELECT cron.schedule(
  'amyfx-market-central-sync',
  '*/3 * * * *',
  $cron$
  SELECT public.amyfx_refresh_daily_weekly_from_h1();
  SELECT net.http_post(
    url := 'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/market-candles?symbol=XAU%2FUSD&interval=1min&outputsize=2000',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
