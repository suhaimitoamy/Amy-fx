// Public Telegram news only; retain the existing Google translation destination.
// Never persist a failed translation as if it were Indonesian.
const cache = new Map();
const pending = new Map();
async function translateChunk(text, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=' + encodeURIComponent(text);
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) return null;
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map(part => String(part?.[0] || '')).join('').trim() : '';
    if (!translated) return null;
    // An unchanged non-Indonesian response is not a successful translation.
    if (translated === text.trim() && data[2] !== 'id') return null;
    return translated;
  } catch (_) { return null; }
  finally { clearTimeout(timer); }
}
export async function translateNewsToId(value, options = {}) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (cache.has(text)) return cache.get(text);
  if (pending.has(text)) return pending.get(text);
  const job = (async () => {
    const chunks = [];
    let rest = text;
    while (rest.length > 1200) {
      let end = rest.lastIndexOf(' ',1200);
      if (end < 600) end = 1200;
      chunks.push(rest.slice(0,end)); rest = rest.slice(end).trimStart();
    }
    if (rest) chunks.push(rest);
    const results = await Promise.all(chunks.map(async chunk => {
      let result = await translateChunk(chunk, options.timeoutMs || 3500);
      if (!result && options.retry !== false) result = await translateChunk(chunk, 2500);
      return result;
    }));
    if (results.some(result => !result)) return null;
    const translated = results.join('\n');
    if (cache.size >= 300) cache.delete(cache.keys().next().value);
    cache.set(text, translated);
    return translated;
  })();
  pending.set(text, job);
  try { return await job; } finally { pending.delete(text); }
}
