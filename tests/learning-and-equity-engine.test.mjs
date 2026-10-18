import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const readingHistorySource = readFileSync('app/src/main/assets/apps/academy/assets/js/reading-history-v2.js', 'utf8');
const journalAnalyticsSource = readFileSync('app/src/main/assets/apps/journal/journal-analytics.js', 'utf8');

test('Item 2.16: reading-history-v2.js supports 10 Modul Tematik Terpadu and syncs to Android', () => {
  assert.match(readingHistorySource, /modul-\(/i, 'reading-history-v2 must match modul-(XX) pattern');
  assert.match(readingHistorySource, /modul-tematik/, 'namespace for modul-XX must be modul-tematik');
  assert.match(readingHistorySource, /recordLastStudiedLesson/, 'must call recordLastStudiedLesson');

  // Verify behavior in mocked DOM context
  const recordedLessons = [];
  const localStorageStore = {};

  const context = {
    console,
    ROOT_PATH: '../',
    location: {
      href: 'http://localhost:8080/apps/academy/modul-01/index.html'
    },
    document: {
      readyState: 'complete',
      title: 'Modul 01 — Fondasi Trading — Amy FX Academy',
      documentElement: { scrollHeight: 2000, clientHeight: 800 },
      querySelector: (selector) => {
        if (selector.includes('.eyebrow')) {
          return null;
        }
        if (selector.includes('h1')) {
          return { textContent: 'Modul 01 — Fondasi Trading, Setup Alat Kerja & Manajemen Risiko Awal' };
        }
        if (selector.includes('.badge')) {
          return { textContent: '🏛️ MODUL 01 • FONDASI & STRUKTUR' };
        }
        if (selector.includes('.hero-card') || selector.includes('main')) {
          return { textContent: 'Hero Main Content' };
        }
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: () => {},
      dispatchEvent: () => {}
    },
    window: {
      scrollY: 250,
      Android: {
        recordLastStudiedLesson: (title, url, section) => {
          recordedLessons.push({ title, url, section });
        }
      },
      AmyLearningReminder: null,
      addEventListener: () => {}
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    localStorage: {
      getItem: (key) => localStorageStore[key] || null,
      setItem: (key, val) => { localStorageStore[key] = String(val); }
    },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {}
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.location = context.location;
  context.window.localStorage = context.localStorage;

  vm.createContext(context);
  vm.runInContext(readingHistorySource, context);

  assert.equal(recordedLessons.length, 1, 'Opening modul-01 must record lesson to Android bridge');
  assert.equal(recordedLessons[0].title, 'Modul 01 — Fondasi Trading, Setup Alat Kerja & Manajemen Risiko Awal');
  assert.equal(recordedLessons[0].section, '🏛️ MODUL 01 • FONDASI & STRUKTUR');
  assert.match(recordedLessons[0].url, /modul-01\/index\.html/);
});

test('Item 2.16: journal-analytics.js sorts trades chronologically and tracks dual R and $ metrics', () => {
  const context = {
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(journalAnalyticsSource, context);

  const analytics = context.window.AmyJournalAnalytics;
  assert.ok(analytics, 'AmyJournalAnalytics must be attached to window');

  // Input entries intentionally reverse chronological (newest first, oldest last)
  const entries = [
    {
      id: 'trade-3',
      date: '2026-10-18T15:00:00Z',
      result: 'Win',
      riskReward: 3,
      pnlMoney: 300
    },
    {
      id: 'trade-1',
      date: '2026-10-18T09:00:00Z',
      result: 'Win',
      riskReward: 2,
      pnlMoney: 200
    },
    {
      id: 'trade-2',
      date: '2026-10-18T12:00:00Z',
      result: 'Loss',
      riskReward: 2,
      pnlMoney: -100
    }
  ];

  const equityData = analytics.equity(entries);
  assert.equal(equityData.length, 3, 'Must process all 3 trades');

  // Must be chronologically ordered: trade-1 (09:00), trade-2 (12:00), trade-3 (15:00)
  assert.equal(equityData[0].time, '2026-10-18T09:00:00Z');
  assert.equal(equityData[0].balanceR, 2);
  assert.equal(equityData[0].balanceMoney, 200);

  assert.equal(equityData[1].time, '2026-10-18T12:00:00Z');
  assert.equal(equityData[1].balanceR, 1); // 2 - 1 = 1R
  assert.equal(equityData[1].balanceMoney, 100); // 200 - 100 = $100

  assert.equal(equityData[2].time, '2026-10-18T15:00:00Z');
  assert.equal(equityData[2].balanceR, 4); // 1 + 3 = 4R
  assert.equal(equityData[2].balanceMoney, 400); // 100 + 300 = $400

  // Test SVG rendering with dual metrics
  const svgHtml = analytics.renderEquitySVG(entries);
  assert.match(svgHtml, /CHRONOLOGICAL REAL &amp; R/);
  assert.match(svgHtml, /\+4\.00 R/);
  assert.match(svgHtml, /\+\$400\.00/);
});
