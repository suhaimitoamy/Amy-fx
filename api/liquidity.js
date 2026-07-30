import { getCandles } from '../lib/market-candle-store.mjs';

/**
 * Amy FX — Liquidity/Swing Tracker API
 * Reads the same Supabase-first candle stream used by Mapping and Heatmap.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ levels: [], error: 'method_not_allowed' });

  try {
    const { symbol = 'XAU/USD', interval = '15min', outputsize = '200' } = req.query;
    if (symbol !== 'XAU/USD') {
      return res.status(403).json({ levels: [], error: 'symbol_not_allowed' });
    }

    const safeSize = Math.min(Math.max(Number.parseInt(String(outputsize), 10) || 200, 20), 5_000);
    const marketData = await getCandles({
      symbol,
      interval,
      outputsize: safeSize,
      apiKey: process.env.TWELVEDATA_API_KEY
    });
    const candles = normalizeCandles(marketData?.values);

    if (!candles.length) {
      return res.status(200).json({
        currentPrice: null,
        updated: new Date().toISOString(),
        levels: [],
        source: marketData?.source || 'unavailable',
        error: 'no_data'
      });
    }

    const currentPrice = candles.at(-1).close;
    const levels = trackLiquidity(candles);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-AmyFX-Market-Source', marketData?.source || 'unknown');
    return res.status(200).json({
      currentPrice,
      updated: new Date().toISOString(),
      sourceCandleTime: candles.at(-1)?.time || null,
      source: marketData?.source || 'unknown',
      cacheState: marketData?.amyfxCacheState || 'UNKNOWN',
      levels
    });
  } catch (error) {
    console.error('liquidity provider failed', error);
    return res.status(502).json({
      currentPrice: null,
      updated: new Date().toISOString(),
      levels: [],
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

function detectSwings(candles) {
  const swingWindow = 2;
  const swings = { highs: [], lows: [] };

  for (let index = swingWindow; index < candles.length - swingWindow; index += 1) {
    const candle = candles[index];
    let isHigh = true;
    let isLow = true;

    for (let distance = 1; distance <= swingWindow; distance += 1) {
      if (candle.high <= candles[index - distance].high || candle.high <= candles[index + distance].high) isHigh = false;
      if (candle.low >= candles[index - distance].low || candle.low >= candles[index + distance].low) isLow = false;
    }

    if (isHigh) swings.highs.push({ price: candle.high, index });
    if (isLow) swings.lows.push({ price: candle.low, index });
  }

  return swings;
}

function trackLiquidity(candles) {
  const swings = detectSwings(candles);
  const currentPrice = candles.at(-1).close;

  const buildLevel = (swing, type) => {
    const swept = candles.slice(swing.index + 1).some(candle =>
      type === 'BSL' ? candle.high > swing.price : candle.low < swing.price
    );
    return {
      price: Math.round(swing.price * 100) / 100,
      type,
      swept,
      candlesAgo: candles.length - 1 - swing.index,
      distance: Math.round((swing.price - currentPrice) * 100) / 100
    };
  };

  return [
    ...swings.highs.map(swing => buildLevel(swing, 'BSL')),
    ...swings.lows.map(swing => buildLevel(swing, 'SSL'))
  ]
    .filter(level => !level.swept)
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))
    .slice(0, 15);
}
