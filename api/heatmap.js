import { getCandles } from '../lib/market-candle-store.mjs';

/**
 * Amy FX — Dynamic Liquidity Heatmap API
 * Candle source is centralized through the Supabase-first market gateway.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ zones: [], error: 'method_not_allowed' });

  try {
    const { symbol = 'XAU/USD', interval = '15min', outputsize = '240' } = req.query;
    if (symbol !== 'XAU/USD') {
      return res.status(403).json({ zones: [], error: 'symbol_not_allowed' });
    }

    const safeSize = Math.min(Math.max(Number.parseInt(String(outputsize), 10) || 240, 80), 5_000);
    const marketData = await getCandles({
      symbol,
      interval,
      outputsize: safeSize,
      apiKey: process.env.TWELVEDATA_API_KEY
    });
    const candles = normalizeCandles(marketData?.values);

    if (!candles.length) {
      return res.status(200).json({
        symbol,
        interval,
        currentPrice: null,
        updated: new Date().toISOString(),
        sourceCandleTime: null,
        zones: [],
        summary: emptySummary(),
        meta: {
          candleCount: 0,
          accuracyProfile: 'BACKTEST_2022_2026',
          dataSource: marketData?.source || 'unavailable'
        },
        error: 'no_data'
      });
    }

    const { computeDynamicHeatmap } = await import('../lib/heatmap-core.mjs');
    const result = computeDynamicHeatmap(candles, {
      swingWindow: 2,
      maxZonesPerSide: 6
    });
    const summary = precisionSummary(result);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-AmyFX-Market-Source', marketData?.source || 'unknown');
    return res.status(200).json({
      symbol,
      interval,
      currentPrice: result.currentPrice,
      updated: new Date().toISOString(),
      sourceCandleTime: result.meta?.sourceCandleTime || candles.at(-1)?.time || null,
      zones: result.zones,
      summary,
      meta: {
        ...result.meta,
        dataSource: marketData?.source || 'unknown',
        cacheState: marketData?.amyfxCacheState || 'UNKNOWN',
        accuracyProfile: 'BACKTEST_2022_2026',
        nearestDrawRole: 'LIQUIDITY_TARGET_ONLY',
        primaryDistanceAtr: 1.5,
        secondaryDistanceAtr: 3
      }
    });
  } catch (error) {
    console.error('heatmap provider failed', error);
    return res.status(502).json({
      currentPrice: null,
      updated: new Date().toISOString(),
      zones: [],
      summary: emptySummary(),
      error: 'provider_failed',
      message: error?.message || 'Market data unavailable'
    });
  }
}

function normalizeCandles(values) {
  return [...(Array.isArray(values) ? values : [])]
    .reverse()
    .map(candle => ({
      time: candle.datetime,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close)
    }))
    .filter(candle => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite));
}

function emptySummary() {
  return {
    pressure: 'WAITING DATA',
    liquidityConcentration: 'WAITING DATA',
    directionalSignal: 'NEUTRAL',
    directionalUse: false,
    nearestDraw: null,
    activeZones: 0,
    transitionZones: 0,
    interpretation: 'Heatmap belum memiliki data yang cukup.'
  };
}

function classifyDraw(draw, currentPrice, atr) {
  if (!draw || !Number.isFinite(Number(draw.price))) return null;
  const absoluteDistance = Math.abs(Number(draw.price) - Number(currentPrice));
  const distanceAtr = atr > 0 ? absoluteDistance / atr : null;
  const targetClass = distanceAtr === null
    ? 'CONTEXT_ONLY'
    : distanceAtr <= 1.5 ? 'PRIMARY' : distanceAtr <= 3 ? 'SECONDARY' : 'CONTEXT_ONLY';
  return {
    ...draw,
    absoluteDistance,
    distanceAtr,
    targetClass,
    actionableAsDirection: false,
    useAsLiquidityTarget: targetClass !== 'CONTEXT_ONLY'
  };
}

function precisionSummary(result) {
  const base = result?.summary || {};
  const currentPrice = Number(result?.currentPrice || 0);
  const atr = Number(result?.meta?.atr || 0);
  const concentration = base.pressure || 'BALANCED';
  return {
    ...base,
    pressure: concentration,
    liquidityConcentration: concentration,
    directionalSignal: 'NEUTRAL',
    directionalUse: false,
    nearestDraw: classifyDraw(base.nearestDraw, currentPrice, atr),
    nearestBsl: classifyDraw(base.nearestBsl, currentPrice, atr),
    nearestSsl: classifyDraw(base.nearestSsl, currentPrice, atr),
    interpretation: 'Pressure menunjukkan konsentrasi likuiditas, bukan prediksi arah market.'
  };
}
