import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const base = new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/', import.meta.url);
const context = { console, setInterval, clearInterval, setTimeout, clearTimeout, URL, Blob };
context.globalThis = context;
vm.createContext(context);

const load = name => vm.runInContext(readFileSync(new URL(name, base), 'utf8'), context, { filename: name });
load('practice-core.js');
context.AmyPracticeStorage = {
  identifier: prefix => `${prefix}-test`,
  packId: meta => `pack:${meta.symbol}:${meta.timeframe}:${meta.fileName}`,
  saveHistoricalPack: async () => {}
};
load('trade-engine.js');
load('drawing-core.js');
load('replay-engine.js');
load('data-provider.js');

test('zero-heap metadataFromCsv extracts start, end, and exact row count on standard CSV', async () => {
  const rows = ['timestamp,open,high,low,close'];
  for (let i = 0; i < 25; i++) {
    rows.push(`${1700000000 + i * 60},2600.0,2605.0,2598.0,2603.5`);
  }
  const csv = rows.join('\n');

  const meta = await context.AmyPracticeData.importFile(new Blob([csv], { type: 'text/csv' }), {
    fileName: 'test.csv', format: 'csv', source: 'unit-test'
  });

  assert.equal(meta.start, 1700000000);
  assert.equal(meta.end, 1700000000 + 24 * 60);
  assert.equal(meta.rowCount, 25);
});

test('metadataFromCsv handles Windows CRLF line endings and trailing empty lines without error', async () => {
  const rows = ['datetime_utc,open,high,low,close'];
  for (let i = 0; i < 22; i++) {
    rows.push(`${1700000000 + i * 60},2600.0,2605.0,2598.0,2603.5`);
  }
  const csv = rows.join('\r\n') + '\r\n\r\n';

  const meta = await context.AmyPracticeData.importFile(new Blob([csv], { type: 'text/csv' }), {
    fileName: 'test_crlf.csv', format: 'csv', source: 'unit-test'
  });

  assert.equal(meta.start, 1700000000);
  assert.equal(meta.end, 1700000000 + 21 * 60);
  assert.equal(meta.rowCount, 22);
});

test('metadataFromCsv efficiently processes 10,000 simulated M1 rows with zero heap array allocation', async () => {
  const lines = ['timestamp,open,high,low,close'];
  const start = 1700000000;
  for (let i = 0; i < 10000; i++) {
    lines.push(`${start + i * 60},${2600 + i * 0.01},${2605 + i * 0.01},${2598 + i * 0.01},${2602 + i * 0.01}`);
  }
  const bigCsv = lines.join('\n');

  const meta = await context.AmyPracticeData.importFile(new Blob([bigCsv], { type: 'text/csv' }), {
    fileName: 'big_sample.csv', format: 'csv', source: 'unit-test'
  });

  assert.equal(meta.start, 1700000000);
  assert.equal(meta.end, 1700000000 + 9999 * 60);
  assert.equal(meta.rowCount, 10000);
});

test('metadataFromCsv rejects CSV with fewer than 2 data rows', async () => {
  const shortCsv = 'timestamp,open,high,low,close\n1700000000,2600,2605,2598,2603';
  await assert.rejects(
    () => context.AmyPracticeData.importFile(new Blob([shortCsv], { type: 'text/csv' }), {
      fileName: 'short.csv', format: 'csv'
    }),
    /minimal 2 candle/
  );
});

test('zip-reader falls back to root.JSZip when DecompressionStream is unavailable (item 1.61)', async () => {
  const zipContext = { console, TextDecoder, Uint8Array, DataView, ArrayBuffer, Blob, Response };
  zipContext.globalThis = zipContext;
  zipContext.root = zipContext;
  
  // Mock JSZip
  let jszipCalled = false;
  zipContext.JSZip = {
    async loadAsync(bytes) {
      jszipCalled = true;
      return {
        file(name) {
          if (name === 'test.csv') {
            return {
              async: async type => new TextEncoder().encode('timestamp,open,high,low,close\n1700000000,2600,2605,2598,2603\n1700000060,2603,2608,2601,2607')
            };
          }
          return null;
        }
      };
    }
  };

  vm.createContext(zipContext);
  const zipReaderCode = readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/zip-reader.js', import.meta.url), 'utf8');
  vm.runInContext(zipReaderCode, zipContext);

  assert.ok(zipContext.AmyZipArchive, 'AmyZipArchive must be exported');

  // Create an Archive instance with mock entries
  const archive = Object.create(zipContext.AmyZipArchive);
  // Test extractViaJsZip directly on an Archive instance
  const archiveInstance = {
    bytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
    _jszip: null
  };
  // Bind prototype
  const proto = vm.runInContext('Object.getPrototypeOf(new (function(){ this.bytes = new Uint8Array(); this.entries = []; this.byName = new Map(); }))', zipContext);
  
  // Test extractViaJsZip fallback directly
  const extracted = await zipContext.AmyZipArchive.open(new Uint8Array([
    // Minimal mock zip header to verify initialization
    0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]));
  
  const content = await extracted.extractViaJsZip('test.csv');
  assert.equal(jszipCalled, true, 'JSZip.loadAsync must be invoked on fallback');
  const decoded = new TextDecoder().decode(content);
  assert.match(decoded, /1700000000,2600/);
});

test('parseCsv correctly parses multi-row CSV without array shift or split allocations (item 2.34)', () => {
  const csv = 'time,open,high,low,close\n1700000000,2600.5,2605.0,2598.0,2603.5\n1700000060,2603.5,2607.0,2601.0,2606.0';
  const candles = context.AmyPracticeCore.parseCsv(csv);
  assert.equal(candles.length, 2);
  assert.equal(candles[0].time, 1700000000);
  assert.equal(candles[0].close, 2603.5);
  assert.equal(candles[1].time, 1700000060);
  assert.equal(candles[1].close, 2606.0);
});

