import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const TWELVEDATA_API_KEY = String(Deno.env.get("TWELVEDATA_API_KEY") || "");
const UPSTREAM_GATEWAY = String(
  Deno.env.get("AMYFX_UPSTREAM_MARKET_URL")
  || "https://amy-fx.vercel.app/api/twelvedata"
);

const PROVIDER_REFRESH_MS = 180_000;
const PROVIDER_OUTPUT_SIZE = 2_000;
const PROVIDER_MAX_LAG_SECONDS = 5 * 60;
const M1_DATABASE_WINDOW = 5_000;
const LOCK_TTL_SECONDS = 45;
const CLOSE_GRACE_SECONDS = 10;
const MAX_OUTPUT_SIZE = 5_000;

const INTERVALS: Record<string, { timeframe: string; seconds: number }> = {
  "1min": { timeframe: "M1", seconds: 60 },
  "5min": { timeframe: "M5", seconds: 300 },
  "15min": { timeframe: "M15", seconds: 900 },
  "30min": { timeframe: "M30", seconds: 1_800 },
  "1h": { timeframe: "H1", seconds: 3_600 },
  "4h": { timeframe: "H4", seconds: 14_400 },
  "1day": { timeframe: "D1", seconds: 86_400 },
  "1week": { timeframe: "W1", seconds: 604_800 },
};

const STANDARD_M1_TARGETS = ["5min", "15min", "30min", "1h"];
const activeSyncs = new Map<string, Promise<SyncResult>>();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json; charset=utf-8",
};

type CandleRow = {
  symbol: string;
  timeframe: string;
  open_time: number;
  close_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_tick: number;
  is_closed: boolean;
};

type QuoteRow = {
  symbol: string;
  price: number;
  provider_open_time: number;
  provider_datetime: string | null;
  captured_at: string;
  source: string;
};

type ProviderBatch = {
  rows: CandleRow[];
  transport: "direct" | "gateway";
  latestClosedOpenTime: number;
};

type SyncResult = {
  synced: boolean;
  source: string;
  marketOpen: boolean;
  latestOpenTime: number | null;
  providerRows: number;
  aggregateRows: number;
  providerTransport?: string;
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...extra },
  });
}

function dbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Accept: "application/json",
    ...extra,
  };
}

function parseSize(value: string | null) {
  const parsed = Number.parseInt(String(value || "300"), 10);
  return Math.min(
    Math.max(Number.isFinite(parsed) ? parsed : 300, 1),
    MAX_OUTPUT_SIZE,
  );
}

function parseUtcSeconds(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 10_000_000_000
      ? Math.floor(numeric / 1_000)
      : Math.floor(numeric);
  }
  const text = String(value || "").trim();
  if (!text) return 0;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(text)
    ? text
    : `${text.replace(" ", "T")}Z`;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds)
    ? Math.floor(milliseconds / 1_000)
    : 0;
}

function utcDayOpen(seconds: number) {
  const date = new Date(seconds * 1_000);
  return Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
  ) / 1_000);
}

function utcWeekOpen(seconds: number) {
  const date = new Date(seconds * 1_000);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
  ) / 1_000);
}

function tradingWeekOpen(seconds: number) {
  const date = new Date(seconds * 1_000);
  const calendarWeek = utcWeekOpen(seconds);
  return date.getUTCDay() === 0
    ? calendarWeek + INTERVALS["1week"].seconds
    : calendarWeek;
}

function latestExpectedMarketMinuteOpen(now = Date.now()) {
  const safeSeconds = Math.floor(now / 1_000) - CLOSE_GRACE_SECONDS;
  const date = new Date(safeSeconds * 1_000);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 6 || (day === 0 && hour < 22)) {
    const daysBack = day === 6 ? 1 : 2;
    return Math.floor(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - daysBack,
      21,
      59,
      0,
    ) / 1_000);
  }
  if (day === 5 && hour >= 22) {
    return Math.floor(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      21,
      59,
      0,
    ) / 1_000);
  }
  return Math.floor(safeSeconds / 60) * 60 - 60;
}

function isMarketOpen(now = Date.now()) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 6) return false;
  if (day === 0 && hour < 22) return false;
  if (day === 5 && hour >= 22) return false;
  return true;
}

