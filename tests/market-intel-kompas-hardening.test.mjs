import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../app/src/main/assets/apps/market-intel/app.js', import.meta.url);
const appSource = fs.readFileSync(appPath, 'utf8');

const htmlPath = new URL('../app/src/main/assets/apps/market-intel/index.html', import.meta.url);
const htmlSource = fs.readFileSync(htmlPath, 'utf8');

const stylesPath = new URL('../app/src/main/assets/apps/market-intel/styles.css', import.meta.url);
const stylesSource = fs.readFileSync(stylesPath, 'utf8');

const apiNewsPath = new URL('../api/news.js', import.meta.url);
const apiNewsSource = fs.readFileSync(apiNewsPath, 'utf8');

const syncHandlerPath = new URL('../supabase/functions/news-sync/handler.ts', import.meta.url);
const syncHandlerSource = fs.readFileSync(syncHandlerPath, 'utf8');

test('Bug 1: Kompas without data provides neutral insufficient state, not SELL ON RALLY or live badge', () => {
  assert.match(appSource, /goldBias\s*=\s*['"]⚪ Belum Cukup Data Fundamental Baru['"]/);
  assert.match(appSource, /conclusionBias\s*=\s*['"]⚪ BELUM CUKUP DATA['"]/);
  assert.match(appSource, /briefing-sync-badge sync-disconnected.*🔴 Kalender Belum Terhubung/);
});

test('Bug 2: Macro event analyzer handles post-release actual vs forecast surprise', () => {
  const parseMatch = appSource.match(/function parseCalendarNumber[\s\S]*?^}/m);
  const analyzeMatch = appSource.match(/function analyzeMacroEvent[\s\S]*?^}/m);
  assert.ok(parseMatch && analyzeMatch);

  const evalScope = new Function(`
    ${parseMatch[0]}
    ${analyzeMatch[0]}
    return { parseCalendarNumber, analyzeMacroEvent };
  `)();

  const { analyzeMacroEvent } = evalScope;

  // Jobless claims: higher actual means labor cooling -> Gold Bullish Bounce
  const claimsReleasedHigh = analyzeMacroEvent({
    title: 'Initial Jobless Claims',
    forecast: '200K',
    previous: '195K',
    actual: '225K'
  });
  assert.equal(claimsReleasedHigh.bias, 'BULLISH_BOUNCE');
  assert.equal(claimsReleasedHigh.isReleased, true);

  // Jobless claims: lower actual means labor solid -> Gold Bearish Pressure
  const claimsReleasedLow = analyzeMacroEvent({
    title: 'Initial Jobless Claims',
    forecast: '200K',
    previous: '195K',
    actual: '185K'
  });
  assert.equal(claimsReleasedLow.bias, 'BEARISH_PRESSURE');
  assert.equal(claimsReleasedLow.isReleased, true);

  // Inflation: higher actual means hot inflation -> Fed Hawkish -> Gold Bearish Pressure
  const cpiReleasedHot = analyzeMacroEvent({
    title: 'Core CPI m/m',
    forecast: '0.3%',
    previous: '0.2%',
    actual: '0.5%'
  });
  assert.equal(cpiReleasedHot.bias, 'BEARISH_PRESSURE');
  assert.equal(cpiReleasedHot.isReleased, true);

  // Inflation: lower actual means cooling inflation -> Gold Bullish Bounce
  const cpiReleasedCool = analyzeMacroEvent({
    title: 'Core CPI m/m',
    forecast: '0.3%',
    previous: '0.2%',
    actual: '0.1%'
  });
  assert.equal(cpiReleasedCool.bias, 'BULLISH_BOUNCE');
  assert.equal(cpiReleasedCool.isReleased, true);
});

test('Bug 3: Calendar and Kompas accurately distinguish Live, Local Cache, and Stale Cache (>24h)', () => {
  assert.match(appSource, /🟢 Sinkronisasi Live \(WITA\)/);
  assert.match(appSource, /🟠 Cache Usang \(>24 Jam\)/);
  assert.match(appSource, /🟡 Cache Lokal \(Tersimpan\)/);
  assert.match(appSource, /briefing-sync-badge sync-live/);
  assert.match(appSource, /briefing-sync-badge sync-cache/);
  assert.match(appSource, /briefing-sync-badge sync-disconnected/);
});

test('Bug 4: Telegram parser isolates posts by boundary chunk in api/news.js and sync handler', () => {
  assert.ok(apiNewsSource.includes('postChunk = html.slice(current.index, nextIndex)'));
  assert.ok(syncHandlerSource.includes('postChunk = html.slice(current.index, nextIndex)'));
});

test('Bug 5: loadNews preserves cached news DOM on fetch failure', () => {
  assert.match(appSource, /if\s*\(list && list\.children\.length > 0\)\s*\{\s*status\.textContent\s*=\s*'Gagal sinkronisasi feed baru • Menampilkan berita tersimpan'/);
});

test('Bug 6: Calendar engine enforces per-endpoint 4s timeout and displays retry button on error', () => {
  assert.match(appSource, /setTimeout\(\(\) => controller\.abort\(\), 4000\)/);
  assert.match(appSource, /<button class="cal-retry-btn" onclick="loadCalendar\(\)">🔄 Coba Lagi<\/button>/);
});

test('Bug 7: Deep link expands fetch limit to 50 items when pendingNewsId is present', () => {
  assert.match(appSource, /const fetchLimit = pendingNewsId \? 50 : 20;/);
  assert.match(appSource, /\$\{API_BASE\}\/news\?limit=\$\{fetchLimit\}&fresh=/);
});

test('Bug 8: Gold relevance filter prevents notifications on non-gold topics', () => {
  assert.match(appSource, /function isNewsRelevantForGold/);
  assert.match(appSource, /if\s*\(lastNewsId && lastNewsId !== currentNewsId && isNewsRelevantForGold\(latestNews\)\)/);
});

test('Bug 9: Auto-translation enforces sequence counter to prevent overwriting newer feed', () => {
  assert.match(appSource, /let newsFetchSequence = 0;/);
  assert.match(appSource, /const currentSequence = \+\+newsFetchSequence;/);
  assert.match(appSource, /if \(sequence && sequence !== newsFetchSequence\) return;/);
  assert.match(appSource, /if \(currentSequence === newsFetchSequence\)/);
});

test('Bug 10: Fallback translation chunks into <= 450 chars and never caches truncated ellipsis strings', () => {
  assert.match(appSource, /function splitIntoTranslationChunks/);
  assert.match(appSource, /splitIntoTranslationChunks\(cleanText, 450\)/);
  assert.match(appSource, /if \(translatedText\.endsWith\('…'\) \|\| translatedText\.endsWith\('\.\.\.'\)\) return;/);
});

test('Bug 11: Dynamic calendar values are escaped before HTML insertion', () => {
  assert.match(appSource, /escapeHtml\(mainEvent\.forecast \|\| '—'\)/);
  assert.match(appSource, /escapeHtml\(mainEvent\.previous \|\| '—'\)/);
  assert.match(appSource, /escapeHtml\(mainEvent\.actual \|\| '—'\)/);
  assert.match(appSource, /escapeHtml\(mainEvent\.title\)/);
  assert.match(appSource, /escapeHtml\(ev\.forecast \|\| '—'\)/);
  assert.match(appSource, /escapeHtml\(ev\.actual\)/);
});

test('Kompas Fundamental UI: Kompas is default tab, primary priority, and retains all 3 tabs', () => {
  // Check index.html
  assert.match(htmlSource, /<button class="intel-tab active" data-tab="sentiment">/);
  assert.match(htmlSource, /<button class="intel-tab" data-tab="news">/);
  assert.match(htmlSource, /<button class="intel-tab" data-tab="calendar">/);
  assert.match(htmlSource, /<section id="panel-sentiment" class="intel-panel active">/);

  // Check app.js state
  assert.match(appSource, /let currentTab = 'sentiment';/);

  // Check evidence navigation helpers
  assert.match(appSource, /window\.openEvidenceNews = function/);
  assert.match(appSource, /window\.openEvidenceCalendar = function/);

  // Check Kompas question coverage
  assert.match(appSource, /kompas-horizon-pill/);
  assert.match(appSource, /dominant-factors-box/);
  assert.match(appSource, /kompas-evidence-cols/);
  assert.match(appSource, /col-support/);
  assert.match(appSource, /col-oppose/);
  assert.match(appSource, /scenario-box/);
  assert.match(appSource, /Jembatan Eksekusi ke Chart Mapping/);
});
