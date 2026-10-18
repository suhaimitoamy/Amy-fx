// Serverless proxy for historical candle archives hosted on GitHub Releases.
// Provides CORS headers and CDN edge caching for Safari PWA, Android WebView, and desktop clients.

export const DATASET_RELEASE_BASES = Object.freeze([
  'https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-market-dataset-8years',
  'https://github.com/suhaimitoamy/Amy-fx-pro/releases/download/amyfx-market-dataset-8years'
]);

export async function fetchDualSource(subPath, options = {}) {
  let lastResponse = null;
  let lastError = null;
  for (const base of DATASET_RELEASE_BASES) {
    try {
      const url = `${base}/${subPath}`;
      const resp = await fetch(url, options);
      if (resp.ok) {
        return { response: resp, sourceBase: base };
      }
      lastResponse = resp;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastResponse) return { response: lastResponse, sourceBase: null };
  throw lastError || new Error('All dataset upstream sources failed');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const { file, manifest } = req.query;

  // 1. Serve Manifest
  if (manifest === '1' || manifest === 'true') {
    try {
      const { response: resp, sourceBase } = await fetchDualSource('manifest_months.json', {
        headers: { 'User-Agent': 'AmyFX-Cloud-Candles-Proxy/1.0' }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      if (sourceBase) res.setHeader('X-AmyFX-Dataset-Source', sourceBase);
      return res.status(200).json(json);
    } catch (err) {
      return res.status(502).json({ error: 'failed_to_load_manifest', message: String(err.message || err) });
    }
  }

  // 2. Serve Archive ZIP file
  if (!file) {
    return res.status(400).json({ error: 'missing_file_parameter' });
  }

  // Security whitelist: filename must match XAUUSD standard archive naming
  const cleanFile = String(file).trim();
  if (!/^XAUUSD_\d{4}_[A-Za-z0-9_-]+\.zip$/.test(cleanFile)) {
    return res.status(400).json({ error: 'invalid_file_name' });
  }

  try {
    const { response: upstream, sourceBase } = await fetchDualSource(encodeURIComponent(cleanFile), {
      headers: {
        'User-Agent': 'AmyFX-Cloud-Candles-Proxy/1.0'
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'upstream_not_found', status: upstream.status });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFile}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
    if (sourceBase) res.setHeader('X-AmyFX-Dataset-Source', sourceBase);

    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(502).json({ error: 'download_failed', message: String(err.message || err) });
  }
}
