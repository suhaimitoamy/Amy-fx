import { buildMarketContext, isGoldMarketOpen } from '../lib/scalper-engine/market-context.mjs';
import { evaluateSixDrivers, SIX_ENGINE_VERSION } from '../lib/scalper-engine/six-drivers.mjs';

let cachePayload = null;
let cacheTime = 0;
const CACHE_TTL_MS = 90000; // 90 seconds in-memory cache

function convertCandles(vals, dur) {
  const list = Array.isArray(vals) ? vals : (vals && Array.isArray(vals.values) ? vals.values : []);
  return list.map(v => {
    const dt = v.datetime && v.datetime.endsWith('Z') ? v.datetime : (v.datetime ? v.datetime + 'Z' : new Date().toISOString());
    const openTime = Math.floor(new Date(dt).getTime() / 1000);
    return {
      open_time: openTime,
      close_time: openTime + dur,
      open: parseFloat(v.open) || 0,
      high: parseFloat(v.high) || 0,
      low: parseFloat(v.low) || 0,
      close: parseFloat(v.close) || 0,
      is_closed: true
    };
  }).reverse();
}

async function fetchWithAbort(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch (_) {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type, x-amy-device-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const now = Date.now();
  if (cachePayload && (now - cacheTime < CACHE_TTL_MS)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.status(200).json(cachePayload);
    return;
  }

  try {
    const host = req?.headers?.host || (process.env.VERCEL_URL ? process.env.VERCEL_URL : 'amy-fx.vercel.app');
    const protocol = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const [res15, res5, res60, calRes] = await Promise.all([
      fetchWithAbort(`${baseUrl}/api/twelvedata?symbol=XAU/USD&interval=15min&outputsize=60`),
      fetchWithAbort(`${baseUrl}/api/twelvedata?symbol=XAU/USD&interval=5min&outputsize=60`),
      fetchWithAbort(`${baseUrl}/api/twelvedata?symbol=XAU/USD&interval=1h&outputsize=60`),
      fetchWithAbort(`${baseUrl}/api/calendar`)
    ]);

    const m15 = convertCandles(res15?.values || res15, 900);
    const m5 = convertCandles(res5?.values || res5, 300);
    const h1 = convertCandles(res60?.values || res60, 3600);

    // Jika TwelveData gagal / rate limit (429) dan candle tidak lengkap, gunakan cachePayload jika ada
    if ((!m15.length || !h1.length) && cachePayload) {
      console.warn('scalper-setups: Incomplete candle data from TwelveData (rate limit / error), serving stale cachePayload');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      res.status(200).json({
        ...cachePayload,
        staleFallback: true,
        warning: 'TwelveData rate limit / temporary failure, serving cached setups'
      });
      return;
    }

    const calendar = Array.isArray(calRes) ? calRes : (Array.isArray(calRes?.events) ? calRes.events : []);
    const nowSec = Math.floor(now / 1000);

    const context = buildMarketContext({ h1, m15, m5, calendar, nowSeconds: nowSec });
    const driverEvaluation = evaluateSixDrivers({ m15, m5, h1, context, nowSeconds: nowSec });

    const isMarketClosed = context.session === 'PASAR TUTUP' || !isGoldMarketOpen(nowSec);
    const active = [];
    if (!isMarketClosed) {
      // 1. Evaluasi AMY Entry Assistant V3 (Prioritas Utama / item terdepan di active)
      const v3Plan = context.plan || context.amy?.plan;
      const validV3Signals = [1, -1, 2, -2]; // BUY ENTRY, SELL ENTRY, PULLBACK BUY, PULLBACK SELL
      const isV3Signal = v3Plan && validV3Signals.includes(v3Plan.signalType);
      const isV3Ready = isV3Signal && (v3Plan.status === 'READY' || v3Plan.status === 'ACTIVE' || context.execution?.entryReady);

      if (isV3Ready) {
        const formedAtSec = v3Plan.formedAt ? Math.floor(new Date(v3Plan.formedAt).getTime() / 1000) : (m15.at(-1)?.close_time || m15[0]?.close_time || nowSec);
        const p = {
          signalType: v3Plan.signalType,
          signalName: v3Plan.signalName || (v3Plan.signalType === 1 ? 'BUY ENTRY (Trend Buy)' : v3Plan.signalType === -1 ? 'SELL ENTRY (Trend Sell)' : v3Plan.signalType === -2 ? 'PULLBACK SELL (Pullback di Pucuk Premium)' : 'PULLBACK BUY (Pullback di Dasar Diskon)'),
          direction: v3Plan.direction || v3Plan.side || (v3Plan.signalType > 0 ? 'BUY' : 'SELL'),
          entry: v3Plan.entry,
          stopLoss: v3Plan.stopLoss ?? v3Plan.sl,
          target1: v3Plan.target1 ?? v3Plan.tp1 ?? v3Plan.target,
          target2: v3Plan.target2 ?? v3Plan.tp2,
          risk: v3Plan.risk ?? (v3Plan.entry && (v3Plan.stopLoss ?? v3Plan.sl) ? Math.abs(v3Plan.entry - (v3Plan.stopLoss ?? v3Plan.sl)) : 1.5),
          reason: v3Plan.reason,
          formedAt: v3Plan.formedAt || new Date(formedAtSec * 1000).toISOString()
        };

        active.push({
          id: `amy_v3_${p.signalType}_${formedAtSec}`,
          engineVersion: 'amy-entry-assistant-v3',
          schemaVersion: 3,
          model: 'AMY_ENTRY_ASSISTANT_V3',
          driverId: 'amy_entry_v3',
          driverName: `AMY V3: ${p.signalName}`,
          timeframe: 'M15',
          symbol: 'XAU/USD',
          direction: p.direction,
          status: 'ACTIVE',
          recommendationStatus: 'VALID',
          entry: p.entry,
          stopLoss: p.stopLoss,
          target: p.target1,
          target2: p.target2,
          risk: p.risk,
          priority: 1,
          reason: p.reason,
          createdAt: p.formedAt || new Date(formedAtSec * 1000).toISOString()
        });
      }

      // 2. Evaluasi Six Drivers Turnamen
      for (const driver of driverEvaluation.drivers || []) {
        if (driver.plan && (driver.state === 'CONFIRMED' || driver.state === 'ARMED' || driver.state === 'WAITING_M5_BREAK')) {
          const formedAtSec = driver.plan.formedAt ? Math.floor(new Date(driver.plan.formedAt).getTime() / 1000) : (m15.at(-1)?.close_time || m15[0]?.close_time || nowSec);
          const setupId = driver.setupId || `${driver.id}_${driver.plan.direction}_${formedAtSec}`;
          const isConfirmed = driver.state === 'CONFIRMED';
          const actualEntry = isConfirmed && driver.plan.confirmedEntry
            ? driver.plan.confirmedEntry
            : driver.plan.entry;
          const actualRisk = Math.abs(actualEntry - driver.plan.stopLoss);
          const dirSign = driver.plan.direction === 'BUY' ? 1 : -1;
          const actualTarget = isConfirmed && actualRisk > 0
            ? Math.round((actualEntry + dirSign * actualRisk * driver.rr) * 10000) / 10000
            : driver.plan.target;

          // Cek apakah harga saat ini sudah mencapai/menyentuh entry limit
          const curPrice = m5.at(-1)?.close || m15.at(-1)?.close || null;
          const isLimitTriggered = !isConfirmed && curPrice != null && actualEntry != null && (
            (driver.plan.direction === 'BUY' && curPrice <= actualEntry && curPrice > driver.plan.stopLoss) ||
            (driver.plan.direction === 'SELL' && curPrice >= actualEntry && curPrice < driver.plan.stopLoss)
          );
          const finalStatus = isConfirmed || isLimitTriggered ? 'ACTIVE' : 'WAITING_TRIGGER';

          active.push({
            id: setupId,
            engineVersion: SIX_ENGINE_VERSION,
            schemaVersion: 3,
            model: driver.id,
            driverId: driver.id,
            driverName: driver.name,
            timeframe: 'M15',
            symbol: 'XAU/USD',
            direction: driver.plan.direction,
            status: finalStatus,
            recommendationStatus: 'VALID',
            entry: actualEntry,
            stopLoss: driver.plan.stopLoss,
            sl: driver.plan.stopLoss,
            target: actualTarget,
            tp1: actualTarget,
            risk: actualRisk > 0 ? Math.round(actualRisk * 100) / 100 : 1.5,
            priority: isConfirmed ? 2 : (isLimitTriggered ? 2 : 3),
            note: isConfirmed
              ? 'Konfirmasi M5 close terpicu · Market Execution'
              : (isLimitTriggered
                  ? 'Harga menyentuh level limit · Posisi berjalan'
                  : (driver.state === 'WAITING_M5_BREAK'
                      ? 'Retest zona tercapai · Menunggu break M5'
                      : `Menunggu pullback ke zona OTE [${driver.plan.zoneLow} – ${driver.plan.zoneHigh}]`)),
            createdAt: driver.plan.formedAt || new Date(formedAtSec * 1000).toISOString()
          });
        }
      }

      active.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    }

    const payload = {
      ok: true,
      mode: 'market_context',
      context,
      event: context.event || null,
      generatedAt: new Date(nowSec * 1000).toISOString(),
      primary: active[0] || null,
      driverEvaluation,
      enabledDrivers: {},
      active,
      history: [],
      recent: [],
      historyCount: 0,
      limits: { recommendedActive: null, riskUnits: null, history: 100 },
      engine: {
        status: 'COMPLETED',
        completed_at: new Date(nowSec * 1000).toISOString(),
        result: {
          engine: 'amyfx-gold-context-v1',
          driverEvaluation,
          context,
          news: context.news,
          event: context.event || null
        }
      }
    };

    cachePayload = payload;
    cacheTime = now;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.status(200).json(payload);
  } catch (err) {
    console.error('scalper-setups error:', err);
    if (cachePayload) {
      console.warn('scalper-setups: Recovering with cached payload after error');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      res.status(200).json({
        ...cachePayload,
        staleFallback: true,
        warning: 'Engine error, serving cached setups'
      });
      return;
    }
    res.status(500).json({
      error: 'scalper_setups_failed',
      detail: String(err?.message || err)
    });
  }
}
