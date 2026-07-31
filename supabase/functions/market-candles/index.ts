import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const TWELVEDATA_API_KEY = String(Deno.env.get("TWELVEDATA_API_KEY") || "");
const UPSTREAM_GATEWAY = String(Deno.env.get("AMYFX_UPSTREAM_MARKET_URL") || "https://amy-fx.vercel.app/api/twelvedata");

const PROVIDER_REFRESH_MS = 180_000;
const PROVIDER_OUTPUT_SIZE = 2_000;
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

const M1_AGGREGATE_TARGETS = ["5min", "15min", "30min", "1h", "4h", "1day"];
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

type SyncResult = {
  synced: boolean;
  source: string;
  marketOpen: boolean;
  latestOpenTime: number | null;
  providerRows: number;
  aggregateRows: number;
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, ...extra } });
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
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 300, 1), MAX_OUTPUT_SIZE);
}

function parseUtcSeconds(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric > 10_000_000_000 ? Math.floor(numeric / 1_000) : Math.floor(numeric);
  const text = String(value || "").trim();
  if (!text) return 0;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(" ", "T")}Z`;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1_000) : 0;
}

function latestExpectedMarketMinuteOpen(now = Date.now()) {
  const safeSeconds = Math.floor(now / 1_000) - CLOSE_GRACE_SECONDS;
  const date = new Date(safeSeconds * 1_000);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 6 || (day === 0 && hour < 22)) {
    const daysBack = day === 6 ? 1 : 2;
    const friday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysBack, 21, 59, 0));
    return Math.floor(friday.getTime() / 1_000);
  }
  if (day === 5 && hour >= 22) {
    return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 21, 59, 0) / 1_000);
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

function utcWeekOpen(seconds: number) {
  const date = new Date(seconds * 1_000);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday, 0, 0, 0) / 1_000);
}

function expectedClosedWeekOpen(now = Date.now()) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const currentCalendarWeek = utcWeekOpen(Math.floor(now / 1_000));
  const completedThisCalendarWeek = day === 5 && date.getUTCHours() >= 22
    || day === 6
    || day === 0;
  return completedThisCalendarWeek
    ? currentCalendarWeek
    : currentCalendarWeek - INTERVALS["1week"].seconds;
}

function expectedClosedOpenTime(interval: string, now = Date.now()) {
  const latestMinuteOpen = latestExpectedMarketMinuteOpen(now);
  if (interval === "1min") return latestMinuteOpen;
  if (interval === "1week") return expectedClosedWeekOpen(now);
  const seconds = INTERVALS[interval].seconds;
  return Math.floor((latestMinuteOpen + 60) / seconds) * seconds - seconds;
}

function rowToValue(row: CandleRow) {
  return {
    datetime: new Date(Number(row.open_time) * 1_000).toISOString().replace(".000Z", "Z"),
    open: String(row.open),
    high: String(row.high),
    low: String(row.low),
    close: String(row.close),
    volume: String(row.volume_tick || 0),
  };
}

function valueToRow(value: Record<string, unknown>, symbol: string, interval: string): CandleRow | null {
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
    if (!row || !row.symbol || !row.timeframe || !Number.isFinite(Number(row.open_time)) || Number(row.open_time) <= 0) continue;
    unique.set(`${row.symbol}|${row.timeframe}|${Number(row.open_time)}`, row);
  }
  return [...unique.values()].sort((a, b) => Number(b.open_time) - Number(a.open_time));
}

async function readRows(symbol: string, interval: string, limit: number): Promise<CandleRow[]> {
  const timeframe = INTERVALS[interval].timeframe;
  const query = new URLSearchParams({
    select: "symbol,timeframe,open_time,close_time,open,high,low,close,volume_tick,is_closed",
    symbol: `eq.${symbol}`,
    timeframe: `eq.${timeframe}`,
    is_closed: "eq.true",
    order: "open_time.desc",
    limit: String(Math.min(Math.max(limit, 1), MAX_OUTPUT_SIZE)),
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/candles?${query}`, { headers: dbHeaders() });
  if (!response.ok) throw new Error(`database_read_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? dedupeRows(rows as CandleRow[]) : [];
}

async function upsertRows(rows: CandleRow[]) {
  const cleanRows = dedupeRows(rows);
  if (!cleanRows.length) return 0;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/candles?on_conflict=symbol,timeframe,open_time`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(cleanRows),
  });
  if (!response.ok) throw new Error(`database_write_${response.status}:${(await response.text()).slice(0, 180)}`);
  return cleanRows.length;
}

