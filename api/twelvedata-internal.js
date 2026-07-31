import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_OUTPUT_SIZE = 2_000;
const PROVIDER_TIMEOUT_MS = 15_000;
const AUTH_TIMEOUT_MS = 5_000;
const AUTH_CACHE_MS = 15 * 60 * 1_000;
const SUPABASE_URL = String(
  process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://wliecyxzlwhmtftnfnps.supabase.co'
).replace(/\/$/, '');
const verifiedTokens = globalThis.__amyFxVerifiedServiceTokens
  || (globalThis.__amyFxVerifiedServiceTokens = new Map());

function parseOutputSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 300;
  return Math.min(Math.max(parsed, 1), MAX_OUTPUT_SIZE);
}

function readBearerToken(req) {
  const authorization = String(req.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function localServiceTokenMatches(token) {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
    process.env.SUPABASE_SECRET_KEY
  ].map(value => String(value || '')).filter(Boolean);
  return candidates.some(candidate => safeEqual(token, candidate));
}

function tokenFingerprint(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function verifiedBySupabaseAuth(token) {
  const fingerprint = tokenFingerprint(token);
  const cachedUntil = Number(verifiedTokens.get(fingerprint) || 0);
  if (cachedUntil > Date.now()) return true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      signal: controller.signal,
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) return false;
    verifiedTokens.set(fingerprint, Date.now() + AUTH_CACHE_MS);
    if (verifiedTokens.size > 20) {
      for (const [key, expiresAt] of verifiedTokens) {
        if (Number(expiresAt) <= Date.now()) verifiedTokens.delete(key);
      }
    }
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function authorized(req) {
  const token = readBearerToken(req);
  if (!token) return false;
  if (localServiceTokenMatches(token)) return true;
  return verifiedBySupabaseAuth(token);
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
  if (!(await authorized(req))) {
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
