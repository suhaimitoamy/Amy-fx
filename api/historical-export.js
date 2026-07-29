const ALLOWED_INTERVALS = new Set(['1min', '5min', '15min', '1h', '4h', '1day']);
const EXPORT_TOKEN = 'amyfx-xau-2026-7f3d9a';

function isoDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(text)) return '';
  return text.includes('T') ? text.replace('T', ' ') : text;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'GET only' });

  const { token, interval = '15min', start, end, outputsize = '5000' } = req.query;
  if (token !== EXPORT_TOKEN) return res.status(403).json({ status: 'error', message: 'Forbidden' });
  if (!ALLOWED_INTERVALS.has(interval)) return res.status(400).json({ status: 'error', message: 'Unsupported interval' });

  const startDate = isoDate(start);
  const endDate = isoDate(end);
  if (!startDate || !endDate) return res.status(400).json({ status: 'error', message: 'Invalid dates' });

  const size = Math.min(Math.max(Number.parseInt(outputsize, 10) || 5000, 1), 5000);
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return res.status(503).json({ status: 'error', message: 'Missing provider key' });

  const params = new URLSearchParams({
    symbol: 'XAU/USD',
    interval,
    start_date: startDate,
    end_date: endDate,
    outputsize: String(size),
    timezone: 'UTC',
    order: 'ASC',
    apikey: apiKey
  });

  try {
    const response = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });
    const text = await response.text();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(response.ok ? 200 : 502).send(text);
  } catch (error) {
    return res.status(502).json({ status: 'error', message: error?.message || 'Provider unavailable' });
  }
}
