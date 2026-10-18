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

test('Item 2.21: toCsv orders columns hierarchically by technical group while retaining custom fields', () => {
  const { exportUtil } = setupEnvironment();
  const entries = [
    {
      customIndicator: 'EMA200',
      pnlMoney: 150,
      id: 'JRN-1',
      setupType: 'FVG Sweep',
      pair: 'XAU/USD',
      actualEntryPrice: 2650.5
    }
  ];

  const keys = exportUtil.getOrderedKeys(entries);
  assert.equal(keys[0], 'id');
  assert.equal(keys[1], 'pair');
  assert.equal(keys[2], 'setupType');
  assert.equal(keys[3], 'actualEntryPrice');
  assert.equal(keys[4], 'pnlMoney');
  assert.equal(keys[5], 'customIndicator'); // Custom user field appended after standard keys

  const csv = exportUtil.toCsv(entries);
  assert.ok(csv.startsWith('id,pair,setupType,actualEntryPrice,pnlMoney,customIndicator'));
});

test('Item 2.21: toJsonBackup and downloadJsonBackup produce v2 schema backup and dispatch download', () => {
  const env = setupEnvironment();
  const entries = [
    { id: 'JRN-1', pair: 'XAU/USD', result: 'WIN', pnlMoney: 250 },
    { id: 'JRN-2', pair: 'XAU/USD', result: 'BE', pnlMoney: 0 }
  ];

  const jsonStr = env.exportUtil.toJsonBackup(entries, { note: 'Offline backup' });
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.schemaVersion, 'amyfx-journal-backup-v2');
  assert.equal(parsed.app, 'Amy FX Pro Journal');
  assert.equal(parsed.totalEntries, 2);
  assert.equal(parsed.metadata.note, 'Offline backup');
  assert.equal(parsed.entries.length, 2);

  // Test downloadJsonBackup
  env.exportUtil.downloadJsonBackup(entries, 'backup-test.json');
  const clicked = env.getClickedElement();
  assert.ok(clicked);
  assert.equal(clicked.download, 'backup-test.json');
  assert.ok(clicked.href.startsWith('blob:http://localhost/'));
});

test('Item 2.21: parseAndValidateBackup validates v2 schema, legacy formats, and rejects invalid payloads', () => {
  const { exportUtil } = setupEnvironment();

  // 1. Valid v2 backup
  const v2Payload = JSON.stringify({
    schemaVersion: 'amyfx-journal-backup-v2',
    exportedAt: '2026-10-18T12:00:00Z',
    entries: [{ id: '1', pair: 'XAU/USD' }, { id: '2', pair: 'XAU/USD' }]
  });
  const res1 = exportUtil.parseAndValidateBackup(v2Payload);
  assert.equal(res1.ok, true);
  assert.equal(res1.count, 2);
  assert.equal(res1.schemaVersion, 'amyfx-journal-backup-v2');

  // 2. Legacy backup with journals array
  const legacyPayload = JSON.stringify({
    journals: [{ id: 'leg-1' }]
  });
  const res2 = exportUtil.parseAndValidateBackup(legacyPayload);
  assert.equal(res2.ok, true);
  assert.equal(res2.count, 1);
  assert.equal(res2.schemaVersion, 'legacy-v1');

  // 3. Raw array backup
  const rawArray = JSON.stringify([{ id: 'arr-1' }, { id: 'arr-2' }, { id: 'arr-3' }]);
  const res3 = exportUtil.parseAndValidateBackup(rawArray);
  assert.equal(res3.ok, true);
  assert.equal(res3.count, 3);

  // 4. Invalid corrupted payload
  const corrupted = '{ invalid json !! }';
  const res4 = exportUtil.parseAndValidateBackup(corrupted);
  assert.equal(res4.ok, false);
  assert.ok(res4.error.includes('Gagal mem-parsing'));

  // 5. Object missing entries/journals
  const missingData = JSON.stringify({ version: 1, foo: 'bar' });
  const res5 = exportUtil.parseAndValidateBackup(missingData);
  assert.equal(res5.ok, false);
  assert.ok(res5.error.includes('tidak mengandung daftar entri'));
});

test('Item 2.32: parseCsv parses complex CSV with quotes, commas, and multiline text', () => {
  const { exportUtil } = setupEnvironment();
  const csv = 'id,pair,entryArea,stopLoss,planNote\n' +
    '"JRN-1","XAU/USD","2650.50","2645.00","Wait for M5 rejection, enter on 50% CE"\n' +
    '"JRN-2","EUR/USD","1.0850","1.0820","Standard ""Turtle Soup"" liquidity sweep"';

  const entries = exportUtil.parseCsv(csv);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, 'JRN-1');
  assert.equal(entries[0].pair, 'XAU/USD');
  assert.equal(entries[0].planNote, 'Wait for M5 rejection, enter on 50% CE');
  assert.equal(entries[1].id, 'JRN-2');
  assert.equal(entries[1].planNote, 'Standard "Turtle Soup" liquidity sweep');
});

test('Item 2.32: computeFingerprint generates deterministic transaction signature', () => {
  const { exportUtil } = setupEnvironment();
  const entryA = { actualEntryTime: '2026-10-18T14:30:00Z', pair: 'XAU/USD', actualEntryPrice: 2650.5, stopLoss: 2645.0 };
  const entryB = { actualEntryTime: '2026-10-18T14:30:00Z', symbol: 'xauusd', actualEntryPrice: '2650.500', stopLoss: '2645' };

  const fpA = exportUtil.computeFingerprint(entryA);
  const fpB = exportUtil.computeFingerprint(entryB);
  assert.equal(fpA, fpB);
  assert.equal(fpA, '2026-10-18T14:30:00Z::XAUUSD::2650.50::2645.00');
});

test('Item 2.32: reconcileJournals skips duplicate entries and adds only new ones', () => {
  const { exportUtil } = setupEnvironment();
  const existing = [
    { id: 'JRN-101', date: '2026-10-18', pair: 'XAU/USD', entryArea: 2650, stopLoss: 2645 }
  ];

  const imported = [
    // Duplicate by exact id
    { id: 'JRN-101', date: '2026-10-18', pair: 'XAU/USD', entryArea: 2650, stopLoss: 2645 },
    // Duplicate by fingerprint
    { id: 'JRN-999', date: '2026-10-18', pair: 'XAU/USD', entryArea: 2650, stopLoss: 2645 },
    // Truly new entry
    { id: 'JRN-202', date: '2026-10-19', pair: 'XAU/USD', entryArea: 2660, stopLoss: 2655, setupType: 'FVG' }
  ];

  const result = exportUtil.reconcileJournals(existing, imported);
  assert.equal(result.totalImported, 3);
  assert.equal(result.skippedCount, 2);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].id, 'JRN-202');
  assert.equal(result.merged.length, 2);
});


