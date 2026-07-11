import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiPath = new URL('../api/news.js', import.meta.url);
const apiSource = fs.readFileSync(apiPath, 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);

test('news diurutkan berdasarkan ID Telegram terbaru', () => {
  const result = api.sortNewestFirst([{ id: '101' }, { id: '305' }, { id: '220' }]);
  assert.deepEqual(result.map(x => x.id), ['305', '220', '101']);
});

test('market intel membawa ID berita pada deep-link notifikasi', () => {
  const appSource = fs.readFileSync(new URL('../app/src/main/assets/apps/market-intel/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /#news=\$\{encodeURIComponent\(id\)\}/);
  assert.match(appSource, /data-news-id/);
  assert.match(appSource, /focusNewsItem\(pendingNewsId\)/);
});