function expectedClosedDayOpen(now = Date.now()) {
  const seconds = Math.floor(now / 1_000);
  const date = new Date(now);
  const day = date.getUTCDay();
  const currentDay = utcDayOpen(seconds);
  if (day === 5 && date.getUTCHours() >= 22) return currentDay;
  if (day === 6) return currentDay - INTERVALS["1day"].seconds;
  if (day === 0) return currentDay - 2 * INTERVALS["1day"].seconds;
  return currentDay - INTERVALS["1day"].seconds;
}

function expectedClosedWeekOpen(now = Date.now()) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const currentCalendarWeek = utcWeekOpen(Math.floor(now / 1_000));
  const completedThisCalendarWeek = (
    (day === 5 && date.getUTCHours() >= 22)
    || day === 6
    || day === 0
  );
  return completedThisCalendarWeek
    ? currentCalendarWeek
    : currentCalendarWeek - INTERVALS["1week"].seconds;
}

function expectedClosedH4Open(now = Date.now()) {
  const latestMinute = latestExpectedMarketMinuteOpen(now);
  const latestDate = new Date(latestMinute * 1_000);
  const marketClosedAtFridayBoundary = latestDate.getUTCDay() === 5
    && latestDate.getUTCHours() === 21;
  if (marketClosedAtFridayBoundary) {
    return utcDayOpen(latestMinute) + 20 * 3_600;
  }
  const seconds = INTERVALS["4h"].seconds;
  return Math.floor((latestMinute + 60) / seconds) * seconds - seconds;
}

function expectedClosedOpenTime(interval: string, now = Date.now()) {
  const latestMinuteOpen = latestExpectedMarketMinuteOpen(now);
  if (interval === "1min") return latestMinuteOpen;
  if (interval === "4h") return expectedClosedH4Open(now);
  if (interval === "1day") return expectedClosedDayOpen(now);
  if (interval === "1week") return expectedClosedWeekOpen(now);
  const seconds = INTERVALS[interval].seconds;
  return Math.floor((latestMinuteOpen + 60) / seconds) * seconds - seconds;
}

function rowToValue(row: CandleRow) {
  return {
    datetime: new Date(row.open_time * 1_000).toISOString().replace(".000Z", "Z"),
    open: String(row.open),
    high: String(row.high),
    low: String(row.low),
    close: String(row.close),
    volume: String(row.volume_tick || 0),
  };
}

function valueToRow(
  value: Record<string, unknown>,
  symbol: string,
  interval: string,
): CandleRow | null {
  const config = INTERVALS[interval];
  const openTime = parseUtcSeconds(value.datetime);
  const open = Number(value.open);
  const high = Number(value.high);
  const low = Number(value.low);
  const close = Number(value.close);
  if (!openTime || ![open, high, low, close].every(Number.isFinite)) return null;
  return {
    symbol,
    timeframe: config.timeframe,
    open_time: openTime,
    close_time: openTime + config.seconds,
    open,
    high,
    low,
    close,
    volume_tick: Math.max(0, Math.trunc(Number(value.volume || 0) || 0)),
    is_closed: true,
  };
}

function dedupeRows(rows: CandleRow[]) {
  const unique = new Map<string, CandleRow>();
  for (const row of rows) {
    if (
      !row
      || !row.symbol
      || !row.timeframe
      || !Number.isFinite(row.open_time)
      || row.open_time <= 0
    ) continue;
    unique.set(`${row.symbol}|${row.timeframe}|${row.open_time}`, row);
  }
  return [...unique.values()].sort((a, b) => b.open_time - a.open_time);
}