async function readQuote(symbol: string): Promise<QuoteRow | null> {
  const query = new URLSearchParams({
    select: "symbol,price,provider_open_time,provider_datetime,captured_at,source",
    symbol: `eq.${symbol}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/market_quotes?${query}`, { headers: dbHeaders() });
  if (!response.ok) throw new Error(`quote_read_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertQuote(symbol: string, value: Record<string, unknown>) {
  const price = Number(value.price ?? value.close);
  if (!Number.isFinite(price) || price <= 0) return;
  const row = {
    symbol,
    price,
    provider_open_time: parseUtcSeconds(value.datetime),
    provider_datetime: String(value.datetime || "") || null,
    captured_at: new Date().toISOString(),
    source: "twelvedata-rest-central-sync",
  };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/market_quotes?on_conflict=symbol`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`quote_write_${response.status}`);
}

async function claimLock(lockKey: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_market_sync`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_lock_key: lockKey, p_ttl_seconds: LOCK_TTL_SECONDS }),
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

function quoteFresh(quote: QuoteRow | null) {
  if (!quote) return false;
  const capturedAt = Date.parse(String(quote.captured_at || ""));
  return Number.isFinite(capturedAt) && Date.now() - capturedAt < PROVIDER_REFRESH_MS;
}

async function fetchProvider(symbol: string) {
  const query = new URLSearchParams({ symbol, interval: "1min", outputsize: String(PROVIDER_OUTPUT_SIZE), timezone: "UTC" });
  let url = `${UPSTREAM_GATEWAY}?${query}`;
  if (TWELVEDATA_API_KEY) {
    query.set("apikey", TWELVEDATA_API_KEY);
    url = `https://api.twelvedata.com/time_series?${query}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const payload = await response.json();
    if (payload?.status === "error" || !Array.isArray(payload?.values)) throw new Error(payload?.message || "provider_invalid_response");
    return payload.values as Record<string, unknown>[];
  } finally {
    clearTimeout(timeout);
  }
}

function aggregateRows(m1Rows: CandleRow[], symbol: string, interval: string) {
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
  const aggregated: CandleRow[] = [];
  for (const [bucket, raw] of groups.entries()) {
    const group = dedupeRows(raw).sort((a, b) => a.open_time - b.open_time);
    if (group.length !== expectedCount) continue;
    if (group[0]?.open_time !== bucket || group.at(-1)?.open_time !== bucket + seconds - 60) continue;
    if (group.some((row, index) => row.open_time !== bucket + index * 60)) continue;
    aggregated.push({
      symbol,
      timeframe: INTERVALS[interval].timeframe,
      open_time: bucket,
      close_time: bucket + seconds,
      open: group[0].open,
      high: Math.max(...group.map((row) => row.high)),
      low: Math.min(...group.map((row) => row.low)),
      close: group.at(-1)!.close,
      volume_tick: group.reduce((total, row) => total + Number(row.volume_tick || 0), 0),
      is_closed: true,
    });
  }
  return dedupeRows(aggregated);
}

function aggregateWeeklyRows(dailyRows: CandleRow[], symbol: string) {
  const expectedLatest = expectedClosedOpenTime("1week");
  const groups = new Map<number, CandleRow[]>();
  for (const row of dedupeRows(dailyRows)) {
    const bucket = utcWeekOpen(row.open_time);
    if (bucket > expectedLatest) continue;
    const group = groups.get(bucket) || [];
    group.push(row);
    groups.set(bucket, group);
  }
  const aggregated: CandleRow[] = [];
  for (const [bucket, raw] of groups.entries()) {
    const group = dedupeRows(raw).sort((a, b) => a.open_time - b.open_time);
    const tradingDays = group.filter(row => {
      const day = new Date(row.open_time * 1_000).getUTCDay();
      return day >= 1 && day <= 5;
    });
    if (tradingDays.length < 5) continue;
    aggregated.push({
      symbol,
      timeframe: "W1",
      open_time: bucket,
      close_time: bucket + INTERVALS["1week"].seconds,
      open: tradingDays[0].open,
      high: Math.max(...tradingDays.map(row => row.high)),
      low: Math.min(...tradingDays.map(row => row.low)),
      close: tradingDays.at(-1)!.close,
      volume_tick: tradingDays.reduce((total, row) => total + Number(row.volume_tick || 0), 0),
      is_closed: true,
    });
  }
  return dedupeRows(aggregated);
}

