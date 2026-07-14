const SUPABASE_NEWS_FEED =
  'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/news-feed';
const TELEGRAM_SOURCE = 'SM_News_24h';

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
        9000
      );

      if (Array.isArray(central?.news) && central.news.length > 0) {
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
    const fallback = await scrapeTelegram(limit, !telegramOnly);
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

async function resolveIpv4(hostname) {
  const endpoints = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`
  ];
  let lastError;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        headers: { Accept: 'application/dns-json' }
      }, 6000);
      if (!response.ok) throw new Error(`DNS HTTP ${response.status}`);
      const payload = await response.json();
      const address = payload?.Answer?.find(
        answer => answer?.type === 1 && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(answer?.data || '')
      )?.data;
      if (address) return address;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Unable to resolve ${hostname}`);
}

async function fetchHttpsWithResolvedIp(url, options = {}, timeoutMs = 12000) {
  const target = new URL(url);
  const address = await resolveIpv4(target.hostname);
  const { request } = await import('node:https');

  return new Promise((resolve, reject) => {
    const req = request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: options.headers || {},
      servername: target.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, 4)
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = Number(response.statusCode || 0);
        if (status < 200 || status >= 300) {
          reject(new Error(`Telegram HTTP ${status}: ${text.slice(0, 200)}`));
          return;
        }
        resolve(text);
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error('Telegram request timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function fetchTelegramTextWithRetry(url, options, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, 12000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (directError) {
      try {
        return await fetchHttpsWithResolvedIp(url, options, 12000);
      } catch (resolvedError) {
        lastError = new Error(
          `Telegram direct failed: ${directError?.message || directError}; resolved-IP fallback failed: ${resolvedError?.message || resolvedError}`
        );
      }
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function translateToId(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetchWithTimeout(url, {}, 8000);
    if (!response.ok) return text;
    const data = await response.json();
    if (!Array.isArray(data?.[0])) return text;
    return data[0].map(chunk => chunk?.[0] || '').join('').trim() || text;
  } catch (_) {
    return text;
  }
}

async function scrapeTelegram(limit, shouldTranslate = true) {
  const { getNewsImpact, isRelevantNews } = await loadNewsRelevance();
  const html = await fetchTelegramTextWithRetry(
    `https://t.me/s/${TELEGRAM_SOURCE}?_=${Date.now()}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 AmyFX/1.0' } }
  );

  const latest = sortNewestFirst(extractPosts(html)).slice(0, limit);
  return Promise.all(latest.map(async item => ({
    ...item,
    impact: getNewsImpact(item.text),
    relevant: isRelevantNews(item.text),
    textOriginal: item.text,
    text: shouldTranslate ? await translateToId(item.text) : item.text
  })));
}

function extractPosts(html) {
  const posts = [];
  const msgRegex = /data-post="SM_News_24h\/(\d+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_author|<div class="tgme_widget_message_footer)/gi;

  let match;
  while ((match = msgRegex.exec(html)) !== null) {
    let text = match[2]
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

    if (text.length < 20) continue;
    posts.push({
      id: match[1],
      text,
      link: `https://t.me/${TELEGRAM_SOURCE}/${match[1]}`,
      time: extractTime(html, match.index, msgRegex.lastIndex)
    });
  }
  return posts;
}

function extractTime(html, start, end) {
  const block = html.slice(start, Math.min(html.length, end + 1600));
  const current = block.match(/datetime="([^"]+)"/);
  if (current) return current[1];
  const before = html.slice(Math.max(0, start - 700), start);
  return before.match(/datetime="([^"]+)"/)?.[1] || '';
}

function filterGold(posts, isRelevantNews) {
  return posts.filter(post => isRelevantNews(post.text));
}

function sortNewestFirst(posts) {
  return [...posts].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export { extractPosts, filterGold, sortNewestFirst };