async function readRows(
  symbol: string,
  interval: string,
  limit: number,
): Promise<CandleRow[]> {
  const timeframe = INTERVALS[interval].timeframe;
  const query = new URLSearchParams({
    select: "symbol,timeframe,open_time,close_time,open,high,low,close,volume_tick,is_closed",
    symbol: `eq.${symbol}`,
    timeframe: `eq.${timeframe}`,
    is_closed: "eq.true",
    order: "open_time.desc",
    limit: String(Math.min(Math.max(limit, 1), MAX_OUTPUT_SIZE)),
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/candles?${query}`, {
    headers: dbHeaders(),
  });
  if (!response.ok) throw new Error(`database_read_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? dedupeRows(rows as CandleRow[]) : [];
}

async function upsertRows(rows: CandleRow[]) {
  const cleanRows = dedupeRows(rows);
  if (!cleanRows.length) return 0;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/candles?on_conflict=symbol,timeframe,open_time`,
    {
      method: "POST",
      headers: dbHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(cleanRows),
    },
  );
  if (!response.ok) {
    throw new Error(`database_write_${response.status}:${(await response.text()).slice(0, 180)}`);
  }
  return cleanRows.length;
}

async function readQuote(symbol: string): Promise<QuoteRow | null> {
  const query = new URLSearchParams({
    select: "symbol,price,provider_open_time,provider_datetime,captured_at,source",
    symbol: `eq.${symbol}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/market_quotes?${query}`, {
    headers: dbHeaders(),
  });
  if (!response.ok) throw new Error(`quote_read_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertQuote(symbol: string, row: CandleRow, transport: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/market_quotes?on_conflict=symbol`,
    {
      method: "POST",
      headers: dbHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        symbol,
        price: row.close,
        provider_open_time: row.open_time,
        provider_datetime: new Date(row.open_time * 1_000).toISOString(),
        captured_at: new Date().toISOString(),
        source: `twelvedata-rest-central-sync-${transport}`,
      }),
    },
  );
  if (!response.ok) throw new Error(`quote_write_${response.status}`);
}

async function claimLock(lockKey: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_market_sync`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      p_lock_key: lockKey,
      p_ttl_seconds: LOCK_TTL_SECONDS,
    }),
  });
  if (!response.ok) throw new Error(`lock_claim_${response.status}`);
  return Boolean(await response.json());
}

async function releaseLock(lockKey: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/release_market_sync`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_lock_key: lockKey }),
  }).catch(() => null);
}

function quoteFresh(quote: QuoteRow | null, expected: number) {
  if (!quote) return false;
  const capturedAt = Date.parse(String(quote.captured_at || ""));
  return Number.isFinite(capturedAt)
    && Date.now() - capturedAt < PROVIDER_REFRESH_MS
    && Number(quote.provider_open_time || 0) >= expected - PROVIDER_MAX_LAG_SECONDS;
}

async function fetchProvider(symbol: string): Promise<ProviderBatch> {
  const query = new URLSearchParams({
    symbol,
    interval: "1min",
    outputsize: String(PROVIDER_OUTPUT_SIZE),
    timezone: "UTC",
  });
  const transport: ProviderBatch["transport"] = TWELVEDATA_API_KEY
    ? "direct"
    : "gateway";
  let url = `${UPSTREAM_GATEWAY}?${query}`;
  if (TWELVEDATA_API_KEY) {
    query.set("apikey", TWELVEDATA_API_KEY);
    url = `https://api.twelvedata.com/time_series?${query}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const payload = await response.json();
    if (payload?.status === "error" || !Array.isArray(payload?.values)) {
      throw new Error(payload?.message || "provider_invalid_response");
    }

    const expected = expectedClosedOpenTime("1min");
    const rows = dedupeRows(
      payload.values
        .map((value: Record<string, unknown>) => valueToRow(value, symbol, "1min"))
        .filter((row: CandleRow | null): row is CandleRow => Boolean(row))
        .filter((row: CandleRow) => row.open_time <= expected),
    );
    const latestClosedOpenTime = Number(rows[0]?.open_time || 0);
    if (!latestClosedOpenTime) throw new Error("provider_no_closed_m1_rows");
    if (latestClosedOpenTime < expected - PROVIDER_MAX_LAG_SECONDS) {
      throw new Error(
        `provider_data_stale:${transport}:latest=${latestClosedOpenTime}:expected=${expected}`,
      );
    }
    return { rows, transport, latestClosedOpenTime };
  } finally {
    clearTimeout(timeout);
  }
}

