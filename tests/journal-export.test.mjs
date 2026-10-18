import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../app/src/main/assets/apps/journal/journal-export.js', import.meta.url);
const code = readFileSync(file, 'utf8');

function setupEnvironment() {
  const revokedUrls = [];
  const createdUrls = [];
  let clickedElement = null;
  const timeouts = [];

  const context = {
    console,
    Blob: class MockBlob {
      constructor(content, options) {
        this.content = content;
        this.options = options;
      }
    },
    URL: {
      createObjectURL(blob) {
        const url = `blob:http://localhost/${Math.random().toString(36).slice(2)}`;
        createdUrls.push({ url, blob });
        return url;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      }
    },
    document: {
      createElement(tag) {
        return {
          tag,
          href: '',
          download: '',
          click() {
            clickedElement = { ...this };
          }
        };
      }
    },
    setTimeout(fn, delay) {
      timeouts.push({ fn, delay });
      return timeouts.length;
    },
    window: {}
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);

  return {
    exportUtil: context.window.AmyJournalExport,
    revokedUrls,
    createdUrls,
    getClickedElement: () => clickedElement,
    timeouts
  };
}

test('toCsv produces correctly formatted and escaped CSV', () => {
  const { exportUtil } = setupEnvironment();
  const entries = [
    { id: 1, note: 'Normal note', bias: 'BUY' },
    { id: 2, note: 'Note with "quotes" and, commas', bias: 'SELL' }
  ];
  const csv = exportUtil.toCsv(entries);
  assert.ok(csv.startsWith('id,note,bias'));
  assert.ok(csv.includes('"Note with ""quotes"" and, commas"'));
});

test('Item 1.48: toCsv unions keys across all entries so optional fields are never lost', () => {
  const { exportUtil } = setupEnvironment();

  // Trade 1 is minimal, Trade 2 has setupScore and reflection, Trade 3 has screenshotUrl
  const entries = [
    { id: 1, date: '2026-10-18', symbol: 'XAU/USD', bias: 'BUY' },
    { id: 2, date: '2026-10-18', symbol: 'XAU/USD', bias: 'SELL', setupScore: 9, reflection: 'Wait for M5 rejection close' },
    { id: 3, date: '2026-10-18', symbol: 'XAU/USD', bias: 'BUY', screenshotUrl: 'https://amy-fx.app/shots/1.png', takeProfit2: 2680.5 }
  ];

  const csv = exportUtil.toCsv(entries);
  const lines = csv.split('\n');
  const header = lines[0].split(',');

  // All keys from all entries must exist in header
  assert.ok(header.includes('id'));
  assert.ok(header.includes('date'));
  assert.ok(header.includes('symbol'));
  assert.ok(header.includes('bias'));
  assert.ok(header.includes('setupScore'));
  assert.ok(header.includes('reflection'));
  assert.ok(header.includes('screenshotUrl'));
  assert.ok(header.includes('takeProfit2'));

  // Data rows must correctly format values and missing values as empty string
  assert.ok(lines[1].includes('"BUY"'));
  assert.ok(lines[2].includes('"9"'));
  assert.ok(lines[2].includes('"Wait for M5 rejection close"'));
  assert.ok(lines[3].includes('"https://amy-fx.app/shots/1.png"'));
  assert.ok(lines[3].includes('"2680.5"'));
});

test('toCsv handles empty or invalid inputs safely without error', () => {
  const { exportUtil } = setupEnvironment();
  assert.equal(exportUtil.toCsv([]), '');
  assert.equal(exportUtil.toCsv(null), '');
  assert.equal(exportUtil.toCsv(undefined), '');
});

test('downloadCsv dispatches download asynchronously and delays URL revocation by 15s', () => {
  const env = setupEnvironment();
  const entries = [{ id: 101, bias: 'BUY' }];

  env.exportUtil.downloadCsv(entries, 'custom-journal.csv');

  const clicked = env.getClickedElement();
  assert.ok(clicked, 'Click event should have been dispatched on anchor element');
  assert.equal(clicked.download, 'custom-journal.csv');
  assert.ok(clicked.href.startsWith('blob:http://localhost/'));

  // Critical check: revokeObjectURL must NOT be called synchronously
  assert.equal(env.revokedUrls.length, 0, 'URL must not be revoked synchronously to prevent aborting download in WebView');

  // Verify timer was scheduled for 15,000ms
  assert.equal(env.timeouts.length, 1);
  assert.equal(env.timeouts[0].delay, 15000);

  // Trigger timeout callback
  env.timeouts[0].fn();
  assert.equal(env.revokedUrls.length, 1);
  assert.equal(env.revokedUrls[0], clicked.href);
});
