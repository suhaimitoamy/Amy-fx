/**
 * Amy FX — News API (Vercel Serverless)
 * Sumber: SM_News_24h Telegram Channel (scraping web view)
 * Cache: 5 menit via Vercel CDN
 * Filter: Hanya berita yang relevan dengan XAU/USD
 * Translate: Auto-translate ke Bahasa Indonesia via Google Translate
 */

/**
 * Translate text dari English ke Bahasa Indonesia
 * Menggunakan Google Translate free API (gtx client)
 * Fallback: return teks asli jika gagal
 */
async function translateToId(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    const data = await r.json();
    return data[0].map(chunk => chunk[0]).join('');
  } catch (e) {
    return text;
  }
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { limit = '10' } = req.query;
    const maxItems = Math.min(parseInt(limit) || 10, 20);

    // Scrape Telegram public web view
    const html = await fetchWithRetry(
      `https://t.me/s/SM_News_24h?_=${Date.now()}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' } }
    );

    const posts = sortNewestFirst(extractPosts(html));
    const filtered = filterGold(posts);
    const latest = filtered.slice(0, maxItems);

    // Translate setiap item ke Bahasa Indonesia
    // Fallback: jika translate gagal, tetap tampilkan teks asli
    const translated = await Promise.all(
      latest.map(async item => ({
        ...item,
        textOriginal: item.text,
        text: await translateToId(item.text)
      }))
    );

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      source: 'SM_News_24h',
      updated: new Date().toISOString(),
      count: translated.length,
      news: translated
    });

  } catch (e) {
    return res.status(502).json({
      source: 'SM_News_24h',
      updated: new Date().toISOString(),
      count: 0,
      news: [],
      error: 'fetch_failed'
    });
  }
}

async function fetchWithRetry(url, opts, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

/**
 * Extract posts from Telegram web HTML
 * Pattern: data-post="SM_News_24h/ID" + message text in tgme_widget_message_text
 */
function extractPosts(html) {
  const posts = [];
  
  // Regex: capture post ID + message bubble content
  const msgRegex = /data-post="SM_News_24h\/(\d+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_author|<div class="tgme_widget_message_footer)/gi;
  
  let match;
  while ((match = msgRegex.exec(html)) !== null) {
    const id = match[1];
    let text = match[2];

    // Bersihkan HTML
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    // Skip if empty
    if (!text || text.length < 20) continue;

    posts.push({
      id,
      text,
      link: `https://t.me/SM_News_24h/${id}`,
      // Extract time from surrounding HTML (approximate)
      time: extractTime(html, match.index, msgRegex.lastIndex)
    });
  }

  return posts;
}

/** Extract approximate post time from surrounding HTML */
function extractTime(html, start, end) {
  const messageBlock = html.slice(start, Math.min(html.length, end + 1400));
  const currentTime = messageBlock.match(/datetime="([^"]+)"/);
  if (currentTime) return currentTime[1];
  const before = html.slice(Math.max(0, start - 500), start);
  const fallbackTime = before.match(/datetime="([^"]+)"/);
  if (fallbackTime) return fallbackTime[1];
  return '';
}

/**
 * Filter berita yang relevan untuk trader XAU/USD
 */
const GOLD_KEYWORDS = [
  'gold', 'goldman', 'xau', 'xauusd', 'bullion',
  'fed', 'powell', 'fomc', 'jerome',
  'cpi', 'inflation', 'inflasi',
  'ppi', 'pce',
  'nfp', 'nonfarm', 'payroll', 'employment', 'unemployment', 'jobless',
  'gdp', 'growth', 'recession', 'resesi',
  'rate', 'rates', 'interest rate', 'suku bunga', 'hike', 'cut', 'dovish', 'hawkish',
  'yield', 'treasury', 'bond', 'obligasi',
  'dollar', 'usd', 'dxy', 'index', 'indeks',
  'geopolitical', 'war', 'perang', 'iran', 'israel', 'russia', 'ukraine', 'china',
  'tariff', 'trade war', 'sanctions', 'sanksi',
  'oil', 'crude', 'energy',
  'central bank', 'ecb', 'boe', 'boj', 'pboc', 'bank sentral',
  'safe haven', 'haven', 'hedge',
  'brics', 'dedollarization',
  'pmi', 'ism', 'manufacturing',
  'retail sales', 'consumer', 'confidence', 'sentiment',
  'trump', 'biden',
];

function filterGold(posts) {
  return posts.filter(p => {
    const text = p.text.toLowerCase();
    return GOLD_KEYWORDS.some(kw => text.includes(kw));
  });
}

function sortNewestFirst(posts) {
  return [...posts].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export { extractPosts, filterGold, sortNewestFirst };