function aggregateStandardRows(
  m1Rows: CandleRow[],
  symbol: string,
  interval: string,
) {
  const seconds = INTERVALS[interval].seconds;
  const expectedCount = Math.floor(seconds / 60);
  const expectedLatest = expectedClosedOpenTime(interval);
  const groups = new Map<number, CandleRow[]>();
  for (const row of dedupeRows(m1Rows)) {
    const bucket = Math.floor(row.open_time / seconds) * seconds;
    if (bucket > expectedLatest) continue;
    const group = groups.get(bucket) || [];
    group.push(row);
    groups.set(bucket, group);
  }

  const output: CandleRow[] = [];
  for (const [bucket, raw] of groups.entries()) {
    const group = dedupeRows(raw).sort((a, b) => a.open_time - b.open_time);
    if (group.length !== expectedCount) continue;
    if (
      group[0]?.open_time !== bucket
      || group.at(-1)?.open_time !== bucket + seconds - 60
      || group.some((row, index) => row.open_time !== bucket + index * 60)
    ) continue;
    output.push({
      symbol,
      timeframe: INTERVALS[interval].timeframe,
      open_time: bucket,
      close_time: bucket + seconds,
      open: group[0].open,
      high: Math.max(...group.map((row) => row.high)),
      low: Math.min(...group.map((row) => row.low)),
      close: group.at(-1)!.close,
      volume_tick: group.reduce((sum, row) => sum + Number(row.volume_tick || 0), 0),
      is_closed: true,
    });
  }
  return dedupeRows(output);
}

function h4MinuteBounds(bucket: number) {
  const date = new Date(bucket * 1_000);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 0 && hour === 20) {
    return { start: bucket + 2 * 3_600, end: bucket + 4 * 3_600 - 60, count: 120 };
  }
  if (day === 5 && hour === 20) {
    return { start: bucket, end: bucket + 2 * 3_600 - 60, count: 120 };
  }
  return { start: bucket, end: bucket + 4 * 3_600 - 60, count: 240 };
}

function aggregateH4Rows(m1Rows: CandleRow[], symbol: string) {
  const interval = "4h";
  const seconds = INTERVALS[interval].seconds;
  const expectedLatest = expectedClosedOpenTime(interval);
  const groups = new Map<number, CandleRow[]>();
  for (const row of dedupeRows(m1Rows)) {
    const bucket = Math.floor(row.open_time / seconds) * seconds;
    if (bucket > expectedLatest) continue;
    const group = groups.get(bucket) || [];
    group.push(row);
    groups.set(bucket, group);
  }

  const output: CandleRow[] = [];
  for (const [bucket, raw] of groups.entries()) {
    const bounds = h4MinuteBounds(bucket);
    const group = dedupeRows(raw)
      .filter((row) => row.open_time >= bounds.start && row.open_time <= bounds.end)
      .sort((a, b) => a.open_time - b.open_time);
    if (
      group.length !== bounds.count
      || group[0]?.open_time !== bounds.start
      || group.at(-1)?.open_time !== bounds.end
      || group.some((row, index) => row.open_time !== bounds.start + index * 60)
    ) continue;
    output.push({
      symbol,
      timeframe: "H4",
      open_time: bucket,
      close_time: bucket + seconds,
      open: group[0].open,
      high: Math.max(...group.map((row) => row.high)),
      low: Math.min(...group.map((row) => row.low)),
      close: group.at(-1)!.close,
      volume_tick: group.reduce((sum, row) => sum + Number(row.volume_tick || 0), 0),
      is_closed: true,
    });
  }
  return dedupeRows(output);
}

function dailyMinuteBounds(bucket: number) {
  const day = new Date(bucket * 1_000).getUTCDay();
  if (day === 0) {
    return { start: bucket + 22 * 3_600, end: bucket + 86_400 - 60, count: 120 };
  }
  if (day === 5) {
    return { start: bucket, end: bucket + 22 * 3_600 - 60, count: 1_320 };
  }
  if (day === 6) return { start: bucket, end: bucket, count: 0 };
  return { start: bucket, end: bucket + 86_400 - 60, count: 1_440 };
}

function aggregateDailyRows(m1Rows: CandleRow[], symbol: string) {
  const expectedLatest = expectedClosedOpenTime("1day");
  const groups = new Map<number, CandleRow[]>();
  for (const row of dedupeRows(m1Rows)) {
    const bucket = utcDayOpen(row.open_time);
    if (bucket > expectedLatest) continue;
    const group = groups.get(bucket) || [];
    group.push(row);
    groups.set(bucket, group);
  }

  const output: CandleRow[] = [];
  for (const [bucket, raw] of groups.entries()) {
    const bounds = dailyMinuteBounds(bucket);
    if (!bounds.count) continue;
    const group = dedupeRows(raw)
      .filter((row) => row.open_time >= bounds.start && row.open_time <= bounds.end)
      .sort((a, b) => a.open_time - b.open_time);
    if (
      group.length !== bounds.count
      || group[0]?.open_time !== bounds.start
      || group.at(-1)?.open_time !== bounds.end
      || group.some((row, index) => row.open_time !== bounds.start + index * 60)
    ) continue;
    output.push({
      symbol,
      timeframe: "D1",
      open_time: bucket,
      close_time: bucket + INTERVALS["1day"].seconds,
      open: group[0].open,
      high: Math.max(...group.map((row) => row.high)),
      low: Math.min(...group.map((row) => row.low)),
      close: group.at(-1)!.close,
      volume_tick: group.reduce((sum, row) => sum + Number(row.volume_tick || 0), 0),
      is_closed: true,
    });
  }
  return dedupeRows(output);
}

