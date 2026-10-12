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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
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

      // Check if cache has data and hasn't passed candle close time
      const cached = localCandleCache.get(cacheKey) || localCandleCache.get(fallbackKey);
      if (cached && cached.data) {
        const isFresh = isWeekend || (cached.closeSec && nowSec < cached.closeSec);
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
        const queryStr = parsedUrl.search;
        const upstream = await fetch(`https://amy-fx.vercel.app/api/twelvedata${queryStr}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(12000)
        });
        const dataText = await upstream.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch (_) {}

        const is429 = upstream.status === 429 || (parsed && (parsed.status === 'error' && /429|rate limit/i.test(parsed.message || '')));
        const isValid = upstream.status === 200 && parsed && parsed.status !== 'error' && Array.isArray(parsed.values) && parsed.values.length > 0;

        if (isValid) {
          let openSec = 0;
          if (parsed.values[0]?.datetime) {
            const dt = parsed.values[0].datetime;
            const norm = dt.endsWith('Z') ? dt : dt.replace(' ', 'T') + 'Z';
            const ms = Date.parse(norm);
            if (Number.isFinite(ms)) openSec = Math.floor(ms / 1000);
          }
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
          localCandleCache.set(fallbackKey, entry);
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
});

server.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('  AMY FX PRO — LOCAL WEB SERVER AKTIF');
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
});
