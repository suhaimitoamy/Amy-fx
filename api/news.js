const SUPABASE_NEWS_FEED =
  'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/news-feed';
const TELEGRAM_SOURCE = 'SM_News_24h';
const TELEGRAM_WEB_BASES = [
  'https://telegram.me/s',
  'https://telegram.dog/s'
];

let newsRelevancePromise;

function loadNewsRelevance() {
  if (!newsRelevancePromise) {
    newsRelevancePromise = import('../lib/news-relevance.mjs');
  }
  return newsRelevancePromise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const requestedLimit = Number.parseInt(String(req.query.limit || '20'), 10);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 20, 50));
  const telegramOnly = String(req.query.source || '').toLowerCase() === 'telegram';

  if (!telegramOnly) {
    try {
      const central = await fetchJsonWithTimeout(
        `${SUPABASE_NEWS_FEED}?limit=${limit}`,
        { headers: { Accept: 'application/json' } },
        1500
      );

      if (Array.isArray(central?.news) && central.news.length > 0) {
        central.news = await Promise.all(
          central.news.map(normalizeNewsTranslation)
        );

        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
        return res.status(200).json({
          ...central,
          count: central.news.length,
          backend: 'supabase'
        });
      }
    } catch (error) {
      console.warn('Supabase news feed unavailable, using Telegram fallback:', error?.message || error);
    }
  }

  try {
    const fallback = await scrapeTelegram(limit, true);
    res.setHeader('Cache-Control', telegramOnly
      ? 'no-store'
      : 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      source: TELEGRAM_SOURCE,
      updated: new Date().toISOString(),
      count: fallback.length,
      news: fallback,
      backend: telegramOnly ? 'telegram_direct' : 'telegram_fallback'
    });
  } catch (error) {
    console.error('News API failed:', error);
    return res.status(502).json({
      source: TELEGRAM_SOURCE,
      updated: new Date().toISOString(),
      count: 0,
      news: [],
      error: 'fetch_failed'
    });
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchTelegramHtml(retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    for (const base of TELEGRAM_WEB_BASES) {
      const url = `${base}/${TELEGRAM_SOURCE}?_=${Date.now()}`;
      try {
        const response = await fetchWithTimeout(url, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 AmyFX/1.0'
          }
        }, 15000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        if (!html.includes(`data-post="${TELEGRAM_SOURCE}/`)) {
          throw new Error('Telegram response contained no posts');
        }
        return html;
      } catch (error) {
        lastError = error;
      }
    }
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Telegram fetch failed');
}

async function translateToId(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetchWithTimeout(url, {}, 8000);
    if (!response.ok) return '';
    const data = await response.json();
    if (!Array.isArray(data?.[0])) return '';
    const translated = data[0].map(chunk => chunk?.[0] || '').join('').trim();
    return translated === text.trim() && data[2] !== 'id' ? '' : translated;
  } catch (_) {
    return '';
  }
}

const TRANSLATION_UNAVAILABLE = 'Terjemahan Bahasa Indonesia belum tersedia. Buka sumber untuk membaca berita asli.';

async function normalizeNewsTranslation(item) {
  if (!item || typeof item !== 'object') return item;
  const text = typeof item.text === 'string' ? item.text : '';
  const original = typeof item.textOriginal === 'string' && item.textOriginal.trim()
    ? item.textOriginal : text;
  if (!original.trim()) return { ...item, text: TRANSLATION_UNAVAILABLE };

  const needsTranslation = !text.trim() || text.trim() === original.trim()
    || text.trim() === TRANSLATION_UNAVAILABLE;
  return {
    ...item,
    textOriginal: original,
    text: needsTranslation
      ? (await translateToId(original)) || TRANSLATION_UNAVAILABLE
      : text
  };
}

async function scrapeTelegram(limit, shouldTranslate = true) {
  const { getNewsImpact, isRelevantNews } = await loadNewsRelevance();
  const html = await fetchTelegramHtml();
  const latest = sortNewestFirst(extractPosts(html)).slice(0, limit);

  return Promise.all(latest.map(async item => ({
    ...item,
    impact: getNewsImpact(item.text),
    relevant: isRelevantNews(item.text),
    textOriginal: item.text,
    text: shouldTranslate ? (await translateToId(item.text)) || TRANSLATION_UNAVAILABLE : item.text
  })));
}

function extractPosts(html) {
  const posts = [];
  const postPattern = /data-post="SM_News_24h\/(\d+)"/g;
  const indices = [];
  let m;
  while ((m = postPattern.exec(html)) !== null) {
    indices.push({ id: m[1], index: m.index });
  }

  for (let i = 0; i < indices.length; i++) {
    const current = indices[i];
    const nextIndex = (i + 1 < indices.length) ? indices[i + 1].index : html.length;
    const postChunk = html.slice(current.index, nextIndex);

    const textMatch = postChunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (!textMatch) continue;

    const rawText = textMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (rawText.length < 20) continue;

    const timeMatch = postChunk.match(/datetime="([^"]+)"/i);
    const time = timeMatch ? timeMatch[1] : '';

    posts.push({
      id: current.id,
      text: rawText,
      link: `https://telegram.me/${TELEGRAM_SOURCE}/${current.id}`,
      time
    });
  }
  return posts;
}

function filterGold(posts, isRelevantNews) {
  return posts.filter(post => isRelevantNews(post.text));
}

function sortNewestFirst(posts) {
  return [...posts].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export { extractPosts, filterGold, sortNewestFirst };