function aggregateWeeklyRows(dailyRows: CandleRow[], symbol: string) {
  const expectedLatest = expectedClosedOpenTime("1week");
  const groups = new Map<number, CandleRow[]>();
  for (const row of dedupeRows(dailyRows)) {
    const bucket = tradingWeekOpen(row.open_time);
    if (bucket > expectedLatest) continue;
    const group = groups.get(bucket) || [];
    group.push(row);
    groups.set(bucket, group);
  }

  const output: CandleRow[] = [];
  for (const [bucket, raw] of groups.entries()) {
    const group = dedupeRows(raw)
      .filter((row) => new Date(row.open_time * 1_000).getUTCDay() !== 6)
      .sort((a, b) => a.open_time - b.open_time);
    const weekdays = group.filter((row) => {
      const day = new Date(row.open_time * 1_000).getUTCDay();
      return day >= 1 && day <= 5;
    });
    if (weekdays.length < 5) continue;
    output.push({
      symbol,
      timeframe: "W1",
      open_time: bucket,
      close_time: bucket + INTERVALS["1week"].seconds,
      open: group[0].open,
      high: Math.max(...group.map((row) => row.high)),
      low: Math.min(...group.map((row) => row.low)),
      close: group.at(-1)!.close,
      volume_tick: group.reduce((sum, row) => sum + Number(row.volume_tick || 0), 0),
      is_closed: true,
    });
  }
  return dedupeRows(output);
}

async function aggregateAndStore(symbol: string) {
  const m1Rows = await readRows(symbol, "1min", M1_DATABASE_WINDOW);
  let count = 0;
  for (const interval of STANDARD_M1_TARGETS) {
    count += await upsertRows(aggregateStandardRows(m1Rows, symbol, interval));
  }
  count += await upsertRows(aggregateH4Rows(m1Rows, symbol));
  count += await upsertRows(aggregateDailyRows(m1Rows, symbol));
  const dailyRows = await readRows(symbol, "1day", 400);
  count += await upsertRows(aggregateWeeklyRows(dailyRows, symbol));
  return count;
}

async function needsClosedMarketAggregation(symbol: string) {
  const [h4, daily, weekly] = await Promise.all([
    readRows(symbol, "4h", 1),
    readRows(symbol, "1day", 1),
    readRows(symbol, "1week", 1),
  ]);
  return Number(h4[0]?.open_time || 0) < expectedClosedOpenTime("4h")
    || Number(daily[0]?.open_time || 0) < expectedClosedOpenTime("1day")
    || Number(weekly[0]?.open_time || 0) < expectedClosedOpenTime("1week");
}

