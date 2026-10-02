import { buildMarketContext } from '../lib/scalper-engine/market-context.mjs';
import { evaluateSixDrivers, SIX_ENGINE_VERSION } from '../lib/scalper-engine/six-drivers.mjs';

let cachePayload = null;
let cacheTime = 0;
const CACHE_TTL_MS = 12000; // 12 seconds in-memory cache

function convertCandles(vals, dur) {
  return (vals || []).map(v => {
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
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20');
    res.status(200).json(cachePayload);
    return;
  }

  try {
    const baseUrl = 'https://amy-fx.vercel.app';
    const [res15, res5, res60, calRes] = await Promise.all([
      fetch(`${baseUrl}/api/twelvedata?symbol=XAU/USD&interval=15min&outputsize=60`).then(r => r.json()).catch(() => ({})),
      fetch(`${baseUrl}/api/twelvedata?symbol=XAU/USD&interval=5min&outputsize=60`).then(r => r.json()).catch(() => ({})),
      fetch(`${baseUrl}/api/twelvedata?symbol=XAU/USD&interval=1h&outputsize=60`).then(r => r.json()).catch(() => ({})),
      fetch(`${baseUrl}/api/calendar`).then(r => r.json()).catch(() => [])
    ]);

    const m15 = convertCandles(res15.values, 900);
    const m5 = convertCandles(res5.values, 300);
    const h1 = convertCandles(res60.values, 3600);
    const calendar = Array.isArray(calRes) ? calRes : [];
    const nowSec = Math.floor(now / 1000);

    const context = buildMarketContext({ h1, m15, m5, calendar, nowSeconds: nowSec });
    const driverEvaluation = evaluateSixDrivers({ m15, m5, h1, context, nowSeconds: nowSec });

    const active = [];
    for (const driver of driverEvaluation.drivers || []) {
      if (driver.plan && (driver.state === 'CONFIRMED' || driver.state === 'ARMED')) {
        active.push({
          id: driver.setupId || `${driver.id}_${nowSec}`,
          engineVersion: SIX_ENGINE_VERSION,
          schemaVersion: 3,
          model: driver.id,
          driverId: driver.id,
          driverName: driver.name,
          timeframe: 'M15',
          symbol: 'XAU/USD',
          direction: driver.plan.direction,
          status: driver.state === 'CONFIRMED' ? 'ACTIVE' : 'WAITING_TRIGGER',
          recommendationStatus: 'VALID',
          entry: driver.plan.entry,
          stopLoss: driver.plan.stopLoss,
          target: driver.plan.target,
          risk: 1.5,
          priority: 1,
          createdAt: new Date(nowSec * 1000).toISOString()
        });
      }
    }

    const payload = {
      ok: true,
      mode: 'market_context',
      context,
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
          driverEvaluation
        }
      }
    };

    cachePayload = payload;
    cacheTime = now;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20');
    res.status(200).json(payload);
  } catch (err) {
    console.error('scalper-setups error:', err);
    res.status(500).json({
      error: 'scalper_setups_failed',
      detail: String(err?.message || err)
    });
  }
}
