import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname, '../app/src/main/assets');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

let localCalendarCache = null;
let localCalendarCachedAt = 0;

const CANDLE_CACHE_FILE = path.resolve(ROOT_DIR, 'data/candle_cache.json');
const localCandleCache = new Map();
let lastScalperSetupsPayload = null;

async function getLocalSqliteCandles(interval, limit = 300) {
  try {
    const tfMap = { '1min': 'M1', '5min': 'M5', '15min': 'M15', '30min': 'M30', '1h': 'H1', '4h': 'H4', '1day': 'D1' };
    const tfStr = tfMap[interval] || interval.toUpperCase();
    const script = `
import sqlite3, json
try:
    conn = sqlite3.connect('/root/amy-market-data/xauusd_bot.sqlite')
    cur = conn.cursor()
    rows = cur.execute('''
        SELECT open_time, open, high, low, close, volume_tick
        FROM candles
        WHERE timeframe = ?
        ORDER BY open_time DESC
        LIMIT ?
    ''', ('${tfStr}', ${limit})).fetchall()
    values = []
    for r in rows:
        values.append({
            'datetime': r[0].replace(' ', 'T') + 'Z',
            'open': str(r[1]),
            'high': str(r[2]),
            'low': str(r[3]),
            'close': str(r[4]),
            'volume': str(r[5])
        })
    print(json.dumps({'status': 'ok', 'meta': {'symbol': 'XAU/USD', 'interval': '${interval}'}, 'values': values, 'source': 'local-sqlite'}))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;
    const { stdout } = await execFileAsync('python3', ['-c', script], { timeout: 3500 });
    const parsed = JSON.parse(stdout);
    if (parsed && parsed.status === 'ok' && Array.isArray(parsed.values) && parsed.values.length > 0) {
      return parsed;
    }
  } catch (_) {}
  return null;
}

const CANDLE_INTERVAL_SECONDS = {
  '1min': 60,
  '5min': 300,
  '15min': 900,
  '30min': 1800,
  '1h': 3600,
  '4h': 14400,
  '1day': 86400,
  '1week': 604800
};

function isWeekendClosure(timeSec) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short'
    }).formatToParts(new Date(timeSec * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const weekday = values.weekday, hour = Number(values.hour) + Number(values.minute) / 60;
    if (weekday === 'Sat') return true;
    if (weekday === 'Sun') return hour < 17;
    if (weekday === 'Fri') return hour >= 17;
    return false;
  } catch (_) {
    const d = new Date(timeSec * 1000), day = d.getUTCDay();
    return day === 6 || day === 0;
  }
}

function initLocalCandleCache() {
  try {
    const dataDir = path.dirname(CANDLE_CACHE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(CANDLE_CACHE_FILE)) {
      const raw = fs.readFileSync(CANDLE_CACHE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          if (value && value.data) {
            localCandleCache.set(key, value);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[serve-local] Gagal memuat candle_cache.json:', err.message);
  }
}
initLocalCandleCache();

function saveCandleCacheToFile() {
  try {
    const dataDir = path.dirname(CANDLE_CACHE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const obj = {};
    for (const [key, value] of localCandleCache.entries()) {
      obj[key] = value;
    }
    fs.writeFileSync(CANDLE_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('[serve-local] Gagal menyimpan candle_cache.json:', err.message);
  }
}

function getDefaultScalperContext() {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    ok: true,
    mode: 'market_context',
    context: {
      session: 'PASAR LOKAL (OFFLINE)',
      bias: 'NEUTRAL',
      regime: 'WAITING_DATA',
      phase: 'CONSOLIDATION',
      news: { status: 'SAFE', note: 'Mode lokal / cache offline' },
      h1: { highPattern: '—', lowPattern: '—', lastBreak: { type: 'none', level: null } },
      m15: { structure: 'NEUTRAL', lastBreak: { type: 'none', level: null }, poi: null },
      confluence: { score: 50, grade: 'C' },
      liquidity: [],
      volatility: { condition: 'NORMAL', atr: 2.5 }
    },
    primary: null,
    driverEvaluation: { drivers: [], sourceTime: nowSec },
    active: [],
    history: [],
    generatedAt: new Date(nowSec * 1000).toISOString()
  };
}

async function getLocalCalendarData() {
  const now = Date.now();
  if (localCalendarCache && now - localCalendarCachedAt < 3 * 60 * 1000) {
    return localCalendarCache;
  }

  // 1. Try Faireconomy with Chrome User-Agent
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    clearTimeout(timeout);
    if (res.ok) {
      const text = await res.text();
      if (!text.includes('Rate Limited') && text.trim().startsWith('[')) {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          localCalendarCache = data;
          localCalendarCachedAt = now;
          return data;
        }
      }
    }
  } catch (_) {}

  // 2. Fallback: Extract from live Telegram news feed via Vercel
  try {
    const newsRes = await fetch('https://amy-fx.vercel.app/api/news?limit=25');
    if (newsRes.ok) {
      const json = await newsRes.json();
      const events = [];
      const regex = /([A-Z]{3})\s*\|\s*([^\n\r]+)[\s\S]*?(?:Waktu|Time)\s*:\s*([^\n\r]+)[\s\S]*?(?:Efek|Effects?)\s*:\s*([^\n\r]+)[\s\S]*?(?:Sebelumnya|Previously)\s*:\s*([^\n\r]+)[\s\S]*?(?:Perkiraan|Forecast)\s*:\s*([^\n\r_]+)/gi;
      const seen = new Set();
      for (const item of (json.news || [])) {
        const text = (item.text || '') + '\n' + (item.textOriginal || '');
        let match;
        while ((match = regex.exec(text)) !== null) {
          const rawTitle = match[2].trim();
          const country = match[1].trim();
          const normKey = `${country}_${rawTitle.toLowerCase()}`;
          if (seen.has(normKey)) continue;
          seen.add(normKey);

          const rawTime = match[3].trim();
          const impactRaw = match[4].toLowerCase();
          const previous = match[5].trim();
          const forecast = match[6].trim();

          const baseDate = item.time ? new Date(item.time) : new Date();
          const ymd = !isNaN(baseDate.getTime()) ? baseDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          const dateStr = `${ymd}T${rawTime.length === 5 ? rawTime + ':00' : '12:00:00'}Z`;

          events.push({
            title: rawTitle,
            country,
            date: dateStr,
            impact: impactRaw.includes('tinggi') || impactRaw.includes('high') ? 'High' : 'Medium',
            forecast,
            previous,
            actual: '',
            source: 'telegram_news_feed'
          });
        }
      }
      if (events.length > 0) {
        localCalendarCache = events;
        localCalendarCachedAt = now;
        return events;
      }
    }
  } catch (_) {}

  return localCalendarCache || [];
}

const requestHandler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/api/fractal-audit' || pathname === '/api/fractal-advisor') {
      const bias = (parsedUrl.searchParams.get('bias') || 'BUY').toUpperCase();
      const barIdx = parsedUrl.searchParams.get('bar') || '-1';
      const sweep = parsedUrl.searchParams.get('sweep') || 'true';
      const ote = parsedUrl.searchParams.get('ote') || 'true';
      
      try {
        const scriptPath = '/sdcard/Download/lab backtest/amy_fractal_advisor.py';
        const { stdout } = await execFileAsync('python3', [
          scriptPath,
          '--audit-latest',
          '--json',
          '--bias', bias === 'SELL' ? 'SELL' : 'BUY',
          '--bar-idx', barIdx,
          '--sweep', sweep,
          '--ote', ote
        ], { timeout: 8000 });
        
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(stdout);
        return;
      } catch (err) {
        res.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Advisor run failed', details: err.message }));
        return;
      }
    }

    if (pathname === '/api/calendar') {
      const events = await getLocalCalendarData();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=180'
      });
      res.end(JSON.stringify(events));
      return;
    }

    if (pathname === '/api/candles') {
      try {
        const fileParam = parsedUrl.searchParams.get('file');
        const manifestParam = parsedUrl.searchParams.get('manifest');
        const localMonthlyDir = '/sdcard/Download/lab backtest/candles/monthly';
        const localManifest = '/sdcard/Download/lab backtest/candles/manifest_months.json';

        if ((manifestParam === '1' || manifestParam === 'true') && fs.existsSync(localManifest)) {
          const data = fs.readFileSync(localManifest, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          });
          res.end(data);
          return;
        }

        if (fileParam && fs.existsSync(path.join(localMonthlyDir, fileParam))) {
          const buf = fs.readFileSync(path.join(localMonthlyDir, fileParam));
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${fileParam}"`,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          res.end(buf);
          return;
        }

        const handler = (await import('../api/candles.js')).default;
        let statusCode = 200;
        const outHeaders = {};
        const fakeRes = {
          setHeader: (k, v) => { outHeaders[k] = v; },
          status: (c) => { statusCode = c; return fakeRes; },
          json: (d) => {
            outHeaders['Content-Type'] = 'application/json; charset=utf-8';
            res.writeHead(statusCode, outHeaders);
            res.end(JSON.stringify(d));
          },
          send: (b) => {
            res.writeHead(statusCode, outHeaders);
            res.end(b);
          }
        };
        const fakeReq = {
          method: req.method,
          query: Object.fromEntries(parsedUrl.searchParams.entries())
        };
        await handler(fakeReq, fakeRes);
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'candles_api_failed', details: err.message }));
        return;
      }
    }

    if (pathname === '/api/scalper-setups') {
      try {
        const handler = (await import('../api/scalper-setups.js')).default;
        let statusCode = 200;
        const outHeaders = {};
        let responseBody = null;
        const fakeRes = {
          setHeader: (k, v) => { outHeaders[k] = v; },
          status: (c) => { statusCode = c; return fakeRes; },
          json: (d) => {
            responseBody = d;
          },
          end: () => {}
        };
        await handler(req, fakeRes);
        if (statusCode === 200 && responseBody && responseBody.ok === true) {
          lastScalperSetupsPayload = responseBody;
          res.writeHead(200, { ...outHeaders, 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(responseBody));
          return;
        }
      } catch (e) {
        // Local handler failed
      }

      // Fallback to Vercel live
      try {
        const upstream = await fetch('https://amy-fx.vercel.app/api/scalper-setups', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        if (upstream.ok) {
          const data = await upstream.json();
          if (data && data.ok === true) {
            lastScalperSetupsPayload = data;
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(data));
            return;
          }
        }
      } catch (_) {}

      // Fallback: return last known good or default context
      const fallback = lastScalperSetupsPayload || getDefaultScalperContext();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-AmyFX-Fallback': 'IN_MEMORY_CONTEXT'
      });
      res.end(JSON.stringify(fallback));
      return;
    }

    if (pathname === '/api/twelvedata') {
      const symbol = (parsedUrl.searchParams.get('symbol') || 'XAU/USD').toUpperCase();
      const interval = (parsedUrl.searchParams.get('interval') || '15min').toLowerCase();
      const outputsize = parsedUrl.searchParams.get('outputsize') || '300';
      const cacheKey = `${symbol}_${interval}_${outputsize}`;
      const fallbackKey = `${symbol}_${interval}`;

      const intervalSec = CANDLE_INTERVAL_SECONDS[interval] || 60;
      const nowSec = Math.floor(Date.now() / 1000);
      const isWeekend = isWeekendClosure(nowSec);

      const reqOutputSize = Math.max(1, parseInt(outputsize, 10) || 300);

      // Check if cache has data and hasn't passed candle close time
      const exactCached = localCandleCache.get(cacheKey);
      const fbCached = localCandleCache.get(fallbackKey);
      const cached = (exactCached?.data?.values?.length >= Math.min(reqOutputSize, 45))
        ? exactCached
        : (fbCached?.data?.values?.length >= Math.min(reqOutputSize, 45) ? fbCached : exactCached || fbCached);
      if (cached && cached.data && Array.isArray(cached.data.values) && cached.data.values.length >= Math.min(reqOutputSize, 45)) {
        const cachedOpenSec = Number(cached.openSec || 0);
        const weekendFresh = isWeekend && cachedOpenSec > 0 && (nowSec - cachedOpenSec) <= 68 * 3600 && !isWeekendClosure(cachedOpenSec);
        const isFresh = weekendFresh || (!isWeekend && cached.closeSec && nowSec < cached.closeSec);
        if (isFresh) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'X-AmyFX-Market-Cache': 'LOCAL_CACHE_HIT',
            'Cache-Control': 'no-store'
          });
          res.end(cached.rawJson || JSON.stringify(cached.data));
          return;
        }
      }

      // If cache is expired or missing, fetch from upstream Vercel
      try {
        const isIntraday = !['1day', '1week'].includes(interval);
        const upstreamSize = (isWeekend && isIntraday)
          ? Math.max(reqOutputSize + 220, interval === '5min' ? 850 : interval === '1min' ? 1500 : 500)
          : reqOutputSize;
        const upstreamParams = new URLSearchParams(parsedUrl.searchParams);
        upstreamParams.set('outputsize', String(upstreamSize));
        const upstream = await fetch(`https://amy-fx.vercel.app/api/twelvedata?${upstreamParams.toString()}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(12000)
        });
        let dataText = await upstream.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch (_) {}

        if (parsed && Array.isArray(parsed.values) && isIntraday) {
          const cleanValues = parsed.values.filter(v => {
            if (v?.amyfxSyntheticCurrent) return false;
            const dt = v?.datetime;
            if (!dt) return false;
            const norm = dt.endsWith('Z') ? dt : dt.replace(' ', 'T') + 'Z';
            const ms = Date.parse(norm);
            if (!Number.isFinite(ms)) return false;
            return !isWeekendClosure(Math.floor(ms / 1000));
          }).slice(0, reqOutputSize);
          if (cleanValues.length > 0) {
            parsed.values = [{ ...cleanValues[0], amyfxSyntheticCurrent: true }, ...cleanValues];
            dataText = JSON.stringify(parsed);
          }
        }

        const is429 = upstream.status === 429 || (parsed && (parsed.status === 'error' && /429|rate limit/i.test(parsed.message || '')));

        let openSec = 0;
        if (parsed?.values?.[0]?.datetime) {
          const dt = parsed.values[0].datetime;
          const norm = dt.endsWith('Z') ? dt : dt.replace(' ', 'T') + 'Z';
          const ms = Date.parse(norm);
          if (Number.isFinite(ms)) openSec = Math.floor(ms / 1000);
        }

        const maxAllowedAge = isWeekend ? (72 * 3600) : 172800;
        const isUpstreamStale = Boolean(
          parsed?.staleFallback === true ||
          parsed?.rateLimited === true ||
          /stale/i.test(parsed?.source || '') ||
          (openSec > 0 && (nowSec - openSec) > maxAllowedAge)
        );

        const isValid = upstream.status === 200 && parsed && parsed.status !== 'error' && Array.isArray(parsed.values) && parsed.values.length > 0 && !isUpstreamStale;

        if (isValid) {
          const closeSec = openSec ? (openSec + intervalSec) : (Math.floor(nowSec / intervalSec) + 1) * intervalSec;
          const entry = {
            data: parsed,
            rawJson: dataText,
            storedAt: Date.now(),
            storedAtSec: nowSec,
            openSec,
            closeSec,
            symbol,
            interval,
            outputsize
          };
          localCandleCache.set(cacheKey, entry);
          const existingFbLen = localCandleCache.get(fallbackKey)?.data?.values?.length || 0;
          if (parsed.values.length >= existingFbLen) {
            localCandleCache.set(fallbackKey, entry);
          }
          saveCandleCacheToFile();

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'X-AmyFX-Market-Cache': 'UPSTREAM_FRESH',
            'Cache-Control': 'no-store'
          });
          res.end(dataText);
          return;
        }

        // Upstream failed or returned stale fallback / 429. Try local SQLite DB fallback!
        const sqliteCandles = await getLocalSqliteCandles(interval, parseInt(outputsize, 10) || 300);
        if (sqliteCandles && sqliteCandles.values && sqliteCandles.values.length > 0) {
          let sOpenSec = 0;
          const sDt = sqliteCandles.values[0]?.datetime;
          if (sDt) {
            const sMs = Date.parse(sDt);
            if (Number.isFinite(sMs)) sOpenSec = Math.floor(sMs / 1000);
          }
          const sCloseSec = sOpenSec ? (sOpenSec + intervalSec) : (Math.floor(nowSec / intervalSec) + 1) * intervalSec;
          const sEntry = {
            data: sqliteCandles,
            rawJson: JSON.stringify(sqliteCandles),
            storedAt: Date.now(),
            storedAtSec: nowSec,
            openSec: sOpenSec,
            closeSec: sCloseSec,
            symbol,
            interval,
            outputsize
          };
          localCandleCache.set(cacheKey, sEntry);
          localCandleCache.set(fallbackKey, sEntry);
          saveCandleCacheToFile();

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'X-AmyFX-Market-Cache': 'LOCAL_SQLITE_HIT',
            'Cache-Control': 'no-store'
          });
          res.end(JSON.stringify(sqliteCandles));
          return;
        }

        // If upstream returned 429 or rate limit or error, use local cached data if available
        if (cached && cached.data) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'X-AmyFX-Market-Cache': is429 ? 'RATE_LIMIT_FALLBACK' : 'STALE_FALLBACK',
            'Cache-Control': 'no-store'
          });
          res.end(cached.rawJson || JSON.stringify(cached.data));
          return;
        }

        res.writeHead(upstream.status === 429 ? 200 : upstream.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(dataText);
        return;
      } catch (err) {
        if (cached && cached.data) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'X-AmyFX-Market-Cache': 'OFFLINE_FALLBACK',
            'Cache-Control': 'no-store'
          });
          res.end(cached.rawJson || JSON.stringify(cached.data));
          return;
        }
        res.writeHead(502, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
        return;
      }
    }

    if (pathname === '/api/news') {
      try {
        const handler = (await import('../api/news.js')).default;
        const fakeReq = {
          ...req,
          query: Object.fromEntries(parsedUrl.searchParams.entries()),
          headers: req.headers,
          method: req.method
        };
        let statusCode = 200;
        const outHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8'
        };
        const fakeRes = {
          setHeader: (k, v) => { outHeaders[k] = v; },
          status: (c) => { statusCode = c; return fakeRes; },
          json: (d) => {
            res.writeHead(statusCode, outHeaders);
            res.end(JSON.stringify(d));
          },
          end: () => res.end()
        };
        await handler(fakeReq, fakeRes);
        return;
      } catch (e) {
        // Fallback to Vercel live
        try {
          const upstream = await fetch(`https://amy-fx.vercel.app/api/news${parsedUrl.search}`);
          const data = await upstream.text();
          res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(data);
          return;
        } catch (fetchErr) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'news_unavailable', message: fetchErr.message }));
          return;
        }
      }
    }

    // --- AMY FX PRO ACADEMY READING HISTORY & FULL LESSON CATALOG BRIDGE (/api/academy-reading) ---
    if (pathname === '/api/academy-reading') {
      const cacheDir = path.resolve(__dirname, '../.cache');
      try { if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
      const stateFile = path.join(cacheDir, 'academy-reading-state.json');
      const academyDir = path.join(ROOT_DIR, 'apps', 'academy');

      const stripHtmlToText = (html) => {
        if (!html) return '';
        return String(html)
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<header[\s\S]*?<\/header>/gi, ' ')
          .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<div class="ml-nav-footer"[\s\S]*?<\/div>/gi, ' ')
          .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, '\n• $2\n')
          .replace(/<\/(p|div|li|tr|blockquote|section|article)>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s*\n+/g, '\n')
          .trim();
      };

      const LEVEL_NAMES = {
        0: 'Level 0 — Fondasi Nol Mutlak (Tanpa Grafik)',
        1: 'Level 1 — Membaca Arah Pasar (Chart Dasar)',
        2: 'Level 2 — Senjata Utama & Filter ICT',
        3: 'Level 3 — Waktu & Sesi Emas (Killzone)',
        4: 'Level 4 — Playbook Setup A+ (Deep OTE & Sweep MSS)',
        5: 'Level 5 — Pertahanan Modal & Disiplin Emosi',
        6: 'Level 6 — Bedah Kasus Nyata XAU/USD'
      };

      const buildFullAcademyCatalog = () => {
        if (global.__amyAcademyCatalogCache) return global.__amyAcademyCatalogCache;
        const levels = [];
        const allItems = [];

        // 1. Scan seluruh pelajaran Level 0 s.d. Level 6 (42 Bab Micro-Learning Utama)
        for (let lv = 0; lv <= 6; lv++) {
          const lvDir = path.join(academyDir, `belajar/level-${lv}`);
          if (!fs.existsSync(lvDir)) continue;
          const files = fs.readdirSync(lvDir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();
          const lessons = [];
          files.forEach((f, idx) => {
            const relPath = `belajar/level-${lv}/${f}`;
            const absPath = path.join(academyDir, relPath);
            const rawHtml = fs.readFileSync(absPath, 'utf-8');
            const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            const rawTitle = h1Match ? stripHtmlToText(h1Match[1]) : f.replace('.html', '');
            const cleanTitle = rawTitle.replace(/^\d+\.\s*/, '').trim();
            const item = {
              type: 'level_lesson',
              level: lv,
              lessonNum: idx + 1,
              code: `Level ${lv} Bab ${idx + 1}`,
              title: rawTitle,
              cleanTitle,
              relPath,
              absPath
            };
            lessons.push(item);
            allItems.push(item);
          });
          levels.push({
            level: lv,
            name: LEVEL_NAMES[lv] || `Level ${lv}`,
            indexRelPath: `belajar/level-${lv}/index.html`,
            lessons
          });
        }

        // 2. Scan Modul 01 s.d. Modul 10 (Silabus Master Tematik)
        const modules = [];
        for (let m = 1; m <= 10; m++) {
          const modPad = String(m).padStart(2, '0');
          const relPath = `modul-${modPad}/index.html`;
          const absPath = path.join(academyDir, relPath);
          if (!fs.existsSync(absPath)) continue;
          const rawHtml = fs.readFileSync(absPath, 'utf-8');
          const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          const title = h1Match ? stripHtmlToText(h1Match[1]) : `Modul ${modPad}`;
          const item = {
            type: 'module',
            moduleNum: m,
            code: `Modul ${modPad}`,
            title,
            cleanTitle: title,
            relPath,
            absPath
          };
          modules.push(item);
          allItems.push(item);
        }

        // 3. Scan Bagian 01 s.d. Bagian 36 (222 Bab Ensiklopedia Lengkap)
        const bagianDirs = fs.readdirSync(academyDir).filter(d => /^bagian-\d+/i.test(d)).sort();
        for (const bDir of bagianDirs) {
          const fullDir = path.join(academyDir, bDir);
          if (!fs.statSync(fullDir).isDirectory()) continue;
          const bMatch = bDir.match(/^bagian-(\d+)/i);
          const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
          const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.html')).sort();
          for (const f of files) {
            const relPath = `${bDir}/${f}`;
            const absPath = path.join(academyDir, relPath);
            const rawHtml = fs.readFileSync(absPath, 'utf-8');
            const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            const title = h1Match ? stripHtmlToText(h1Match[1]) : f.replace('.html', '');
            allItems.push({
              type: f === 'index.html' ? 'bagian_index' : 'bagian_lesson',
              bagianNum: bNum,
              code: `Bagian ${String(bNum).padStart(2, '0')}`,
              title,
              cleanTitle: title,
              relPath,
              absPath
            });
          }
        }

        // Susun teks ringkas Katalog Lengkap Level 0–6 & Modul 01–10 agar Gemini hafal semua materi per level
        const summaryLines = [
          '=== DAFTAR LENGKAP KURIKULUM AMY FX ACADEMY (LEVEL 0 S.D. LEVEL 6 + 10 MODUL MASTER + 36 BAGIAN) ==='
        ];
        for (const lv of levels) {
          const listStr = lv.lessons.map(l => `Bab ${l.lessonNum}: ${l.cleanTitle} [apps/academy/${l.relPath}]`).join(' | ');
          summaryLines.push(`• ${lv.name} (${lv.lessons.length} Materi): ${listStr}`);
        }
        summaryLines.push('• 10 Modul Master Ensiklopedia:');
        for (const mod of modules) {
          summaryLines.push(`  - ${mod.title} [apps/academy/${mod.relPath}]`);
        }

        global.__amyAcademyCatalogCache = {
          levels,
          modules,
          allItems,
          catalogText: summaryLines.join('\n')
        };
        return global.__amyAcademyCatalogCache;
      };

      const catalog = buildFullAcademyCatalog();

      const resolveLessonHtmlFile = (relPath, titleHint) => {
        try {
          if (relPath) {
            const cleanRel = String(relPath)
              .replace(/^https?:\/\/[^/]+/i, '')
              .replace(/^.*\/apps\/academy\//i, '')
              .replace(/[?#].*$/, '')
              .replace(/^\/+/, '');
            if (cleanRel) {
              const candidate = path.join(academyDir, cleanRel);
              if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return { absPath: candidate, relPath: cleanRel };
              }
            }
          }

          const q = String(titleHint || '').toLowerCase().trim();
          if (!q) return null;
          if (/\b(evaluasi performa jurnal|winrate|refleksi emosi saya|jurnalku|jurnal saya|berita terbaru|analisa chart gold)\b/i.test(q)) {
            return null;
          }

          // 1. Cek kecocokan spesifik "level X" + ("bab/materi/nomor Y" atau judul)
          const lvMatch = q.match(/level\s*([0-6])/i);
          const numMatch = q.match(/(?:bab|materi|pelajaran|modul|no|nomor)\s*(\d+)/i) || q.match(/\b0?([1-9]|10)\b/);
          if (lvMatch) {
            const lvNum = parseInt(lvMatch[1], 10);
            const lvObj = catalog.levels.find(l => l.level === lvNum);
            if (lvObj) {
              if (numMatch) {
                const lesIdx = parseInt(numMatch[1], 10);
                const foundLes = lvObj.lessons.find(l => l.lessonNum === lesIdx);
                if (foundLes) return { absPath: foundLes.absPath, relPath: foundLes.relPath };
              }
              if (lvObj.lessons[0]) {
                return { absPath: lvObj.lessons[0].absPath, relPath: lvObj.lessons[0].relPath };
              }
            }
          }

          // 2. Cek kecocokan "modul X" (1 s.d. 10)
          const modMatch = q.match(/\bmodul\s*0?(\d+)\b/i);
          if (modMatch) {
            const mNum = parseInt(modMatch[1], 10);
            // Jika user bilang "modul 2" saat di Level 0, atau minta Modul 02
            const modObj = catalog.modules.find(m => m.moduleNum === mNum);
            if (modObj) return { absPath: modObj.absPath, relPath: modObj.relPath };
          }

          // 3. Cek kecocokan "bagian X" (1 s.d. 36)
          const bagMatch = q.match(/\bbagian\s*0?(\d+)\b/i);
          if (bagMatch) {
            const bNum = parseInt(bagMatch[1], 10);
            const bagObj = catalog.allItems.find(it => it.bagianNum === bNum && it.type === 'bagian_index');
            if (bagObj) return { absPath: bagObj.absPath, relPath: bagObj.relPath };
          }

          // 4. Pencarian kata kunci di seluruh judul materi Level 0–6, Modul 1–10, dan Bagian 1–36
          const stopWords = new Set(['coba', 'kita', 'pelajari', 'belajar', 'buka', 'materi', 'tolong', 'jelaskan', 'apa', 'itu', 'tentang', 'yang', 'ada', 'di', 'dan', 'ke', 'dari', 'dong', 'ya', 'sayang', 'amy', 'full', 'lengkap']);
          const tokens = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !stopWords.has(t));
          if (tokens.length > 0) {
            let bestItem = null;
            let bestScore = 0;
            for (const item of catalog.allItems) {
              const hay = `${item.code} ${item.title} ${item.relPath}`.toLowerCase();
              let score = 0;
              for (const tk of tokens) {
                if (hay.includes(tk)) {
                  score += item.type === 'level_lesson' ? 4 : 3;
                }
              }
              if (score > bestScore) {
                bestScore = score;
                bestItem = item;
              }
            }
            if (bestItem && bestScore > 0) {
              return { absPath: bestItem.absPath, relPath: bestItem.relPath };
            }
          }
        } catch (_) {}
        return null;
      };

      const extractLessonDetails = (absPath, relPath) => {
        try {
          const rawHtml = fs.readFileSync(absPath, 'utf-8');
          const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          const title = h1Match ? stripHtmlToText(h1Match[1]) : '';
          let nextLessonPath = '';
          let nextLessonTitle = '';
          let nextLessonSummary = '';

          const nextBtnMatch =
            rawHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*ml-btn-next[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
            rawHtml.match(/<a[^>]+class=["'][^"']*ml-btn-next[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
          if (nextBtnMatch) {
            const href = nextBtnMatch[1];
            const nextDir = path.dirname(relPath);
            nextLessonPath = path.posix.normalize(path.posix.join(nextDir, href));
            const nextAbs = path.join(academyDir, nextLessonPath);
            if (fs.existsSync(nextAbs) && fs.statSync(nextAbs).isFile()) {
              const nextHtml = fs.readFileSync(nextAbs, 'utf-8');
              const nh1 = nextHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
              nextLessonTitle = nh1 ? stripHtmlToText(nh1[1]) : stripHtmlToText(nextBtnMatch[2]);
              nextLessonSummary = stripHtmlToText(nextHtml).slice(0, 1400);
            } else {
              nextLessonTitle = stripHtmlToText(nextBtnMatch[2]);
            }
          } else {
            try {
              const dirRel = path.dirname(relPath);
              const fileBase = path.basename(relPath);
              const idxAbs = path.join(academyDir, dirRel, 'index.html');
              if (fs.existsSync(idxAbs)) {
                const idxHtml = fs.readFileSync(idxAbs, 'utf-8');
                const rowRegex = /<a[^>]+class=["'][^"']*chapter-row[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
                const rows = [];
                let m;
                while ((m = rowRegex.exec(idxHtml)) !== null) {
                  rows.push({ href: m[1], label: stripHtmlToText(m[2]) });
                }
                const curIdx = rows.findIndex(r => r.href === fileBase);
                if (curIdx >= 0 && curIdx + 1 < rows.length) {
                  const nxt = rows[curIdx + 1];
                  nextLessonPath = path.posix.normalize(path.posix.join(dirRel, nxt.href));
                  const nextAbs = path.join(academyDir, nextLessonPath);
                  if (fs.existsSync(nextAbs)) {
                    const nextHtml = fs.readFileSync(nextAbs, 'utf-8');
                    const nh1 = nextHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                    nextLessonTitle = nh1 ? stripHtmlToText(nh1[1]) : nxt.label;
                    nextLessonSummary = stripHtmlToText(nextHtml).slice(0, 1400);
                  } else {
                    nextLessonTitle = nxt.label;
                  }
                }
              }
            } catch (_) {}
          }

          const fullCleaned = stripHtmlToText(rawHtml);
          return {
            title,
            relPath,
            summary: fullCleaned.slice(0, 4800),
            fullText: fullCleaned.slice(0, 9000),
            nextLessonPath,
            nextLessonTitle,
            nextLessonSummary
          };
        } catch (_) {
          return null;
        }
      };

      const loadSavedReadingState = () => {
        try {
          if (fs.existsSync(stateFile)) {
            return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
          }
        } catch (_) {}
        try {
          const obsPath = '/sdcard/Download/Obsidian/Catatan Pribadi/Progres_Belajar_Trading.md';
          if (fs.existsSync(obsPath)) {
            const md = fs.readFileSync(obsPath, 'utf-8');
            const lastMatch = md.match(/\*\*Materi Terakhir:\*\*\s*\[\[([^\]]+)\]\]/i);
            const nextMatch = md.match(/\*\*Materi Berikutnya:\*\*\s*\[\[([^\]]+)\]\]/i);
            const semMatch = md.match(/\*\*Semester:\*\*\s*(.+)/i);
            const lastTitle = lastMatch ? lastMatch[1].trim() : '01. Apa Itu Trading Sebenarnya?';
            return {
              lastRead: {
                title: lastTitle,
                section: semMatch ? semMatch[1].trim() : 'Level 0: Fondasi Nol Mutlak',
                path: 'belajar/level-0/01-apa-itu-trading.html',
                progress: 100,
                updatedAt: Date.now()
              },
              history: [
                {
                  title: lastTitle,
                  section: 'Level 0: Fondasi Nol Mutlak',
                  path: 'belajar/level-0/01-apa-itu-trading.html',
                  progress: 100
                },
                {
                  title: 'Realita Trading untuk Pemula',
                  section: 'Bagian 01 — Pemula Nol',
                  path: 'bagian-01-pemula-nol/realita-trading-untuk-pemula.html',
                  progress: 100
                }
              ],
              obsidianNextHint: nextMatch ? nextMatch[1].trim() : ''
            };
          }
        } catch (_) {}
        return { lastRead: null, history: [] };
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const incoming = body ? JSON.parse(body) : {};
            const current = loadSavedReadingState();
            const merged = {
              lastRead: (incoming.lastRead && incoming.lastRead.title) ? incoming.lastRead : current.lastRead,
              history: (Array.isArray(incoming.history) && incoming.history.length) ? incoming.history.slice(0, 10) : (current.history || []),
              microProgress: incoming.microProgress || current.microProgress || {},
              updatedAt: Date.now()
            };
            fs.writeFileSync(stateFile, JSON.stringify(merged, null, 2), 'utf-8');
            const target = merged.lastRead || {};
            const resolved = resolveLessonHtmlFile(target.path, target.title);
            const details = resolved ? extractLessonDetails(resolved.absPath, resolved.relPath) : null;
            const queryHint = incoming.query || '';
            const queryResolved = queryHint ? resolveLessonHtmlFile('', queryHint) : null;
            const requestedLesson = queryResolved ? extractLessonDetails(queryResolved.absPath, queryResolved.relPath) : null;
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store'
            });
            res.end(JSON.stringify({
              ok: true,
              state: merged,
              lessonDetails: details,
              requestedLesson,
              catalogText: catalog.catalogText
            }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }

      const saved = loadSavedReadingState();
      const qPath = parsedUrl.searchParams.get('path') || saved.lastRead?.path || '';
      const qTitle = parsedUrl.searchParams.get('title') || saved.lastRead?.title || '';
      const userQuery = parsedUrl.searchParams.get('q') || '';
      const resolved = resolveLessonHtmlFile(qPath, qTitle);
      const details = resolved ? extractLessonDetails(resolved.absPath, resolved.relPath) : null;
      const queryResolved = userQuery ? resolveLessonHtmlFile('', userQuery) : null;
      const requestedLesson = queryResolved ? extractLessonDetails(queryResolved.absPath, queryResolved.relPath) : null;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({
        ok: true,
        state: saved,
        lessonDetails: details,
        requestedLesson,
        catalogText: catalog.catalogText
      }));
      return;
    }

    // --- AMY FX PRO GEMINI AI BRIDGE (/api/gemini-config & /api/gemini-chat) ---
    if (pathname === '/api/gemini-config') {
      let apiKey = '';
      try {
        const rawKeys = fs.readFileSync('/root/.gemini_keys', 'utf-8');
        apiKey = rawKeys.split('\n').map(s => s.trim()).find(s => s.startsWith('AIza')) || rawKeys.split('\n')[0].trim();
      } catch (_) {}
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({
        ok: Boolean(apiKey),
        apiKey,
        liveModel: 'models/gemini-3.8-live',
        voiceName: 'Aoede'
      }));
      return;
    }

    if (pathname === '/api/gemini-chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          let apiKey = '';
          try {
            const rawKeys = fs.readFileSync('/root/.gemini_keys', 'utf-8');
            apiKey = rawKeys.split('\n').map(s => s.trim()).find(s => s.startsWith('AIza')) || rawKeys.split('\n')[0].trim();
          } catch (_) {}
          if (!apiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'API Key Gemini belum ditemukan di /root/.gemini_keys' }));
            return;
          }

          const payload = body ? JSON.parse(body) : {};
          const message = String(payload.message || '').trim();
          const appContext = String(payload.appContext || '').trim();
          const imageBase64 = payload.imageBase64 ? String(payload.imageBase64).replace(/^data:image\/\w+;base64,/, '') : '';
          const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];

          const isAskingFullMaterial = /\b(full|lengkap|buka|pelajari|jelaskan|materi|modul|level|bab)\b/i.test(message);

          const sysPrompt =
            `Kamu adalah AMY (✦ AMY), asisten pintar resmi di dalam aplikasi Amy FX Pro milik pengguna.\n` +
            `Wajib panggil pengguna dengan sebutan "kamu" (JANGAN panggil "Sayang", "Mas", atau sapaan lainnya) dengan nada bicara yang ramah, suportif, dan profesional dalam Bahasa Indonesia yang luwes.\n` +
            `PROFIL TRADING PENGGUNA:\n` +
            `- Pure Gold Scalper (XAU/USD) timeframe M15 & M5 dengan target presisi 100 Pips ($10).\n` +
            `- Zona waktu acuan: WITA (UTC+8).\n` +
            `- Istilah wajib standar trader pro: Support / Demand, Resistance / Supply, No-Trade Zone (jangan entry di tengah), Dealing Range (Premium/Discount/EQ 50%), PDH/PDL, PWH/PWL, Asia High/Low, FVG, Order Block, BSL/SSL, MSS/BOS.\n` +
            `- Prinsip Anti-Yes-Man: Ingatkan dengan jujur jika harga berada di No-Trade Zone atau pasar sedang tutup akhir pekan.\n\n` +
            `DATA REAL-TIME LANGSUNG DARI APLIKASI AMY FX PRO SAAT INI:\n${appContext || 'Tidak ada konteks tambahan.'}\n\n` +
            `ATURAN JAWABAN & AKSES PENUH MATERI ACADEMY:\n` +
            `- DILARANG KERAS memakai simbol markdown seperti tanda bintang (* atau **), pagar (# atau ###), garis (---), atau backtick (\`). Tulis teks biasa yang bersih dan rapi, gunakan tanda titik bulat (•) untuk poin.\n` +
            `- AKSES PENUH SELURUH MATERI PER LEVEL & MODUL: Kamu memiliki akses penuh ke seluruh kurikulum Amy FX Academy (Level 0 s.d. Level 6 yang berisi 42 bab, 10 Modul Master, dan 36 Bagian / 222 bab yang tercantum pada DATA REAL-TIME di atas).\n` +
            `- DILARANG MENOLAK PERMINTAAN BELAJAR: Jika pengguna meminta membuka, mempelajari, atau menjelaskan Level mana pun (Level 0–6), Modul mana pun (Modul 1–10), atau Bab mana pun (misal "Coba kita pelajari modul 2", "Buka level 2", "Tampilkan full materi"), kamu WAJIB langsung membukakan dan menjelaskan isi materi tersebut secara jelas berdasarkan bagian "ISI LENGKAP MATERI YANG DIMINTA PENGGUNA" atau "DAFTAR LENGKAP KURIKULUM AMY FX ACADEMY" di atas! JANGAN PERNAH menolak atau menyuruh menyelesaikan Modul 01 dulu!\n` +
            `- Jika pengguna hanya bertanya "apa bacaan terakhirku?", mengaculah pada "Materi Terakhir Dibaca Pengguna" di atas.`;

          const contents = [];
          for (const h of history) {
            if (!h || !h.text) continue;
            contents.push({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: String(h.text) }]
            });
          }

          const userParts = [];
          if (imageBase64) {
            userParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
          }
          userParts.push({ text: message || 'Tolong analisa gambar chart dan konteks aplikasi saat ini.' });
          contents.push({ role: 'user', parts: userParts });

          const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
          let replyText = '';
          let usedModel = '';
          const maxTokens = isAskingFullMaterial ? 900 : 420;

          for (const m of modelsToTry) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
              const genConfig = m.includes('2.5')
                ? { temperature: 0.25, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } }
                : { temperature: 0.25, maxOutputTokens: maxTokens };
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: sysPrompt }] },
                  generationConfig: genConfig,
                  contents
                }),
                signal: AbortSignal.timeout(14000)
              });
              if (resp.ok) {
                const data = await resp.json();
                const txt = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
                if (txt) {
                  replyText = txt;
                  usedModel = m;
                  break;
                }
              }
            } catch (_) {}
          }

          if (!replyText) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: false,
              error: 'Koneksi Gemini sedang sibuk, menampilkan data lokal aplikasi.'
            }));
            return;
          }

          replyText = replyText
            .replace(/^[ \t]*---+[ \t]*$/gm, '')
            .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
            .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*\n]+)\*/g, '$1')
            .replace(/[*#`]/g, '')
            .replace(/\bSayang\b/g, 'kamu')
            .replace(/\bsayang\b/g, 'kamu')
            .replace(/\bHalo kamu\b/gi, 'Halo')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ ok: true, reply: replyText, model: usedModel }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
    if (safePath.startsWith('assets' + path.sep)) {
      safePath = safePath.slice(('assets' + path.sep).length);
    } else if (safePath === 'assets') {
      safePath = '';
    }

    let targetPath = path.join(ROOT_DIR, safePath);

    if (!targetPath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(targetPath)) {
      // Check if it's an academy bagian old lesson URL: apps/academy/(bagian-[^/]+)/([^/]+).html
      const lessonMatch = safePath.match(/^apps[\\\/]academy[\\\/](bagian-[^\\\/]+)[\\\/]([^\\\/]+)\.html$/);
      if (lessonMatch && lessonMatch[2] !== 'index') {
        const rewritten = `/apps/academy/${lessonMatch[1]}/index.html#${lessonMatch[2]}`;
        res.writeHead(302, { Location: rewritten });
        res.end();
        return;
      }
    }

    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(302, { Location: pathname + '/' + (parsedUrl.search || '') });
          res.end();
          return;
        }
        const indexHtml = path.join(targetPath, 'index.html');
        if (fs.existsSync(indexHtml)) {
          targetPath = indexHtml;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Index file not found in directory');
          return;
        }
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      const errorPage = path.join(ROOT_DIR, 'error.html');
      if (fs.existsSync(errorPage)) {
        res.end(fs.readFileSync(errorPage));
      } else {
        res.end('<h1>404 Not Found</h1><p>File tidak ditemukan.</p>');
      }
      return;
    }

    const stat = fs.statSync(targetPath);
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const range = req.headers.range;
    if (range && (ext === '.mp4' || ext === '.mp3')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      const stream = fs.createReadStream(targetPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        stream.pipe(res);
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept-Ranges': 'bytes'
    });

    if (req.method === 'HEAD') {
      res.end();
    } else {
      fs.createReadStream(targetPath).pipe(res);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server Error: ' + err.message);
  }
};

const server = http.createServer(requestHandler);

server.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('  AMY FX — LOCAL WEB SERVER AKTIF');
  console.log('====================================================');
  console.log(`  > Akses Langsung di Browser:`);
  console.log(`    👉 http://localhost:${PORT}`);
  console.log(`    👉 http://127.0.0.1:${PORT}`);
  console.log('');
  console.log(`  > Modul Cepat:`);
  console.log(`    - Beranda / Profil : http://localhost:${PORT}/index.html`);
  console.log(`    - Mapping Gold     : http://localhost:${PORT}/apps/mapping/`);
  console.log(`    - Jurnal & Habits  : http://localhost:${PORT}/apps/journal/`);
  console.log(`    - Market Intel     : http://localhost:${PORT}/apps/market-intel/`);
  console.log(`    - Academy          : http://localhost:${PORT}/apps/academy/`);
  console.log('====================================================');

  const altPort = PORT === 8080 ? 8081 : 8080;
  const altServer = http.createServer(requestHandler);
  altServer.on('error', () => {});
  altServer.listen(altPort, HOST, () => {
    console.log(`  > Akses Mirror (Port Alternatif):`);
    console.log(`    👉 http://localhost:${altPort}`);
    console.log('====================================================');
  });
});