async function syncM1(symbol: string): Promise<SyncResult> {
  const marketOpen = isMarketOpen();
  const rowsBefore = await readRows(symbol, "1min", 2);
  if (!marketOpen) {
    const aggregateRows = await needsClosedMarketAggregation(symbol)
      ? await aggregateAndStore(symbol)
      : 0;
    return {
      synced: false,
      source: "supabase-market-closed",
      marketOpen,
      latestOpenTime: Number(rowsBefore[0]?.open_time || 0) || null,
      providerRows: 0,
      aggregateRows,
    };
  }

  const expected = expectedClosedOpenTime("1min");
  const quote = await readQuote(symbol);
  if (
    quoteFresh(quote, expected)
    && Number(rowsBefore[0]?.open_time || 0) >= expected - PROVIDER_MAX_LAG_SECONDS
  ) {
    return {
      synced: false,
      source: "supabase-central-cache",
      marketOpen,
      latestOpenTime: Number(rowsBefore[0]?.open_time || 0) || null,
      providerRows: 0,
      aggregateRows: 0,
    };
  }

  const lockKey = `${symbol}:CENTRAL_M1_SYNC_V3`;
  if (!(await claimLock(lockKey))) {
    const current = await readRows(symbol, "1min", 2);
    return {
      synced: false,
      source: "supabase-central-sync-busy",
      marketOpen,
      latestOpenTime: Number(current[0]?.open_time || 0) || null,
      providerRows: 0,
      aggregateRows: 0,
    };
  }

  try {
    const refreshedRows = await readRows(symbol, "1min", 2);
    const refreshedQuote = await readQuote(symbol);
    if (
      quoteFresh(refreshedQuote, expected)
      && Number(refreshedRows[0]?.open_time || 0) >= expected - PROVIDER_MAX_LAG_SECONDS
    ) {
      return {
        synced: false,
        source: "supabase-central-cache-after-lock",
        marketOpen,
        latestOpenTime: Number(refreshedRows[0]?.open_time || 0) || null,
        providerRows: 0,
        aggregateRows: 0,
      };
    }

    const provider = await fetchProvider(symbol);
    await upsertRows(provider.rows);
    await upsertQuote(symbol, provider.rows[0], provider.transport);
    const aggregateRows = await aggregateAndStore(symbol);
    const latest = await readRows(symbol, "1min", 2);
    return {
      synced: true,
      source: "provider-central-sync",
      marketOpen,
      latestOpenTime: Number(latest[0]?.open_time || 0) || null,
      providerRows: provider.rows.length,
      aggregateRows,
      providerTransport: provider.transport,
    };
  } finally {
    await releaseLock(lockKey);
  }
}

async function centralSync(symbol: string) {
  let active = activeSyncs.get(symbol);
  if (!active) {
    active = syncM1(symbol);
    activeSyncs.set(symbol, active);
  }
  try {
    return await active;
  } finally {
    if (activeSyncs.get(symbol) === active) activeSyncs.delete(symbol);
  }
}

async function serveRead(symbol: string, interval: string, outputsize: number) {
  const rows = await readRows(symbol, interval, outputsize);
  if (!rows.length) {
    return json({
      status: "error",
      message: "market_data_unavailable",
      source: "supabase-empty",
    }, 503);
  }
  const expected = expectedClosedOpenTime(interval);
  const fresh = Number(rows[0]?.open_time || 0) >= expected;
  const marketOpen = isMarketOpen();
  const source = fresh
    ? (marketOpen ? "supabase-central-read" : "supabase-market-closed")
    : "supabase-stale";
  return json({
    status: "ok",
    meta: { symbol, interval },
    values: rows.slice(0, outputsize).map(rowToValue),
    source,
    amyfxCacheState: fresh
      ? "SUPABASE_CENTRAL_HIT"
      : "SUPABASE_STALE_FALLBACK",
    latestOpenTime: Number(rows[0]?.open_time || 0),
    expectedOpenTime: expected,
    marketOpen,
    closedOnly: true,
    providerTriggered: false,
  }, 200, {
    "Cache-Control": fresh
      ? "public, max-age=30, stale-while-revalidate=60"
      : "no-store",
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ status: "error", message: "database_not_configured" }, 503);
  }
  if (!["GET", "POST"].includes(request.method)) {
    return json({ status: "error", message: "method_not_allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const symbol = String(url.searchParams.get("symbol") || "XAU/USD").toUpperCase();
    const interval = String(url.searchParams.get("interval") || "15min").toLowerCase();
    const outputsize = parseSize(url.searchParams.get("outputsize"));
    if (symbol !== "XAU/USD") {
      return json({ status: "error", message: "symbol_not_allowed" }, 403);
    }
    if (!INTERVALS[interval]) {
      return json({ status: "error", message: "interval_not_allowed" }, 400);
    }

    const wantsSync = request.method === "POST" || url.searchParams.get("sync") === "1";
    if (wantsSync) {
      if (request.method !== "POST") {
        return json({ status: "error", message: "sync_requires_post" }, 405);
      }
      const result = await centralSync(symbol);
      return json({ status: "ok", mode: "central_sync", ...result }, 200, {
        "Cache-Control": "no-store",
      });
    }

    return await serveRead(symbol, interval, outputsize);
  } catch (error) {
    return json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    }, 502, { "Cache-Control": "no-store" });
  }
});
