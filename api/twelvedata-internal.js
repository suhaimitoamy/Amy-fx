import { timingSafeEqual } from 'node:crypto';

const MAX_OUTPUT_SIZE = 2_000;
const PROVIDER_TIMEOUT_MS = 15_000;

function parseOutputSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 300;
  return Math.min(Math.max(parsed, 1), MAX_OUTPUT_SIZE);
}

function readBearerToken(req) {
  const authorization = String(req.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function authorized(req) {
  const expected = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || ''
  );
  const received = readBearerToken(req);
  if (!expected || !received || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-AmyFX-Market-Source', 'twelvedata-internal-direct');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized internal market request' });
  }

  const symbol = String(req.query?.symbol || 'XAU/USD').toUpperCase();
  const interval = String(req.query?.interval || '1min').toLowerCase();
  if (symbol !== 'XAU/USD' || interval !== '1min') {
    return res.status(400).json({ status: 'error', message: 'Only XAU/USD 1min is allowed' });
  }

  const apiKey = String(process.env.TWELVEDATA_API_KEY || '');
  if (!apiKey) {
    return res.status(503).json({ status: 'error', message: 'TWELVEDATA_API_KEY is not configured' });
  }

  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(parseOutputSize(req.query?.outputsize)),
    timezone: 'UTC',
    apikey: apiKey
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.twelvedata.com/time_series?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(502).json({
        status: 'error',
        message: `Twelve Data HTTP ${response.status}`
      });
    }
    if (!payload || payload.status === 'error' || !Array.isArray(payload.values)) {
      return res.status(502).json(payload || {
        status: 'error',
        message: 'Twelve Data returned an invalid response'
      });
    }
    return res.status(200).json({
      ...payload,
      amyfxProviderOnly: true,
      source: 'twelvedata-internal-direct'
    });
  } catch (error) {
    return res.status(error?.name === 'AbortError' ? 504 : 502).json({
      status: 'error',
      message: error?.message || 'Internal provider request failed'
    });
  } finally {
    clearTimeout(timeout);
  }
}
