export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  // 1. Try Faireconomy with proper Chrome User-Agent
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      if (!text.includes('Rate Limited') && text.trim().startsWith('[')) {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          return res.status(200).json(data);
        }
      }
    }
  } catch (_) {
    // continue to fallback
  }

  // 2. Fallback: Parse macro calendar events from live news feed
  try {
    const newsRes = await fetch('https://amy-fx.vercel.app/api/news?limit=25');
    if (newsRes.ok) {
      const json = await newsRes.json();
      const events = [];
      const regex = /([A-Z]{3})\s*\|\s*([^\n\r]+)[\s\S]*?(?:Waktu|Time)\s*:\s*([^\n\r]+)[\s\S]*?(?:Efek|Effects?)\s*:\s*([^\n\r]+)[\s\S]*?(?:Sebelumnya|Previously)\s*:\s*([^\n\r]+)[\s\S]*?(?:Perkiraan|Forecast)\s*:\s*([^\n\r_]+)/gi;
      const seen = new Set();
      for (const item of (json.news || [])) {
        const text = (item.text || '') + '\n' + (item.textOriginal || '');
        let match;
        while ((match = regex.exec(text)) !== null) {
          const rawTitle = match[2].trim();
          const country = match[1].trim();
          const normKey = `${country}_${rawTitle.toLowerCase()}`;
          if (seen.has(normKey)) continue;
          seen.add(normKey);

          const rawTime = match[3].trim();
          const impactRaw = match[4].toLowerCase();
          const previous = match[5].trim();
          const forecast = match[6].trim();

          const baseDate = item.time ? new Date(item.time) : new Date();
          const ymd = !isNaN(baseDate.getTime()) ? baseDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          const dateStr = `${ymd}T${rawTime.length === 5 ? rawTime + ':00' : '12:00:00'}Z`;

          events.push({
            title: rawTitle,
            country,
            date: dateStr,
            impact: impactRaw.includes('tinggi') || impactRaw.includes('high') ? 'High' : 'Medium',
            forecast,
            previous,
            actual: '',
            source: 'telegram_news_feed'
          });
        }
      }
      if (events.length > 0) {
        return res.status(200).json(events);
      }
    }
  } catch (_) {}

  return res.status(200).json([]);
}
