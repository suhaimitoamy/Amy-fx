import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const filterPath = new URL('../lib/news-relevance.mjs', import.meta.url);
const filterSource = fs.readFileSync(filterPath, 'utf8');
const filterDataUrl = `data:text/javascript;base64,${Buffer.from(filterSource).toString('base64')}`;

const apiPath = new URL('../api/news.js', import.meta.url);
const rawApiSource = fs.readFileSync(apiPath, 'utf8');
const apiSource = rawApiSource
  .replace("'../lib/news-relevance.mjs'", `'${filterDataUrl}'`);
const api = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);

test('news diurutkan berdasarkan ID Telegram terbaru', () => {
  const result = api.sortNewestFirst([{ id: '101' }, { id: '305' }, { id: '220' }]);
  assert.deepEqual(result.map(x => x.id), ['305', '220', '101']);
});

test('Vercel memuat modul filter ESM secara dinamis', () => {
  assert.doesNotMatch(rawApiSource, /^import\s+.*news-relevance\.mjs/m);
  assert.match(rawApiSource, /import\('\.\.\/lib\/news-relevance\.mjs'\)/);
  assert.match(rawApiSource, /await loadNewsRelevance\(\)/);
});

test('market intel membawa ID berita pada deep-link notifikasi', () => {
  const appSource = fs.readFileSync(new URL('../app/src/main/assets/apps/market-intel/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /#news=\$\{encodeURIComponent\(id\)\}/);
  assert.match(appSource, /data-news-id/);
  assert.match(appSource, /focusNewsItem\(pendingNewsId\)/);
});

test('market intel integrates client-side auto-translation with offline local cache', () => {
  const appSource = fs.readFileSync(new URL('../app/src/main/assets/apps/market-intel/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /TRANSLATION_CACHE_KEY\s*=\s*'amy_news_tr_cache_v1'/);
  assert.match(appSource, /function getTranslationCache\(\)/);
  assert.match(appSource, /function saveTranslationToCache\(/);
  assert.match(appSource, /function needsClientTranslation\(/);
  assert.match(appSource, /async function translateTextClient\(/);
  assert.match(appSource, /function applyCachedTranslations\(/);
  assert.match(appSource, /async function autoTranslateNewsItems\(/);
  assert.match(appSource, /api\.mymemory\.translated\.net/);
  assert.match(appSource, /translate\.googleapis\.com/);
});

test('Supabase feed normalizes missing translations and retries failures', async t => {
  // Deterministic fixtures; no live translation or database writes in this test.
  const original = 'Gold rises as the dollar weakens.';
  const indonesian = 'Emas naik saat dolar melemah.';
  const unavailable = 'Terjemahan Bahasa Indonesia belum tersedia. Buka sumber untuk membaca berita asli.';
  let items = [
    { id: '1', text: original },
    { id: '2', text: original, textOriginal: original },
    { id: '3', text: '  ', textOriginal: original },
    { id: '4', text: unavailable, textOriginal: original },
    { id: '5', text: indonesian, textOriginal: original, impact: 'high' },
    { id: '6', text: ` ${original} `, textOriginal: original }
  ];
  let mode = 'success';
  let translationCalls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    const target = new URL(url);
    if (target.pathname.endsWith('/news-feed')) {
      return { ok: true, json: async () => ({ source: 'fixture', news: items }) };
    }
    assert.equal(target.origin, 'https://translate.googleapis.com');
    assert.equal(target.searchParams.get('tl'), 'id');
    translationCalls++;
    if (mode === 'network') throw new Error('offline fixture');
    if (mode === '429') return { ok: false, status: 429 };
    if (mode === 'malformed') return { ok: true, json: async () => ({ error: 'fixture' }) };
    const text = mode === 'unchanged' ? original : indonesian;
    return { ok: true, json: async () => [[[text]], null, 'en'] };
  });
  async function request() {
    const response = {
      setHeader() {},
      status(code) { this.code = code; return this; },
      json(payload) { this.payload = payload; return this; }
    };
    await api.default({ method: 'GET', query: { limit: '20' } }, response);
    assert.equal(response.code, 200);
    assert.equal(response.payload.backend, 'supabase');
    assert.equal(response.payload.count, items.length);
    return response.payload.news;
  }
  const input = structuredClone(items);
  const normalized = await request();
  assert.equal(translationCalls, 5);
  assert.ok(normalized.every(item => item.text === indonesian));
  assert.ok(normalized.every(item => item.textOriginal === original));
  assert.deepEqual(normalized.map(item => item.id), items.map(item => item.id));
  assert.equal(normalized[4].impact, 'high');
  assert.deepEqual(items, input, 'normalization must not mutate upstream items');

  for (mode of ['429', 'network', 'malformed', 'unchanged']) {
    items = [{ id: '1', text: original, textOriginal: original }];
    const failed = await request();
    assert.equal(failed[0].text, unavailable);
    assert.equal(failed[0].textOriginal, original);
  }
  items = [{ id: '1', text: unavailable, textOriginal: original }];
  mode = 'success';
  assert.equal((await request())[0].text, indonesian, 'failed translation can recover');
});