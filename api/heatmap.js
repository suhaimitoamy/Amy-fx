/**
 * Amy FX — Liquidity Heatmap API (Vercel Serverless)
 * Sumber: TwelveData candle data → komputasi zona likuiditas
 * Metode: Swing clustering + bucket scoring
 * Cache: 30 detik
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

    // Fetch candle data
    const candles = await fetchCandles(symbol, interval, outputsize, apiKey);
    if (!candles.length) {
      return res.status(200).json({ zones: [], error: 'no_data' });
    }

    // Hitung heatmap zones
    const zones = computeHeatmap(candles);
    const currentPrice = candles[candles.length - 1].close;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      symbol,
      interval,
      currentPrice,
      updated: new Date().toISOString(),
      zones
    });

  } catch (e) {
    return res.status(502).json({ zones: [], error: 'provider_failed' });
  }
}

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
 * Compute liquidity heatmap zones
 * 1. Deteksi swing highs & lows (5-bar fractal)
 * 2. Cluster swing ke bucket harga $2
 * 3. Score setiap bucket berdasarkan kepadatan swing
 */
function computeHeatmap(candles) {
  const SWING_WINDOW = 2;
  const BUCKET_SIZE = 2.0;
  const MIN_PRICE = 2000;
  const swings = { highs: [], lows: [] };

  // 1. Deteksi swing fractal
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

  // 2. Cluster ke bucket
  const highBuckets = {};
  const lowBuckets = {};

  for (const h of swings.highs) {
    const b = Math.round(h.price / BUCKET_SIZE) * BUCKET_SIZE;
    highBuckets[b] = (highBuckets[b] || 0) + 1;
  }
  for (const l of swings.lows) {
    const b = Math.round(l.price / BUCKET_SIZE) * BUCKET_SIZE;
    lowBuckets[b] = (lowBuckets[b] || 0) + 1;
  }

  // 3. Gabungkan & urutkan
  const allPrices = new Set([...Object.keys(highBuckets), ...Object.keys(lowBuckets)]);
  const sorted = [...allPrices].map(Number).sort((a, b) => b - a);

  // 4. Format output
  const currentPrice = candles[candles.length - 1].close;
  const currentBucket = Math.round(currentPrice / BUCKET_SIZE) * BUCKET_SIZE;

  const zones = [];
  for (const price of sorted) {
    const highCount = highBuckets[price] || 0;
    const lowCount = lowBuckets[price] || 0;
    if (highCount === 0 && lowCount === 0) continue;

    let label = '';
    if (highCount >= 2) label = 'EQH - Resistance Buatan';
    if (lowCount >= 2) label = 'EQL - Support Buatan';

    zones.push({
      price: Math.round(price * 100) / 100,
      isCurrent: price === currentBucket,
      resistCount: highCount,
      supportCount: lowCount,
      totalActivity: highCount + lowCount,
      label,
      intensity: Math.min((highCount + lowCount) / 5, 1) // 0..1
    });
  }

  return zones;
}
