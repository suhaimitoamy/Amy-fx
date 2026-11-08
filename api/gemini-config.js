import fs from 'node:fs';

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
      const rawKeys = fs.readFileSync('/root/.gemini_keys', 'utf-8');
      apiKey = rawKeys.split('\n').map(s => s.trim()).find(s => s.startsWith('AIza')) || rawKeys.split('\n')[0].trim();
    } catch (_) {}
  }
  if (!apiKey) {
    apiKey = 'AIzaSyAiB-yJ-wg6Pbd_dPiaO1Q7ZJ_DzLjqsTs';
  }

  return res.status(200).json({
    ok: Boolean(apiKey),
    apiKey,
    liveModel: 'models/gemini-3.8-live',
    voiceName: 'Aoede'
  });
}
