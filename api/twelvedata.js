export default async function handler(req, res) {
  // Set CORS headers so the Android WebView can fetch it without issues
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { symbol = 'XAU/USD', interval, outputsize = '300', apikey } = req.query;
  const targetKey = process.env.TWELVEDATA_API_KEY || apikey;

  if (!interval) {
    return res.status(400).json({ status: 'error', message: 'Interval is required' });
  }
  if (!targetKey) {
    return res.status(400).json({ status: 'error', message: 'API key is missing (set in Vercel Env or pass in query)' });
  }

  try {
    const fetchUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${encodeURIComponent(targetKey)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      return res.status(502).json({ status: 'error', message: `TwelveData HTTP ${response.status}` });
    }
    const data = await response.json();
    if (data?.status === 'error') {
      return res.status(502).json(data);
    }

    // Vercel Edge Caching!
    // s-maxage=30 tells Vercel's CDN to cache this response globally for 30 seconds.
    // stale-while-revalidate=59 tells the CDN to serve stale content up to 59s while fetching fresh data in the background.
    // This is the magic that entirely bypasses the 8 req/min limit for concurrent users.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=59');
    
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
