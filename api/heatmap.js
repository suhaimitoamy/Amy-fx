/**
 * Amy FX — Dynamic Liquidity Heatmap API
 *
 * Sumber: TwelveData M15 candle data.
 * Mesin: swing clustering adaptif, recency weighting, sweep/reclaim,
 * close-break lifecycle, polarity flip, dan active-zone selection.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { symbol = 'XAU/USD', interval = '15min', outputsize = '240' } = req.query;
    const apiKey = process.env.TWELVEDATA_API_KEY || req.query.apikey;

    if (symbol !== 'XAU/USD') {
      return res.status(403).json({ zones: [], error: 'symbol_not_allowed' });
    }
    if (!apiKey) {
      return res.status(400).json({ zones: [], error: 'api_key_required' });
    }

    const safeSize = Math.min(Math.max(parseInt(outputsize, 10) || 240, 80), 500);
    const candles = await fetchCandles(symbol, interval, safeSize, apiKey);
    if (!candles.length) {
      return res.status(200).json({
        symbol,
        interval,
        currentPrice: null,
        updated: new Date().toISOString(),
        sourceCandleTime: null,
        zones: [],
        summary: { pressure: 'WAITING DATA', nearestDraw: null, activeZones: 0, transitionZones: 0 },
        meta: { candleCount: 0 },
        error: 'no_data'
      });
    }

    // Dynamic import keeps the Vercel function compatible with the current runtime.
    const { computeDynamicHeatmap } = await import('../lib/heatmap-core.mjs');
    const result = computeDynamicHeatmap(candles, {
      swingWindow: 2,
      maxZonesPerSide: 6
    });

    // Heatmap refreshes frequently, but CDN caching prevents duplicate provider calls.
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=20');
    return res.status(200).json({
      symbol,
      interval,
      currentPrice: result.currentPrice,
      updated: new Date().toISOString(),
      sourceCandleTime: result.meta?.sourceCandleTime || candles.at(-1)?.time || null,
      zones: result.zones,
      summary: result.summary,
      meta: result.meta
    });
  } catch (error) {
    console.error('heatmap provider failed', error);
    return res.status(502).json({
      currentPrice: null,
      updated: new Date().toISOString(),
      zones: [],
      summary: { pressure: 'WAITING DATA', nearestDraw: null, activeZones: 0, transitionZones: 0 },
      error: 'provider_failed'
    });
  }
}

async function fetchCandles(symbol, interval, size, apiKey) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${size}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TwelveData HTTP ${response.status}`);
  const data = await response.json();
  if (data?.status === 'error') throw new Error(data.message || 'TwelveData error');

  return (data.values || []).reverse().map(candle => ({
    time: candle.datetime,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close)
  }));
}