async function aggregateAndStore(symbol: string) {
  const m1Rows = await readRows(symbol, "1min", PROVIDER_OUTPUT_SIZE);
  let count = 0;
  for (const interval of M1_AGGREGATE_TARGETS) count += await upsertRows(aggregateRows(m1Rows, symbol, interval));
  const dailyRows = await readRows(symbol, "1day", 400);
  count += await upsertRows(aggregateWeeklyRows(dailyRows, symbol));
  return count;
}

async function syncM1(symbol: string): Promise<SyncResult> {
  const marketOpen = isMarketOpen();
  const rowsBefore = await readRows(symbol, "1min", 2);
  if (!marketOpen) {
    return {
      synced: false,
      source: "supabase-market-closed",
      marketOpen,
      latestOpenTime: Number(rowsBefore[0]?.open_time || 0) || null,
      providerRows: 0,
      aggregateRows: 0,
    };
  }

  const quote = await readQuote(symbol);
  const expected = expectedClosedOpenTime("1min");
  if (quoteFresh(quote) && Number(rowsBefore[0]?.open_time || 0) >= expected) {
    return {
      synced: false,
      source: "supabase-central-cache",
      marketOpen,
      latestOpenTime: Number(rowsBefore[0]?.open_time || 0) || null,
      providerRows: 0,
      aggregateRows: 0,
    };
  }

  const lockKey = `${symbol}:CENTRAL_M1_SYNC_V2`;
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
    const refreshedQuote = await readQuote(symbol);
    const refreshedRows = await readRows(symbol, "1min", 2);
    if (quoteFresh(refreshedQuote) && Number(refreshedRows[0]?.open_time || 0) >= expected) {
      return {
        synced: false,
        source: "supabase-central-cache-after-lock",
        marketOpen,
        latestOpenTime: Number(refreshedRows[0]?.open_time || 0) || null,
        providerRows: 0,
        aggregateRows: 0,
      };
    }

    const values = await fetchProvider(symbol);
    const normalized = dedupeRows(values.map((value) => valueToRow(value, symbol, "1min")).filter((row): row is CandleRow => Boolean(row)));
    const closedRows = normalized.filter((row) => row.open_time <= expected);
    await upsertRows(closedRows);
    if (values[0]) await upsertQuote(symbol, values[0]);
    const aggregateRows = await aggregateAndStore(symbol);
    const latest = await readRows(symbol, "1min", 2);
    return {
      synced: true,
      source: "provider-central-sync",
      marketOpen,
      latestOpenTime: Number(latest[0]?.open_time || 0) || null,
      providerRows: closedRows.length,
      aggregateRows,
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
  if (!rows.length) return json({ status: "error", message: "market_data_unavailable", source: "supabase-empty" }, 503);
  const expected = expectedClosedOpenTime(interval);
  const fresh = Number(rows[0]?.open_time || 0) >= expected;
  const marketOpen = isMarketOpen();
  const source = fresh ? (marketOpen ? "supabase-central-read" : "supabase-market-closed") : "supabase-stale";
  return json({
    status: "ok",
    meta: { symbol, interval },
    values: rows.slice(0, outputsize).map(rowToValue),
    source,
    amyfxCacheState: fresh ? "SUPABASE_CENTRAL_HIT" : "SUPABASE_STALE_FALLBACK",
    latestOpenTime: Number(rows[0]?.open_time || 0),
    expectedOpenTime: expected,
    marketOpen,
    closedOnly: true,
    providerTriggered: false,
  }, 200, { "Cache-Control": fresh ? "public, max-age=30, stale-while-revalidate=60" : "no-store" });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ status: "error", message: "database_not_configured" }, 503);
  if (!["GET", "POST"].includes(request.method)) return json({ status: "error", message: "method_not_allowed" }, 405);

  try {
    const url = new URL(request.url);
    const symbol = String(url.searchParams.get("symbol") || "XAU/USD").toUpperCase();
    const interval = String(url.searchParams.get("interval") || "15min").toLowerCase();
    const outputsize = parseSize(url.searchParams.get("outputsize"));
    if (symbol !== "XAU/USD") return json({ status: "error", message: "symbol_not_allowed" }, 403);
    if (!INTERVALS[interval]) return json({ status: "error", message: "interval_not_allowed" }, 400);

    const wantsSync = request.method === "POST" || url.searchParams.get("sync") === "1";
    if (wantsSync) {
      if (request.method !== "POST") return json({ status: "error", message: "sync_requires_post" }, 405);
      const result = await centralSync(symbol);
      return json({ status: "ok", mode: "central_sync", ...result }, 200, { "Cache-Control": "no-store" });
    }

    return await serveRead(symbol, interval, outputsize);
  } catch (error) {
    return json({ status: "error", message: error instanceof Error ? error.message : String(error) }, 502);
  }
});
