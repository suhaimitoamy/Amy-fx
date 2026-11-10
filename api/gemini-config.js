import fs from 'node:fs';

const ENCODED_KEYS = [
  'QVEuQWI4Uk42TEx4QWtUM2E2cHNmQkJJNVI0TmNtMDVySVdRcy01WGo5R3ROM1B2TW52V1E=',
  'QVEuQWI4Uk42SzVONm5tNmNQclJqLXdFNG5Hc0plMWh2UzN3R0loV2tNdFVPeE1DNURaY3c=',
  'QVEuQWI4Uk42SnVYMGI5elFMQzRzRjk2alBRYnh4MVNrY2VvSG9rZHlQeW5zY2pFUGxpWFE=',
  'QVEuQWI4Uk42SW5Kck5KNTE1WFZzaTYzXzBoeWtnZ3YyMUtPSWNrM3B2N1pBYU40M1QtOWc=',
  'QVEuQWI4Uk42S3JpSWRaZU9vMDhrU3Y5NnFkcldVNlZTOFhQN3AtV1JCbnVhTzB6U0RMZWc=',
  'QVEuQWI4Uk42SXhSeUJPYlRiaU8zelV4WEpwaXRXd1dBNTdpTHdERmp1Nk9XMTVCd19leEE='
];

function getFallbackKey() {
  try {
    const enc = ENCODED_KEYS[Math.floor(Math.random() * ENCODED_KEYS.length)];
    return Buffer.from(enc, 'base64').toString('utf-8');
  } catch (_) {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    try {
      if (fs.existsSync('/root/.gemini_keys')) {
        const rawKeys = fs.readFileSync('/root/.gemini_keys', 'utf-8');
        apiKey = rawKeys.split('\n').map(s => s.trim()).find(s => s.startsWith('AQ.') || s.startsWith('AIza')) || '';
      }
    } catch (_) {}
  }
  if (!apiKey) {
    apiKey = getFallbackKey();
  }

  return res.status(200).json({
    ok: Boolean(apiKey),
    apiKey,
    liveModel: 'models/gemini-3.8-live',
    voiceName: 'Aoede'
  });
}
