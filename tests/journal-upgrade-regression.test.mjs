import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../app/src/main/assets/apps/journal/amy-journal-final-fix-legacy.js', import.meta.url),
  'utf8'
);
const loader = fs.readFileSync(
  new URL('../app/src/main/assets/apps/journal/amy-journal-final-fix.js', import.meta.url),
  'utf8'
);
const css = fs.readFileSync(
  new URL('../app/src/main/assets/apps/journal/amy-journal-final-fix.css', import.meta.url),
  'utf8'
);

function createRuntime() {
  const values = new Map();
  const listeners = new Map();
  const classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const document = {
    readyState: 'loading',
    hidden: false,
    body: { classList, append() {}, appendChild() {} },
    addEventListener(type, handler) {
      const current = listeners.get(type) || [];
      current.push(handler);
      listeners.set(type, current);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
      return {
        className: '', dataset: {}, style: {}, classList,
        append() {}, appendChild() {}, remove() {}, click() {}, setAttribute() {},
        insertBefore() {}, addEventListener() {}, querySelector() { return null; },
        querySelectorAll() { return []; }, options: [], value: '', textContent: ''
      };
    }
  };
  const window = {
    document,
    CSS: {},
    addEventListener(type, handler) {
      const current = listeners.get(type) || [];
      current.push(handler);
      listeners.set(type, current);
    },
    focus() {},
    location: { reload() {} }
  };
  const context = {
    window,
    document,
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: window.location,
    navigator: {},
    Blob: class Blob {},
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    crypto: { randomUUID() { return 'uuid'; } },
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    Date, Intl, Map, Set, Math, Number, String, Array, Object, RegExp, JSON, console
  };
  window.localStorage = context.localStorage;
  window.sessionStorage = context.sessionStorage;
  window.crypto = context.crypto;
  vm.runInNewContext(source, context);
  return window;
}

test('journal upgrade exposes stable statistics and filtering helpers', () => {
  const window = createRuntime();
  const api = window.AmyJournalUpgrade;
  assert.ok(api);

  const journals = [
    { id: '1', date: '2026-07-10', title: 'London buy', market: 'XAUUSD', setup: 'FVG', result: 'Win', profit: 100, loss: 0 },
    { id: '2', date: '2026-07-11', title: 'NY sell', market: 'XAUUSD', setup: 'OB', result: 'Loss', profit: 0, loss: 40 },
    { id: '3', date: '2026-07-12', title: 'No trade', market: 'EURUSD', setup: 'No Trade', result: 'BE', profit: 0, loss: 0 }
  ];
  const stats = api.calculateStats(journals);
  assert.equal(stats.total, 3);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.net, 60);
  assert.equal(stats.profitFactor, 2.5);
  assert.equal(stats.average, 20);

  const filtered = api.filterJournals(
    journals,
    { query: 'london', result: 'Win', market: 'XAUUSD', period: 'all' },
    {}
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '1');
});

test('journal upgrade keeps reliability, draft, export, and trade-plan features', () => {
  assert.match(loader, /amy-journal-final-fix-legacy\.js\?v=20260725-v159/);
  assert.match(loader, /amy-journal-ai-runtime-fix\.js\?v=20260725-v159/);
  assert.match(source, /CSS\.escape/);
  assert.match(source, /makeStatCard/);
  assert.match(source, /filterGridItems/);
  assert.match(source, /JOURNAL_DRAFT_KEY/);
  assert.match(source, /amyJournalDashboard/);
  assert.match(source, /exportJournalCsv/);
  assert.match(source, /amyJournalExtendedFields/);
  assert.doesNotMatch(source, /new\s+MutationObserver/);
  assert.match(css, /\.amy-journal-dashboard/);
  assert.match(css, /\.amy-journal-extended/);
  assert.match(css, /\.amy-journal-extra-strip/);
});

test('PIN lock overlay is rebranded to AMY FX and enforces DOM isolation (item 1.64)', () => {
  const appJs = fs.readFileSync(
    new URL('../app/src/main/assets/apps/journal/app.js', import.meta.url),
    'utf8'
  );
  const journalCss = fs.readFileSync(
    new URL('../app/src/main/assets/apps/journal/style.css', import.meta.url),
    'utf8'
  );

  // 1. Must not contain legacy TL mark
  assert.doesNotMatch(appJs, /<div class="brand-mark">TL<\/div>/, 'Legacy TL branding mark must be eliminated');

  // 2. Must contain AMY FX brand mark and lock badge
  assert.match(appJs, /<div class="brand-mark"[^>]*>AMY FX<\/div>/, 'Must display AMY FX branding in PIN lock');
  assert.match(appJs, /🔒/, 'Must display lock badge icon');

  // 3. Must apply is-locked class to document.body and style.css must hide .app-shell
  assert.match(appJs, /document\.body\.classList\.add\("is-locked"\)/);
  assert.match(appJs, /document\.body\.classList\.remove\("is-locked"\)/);
  assert.match(journalCss, /body\.is-locked \.app-shell\s*\{\s*display:\s*none !important;\s*\}/);

  // 4. In boot(), enforcePinLock must be awaited before loadItems and render
  const pinLockIdx = appJs.indexOf('await enforcePinLock()');
  const loadItemsIdx = appJs.indexOf('loadItems()');
  const renderIdx = appJs.indexOf('render()');
  assert.ok(pinLockIdx > 0 && pinLockIdx < loadItemsIdx, 'enforcePinLock must be awaited before loadItems');
  assert.ok(loadItemsIdx < renderIdx, 'loadItems must precede render');
});

