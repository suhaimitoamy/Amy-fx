/**
 * Amy FX — Liquidity/Swing Tracker API (Vercel Serverless)
 * Sumber: TwelveData candle data → swing detection → liquidity levels
 * Independen dari heatmap.js — logic swing detection di-copy dan diadaptasi
 * Cache: 30 detik
 *
 * Response:
 * {
 *   currentPrice,
 *   updated,
 *   levels: [{ price, type, swept, candlesAgo, distance }]
 * }
 *
 * BSL = Buy-Side Liquidity (swing high aktif, belum di-sweep)
 * SSL = Sell-Side Liquidity (swing low aktif, belum di-sweep)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { symbol = 'XAU/USD', interval = '15min', outputsize = '200' } = req.query;
    const apiKey = process.env.TWELVEDATA_API_KEY || req.query.apikey;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required (set TWELVEDATA_API_KEY env)' });
    }

    // Fetch candle data (logic independen, tidak import dari heatmap.js)
    const candles = await fetchCandles(symbol, interval, outputsize, apiKey);
    if (!candles.length) {
      return res.status(200).json({ currentPrice: null, updated: new Date().toISOString(), levels: [], error: 'no_data' });
    }

    // Deteksi swing dan track liquidity
    const currentPrice = candles[candles.length - 1].close;
    const levels = trackLiquidity(candles);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      currentPrice,
      updated: new Date().toISOString(),
      levels
    });

  } catch (e) {
    return res.status(502).json({ currentPrice: null, updated: new Date().toISOString(), levels: [], error: 'provider_failed' });
  }
}

/**
 * Fetch candle data dari TwelveData
 * Copy independen dari heatmap.js — tidak import agar file ini berdiri sendiri
 */
async function fetchCandles(symbol, interval, size, apikey) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${size}&apikey=${apikey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TwelveData HTTP ${res.status}`);
  const data = await res.json();
  if (data?.status === 'error') throw new Error(data.message || 'TwelveData error');
  const values = data.values || [];
  // TwelveData returns newest first → reverse to chronological
  return values.reverse().map(c => ({
    time: c.datetime,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
  }));
}

/**
 * Deteksi swing highs & lows menggunakan fractal 5-bar
 * Logic diadaptasi dari computeHeatmap() di heatmap.js
 * Output: { highs: [{price, index}], lows: [{price, index}] }
 */
function detectSwings(candles) {
  const SWING_WINDOW = 2;
  const swings = { highs: [], lows: [] };

  for (let i = SWING_WINDOW; i < candles.length - SWING_WINDOW; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;

    for (let j = 1; j <= SWING_WINDOW; j++) {
      if (c.high <= candles[i - j].high || c.high <= candles[i + j].high) isHigh = false;
      if (c.low >= candles[i - j].low || c.low >= candles[i + j].low) isLow = false;
    }

    if (isHigh) swings.highs.push({ price: c.high, index: i });
    if (isLow) swings.lows.push({ price: c.low, index: i });
  }

  return swings;
}

/**
 * Track liquidity levels yang belum di-sweep
 * BSL = swing high yang belum ditembus oleh candle berikutnya
 * SSL = swing low yang belum ditembus oleh candle berikutnya
 * Urutkan dari yang paling dekat dengan harga sekarang
 * Limit 15 level terdekat
 */
function trackLiquidity(candles) {
  const swings = detectSwings(candles);
  const currentPrice = candles[candles.length - 1].close;

  const buildLevel = (s, type) => {
    const swept = candles.slice(s.index + 1).some(c =>
      type === 'BSL' ? c.high > s.price : c.low < s.price
    );

    return {
      price: Math.round(s.price * 100) / 100,
      type,
      swept,
      candlesAgo: candles.length - 1 - s.index,
      distance: Math.round((s.price - currentPrice) * 100) / 100
    };
  };

  const levels = [
    ...swings.highs.map(s => buildLevel(s, 'BSL')),
    ...swings.lows.map(s => buildLevel(s, 'SSL'))
  ]
    .filter(l => !l.swept)
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

  return levels.slice(0, 15);
}
