import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../app/src/main/assets/apps/journal/journal-schema.js', import.meta.url),
  'utf8'
);

function createSchemaContext() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.AmyJournalSchema;
}

test('emptyEntry returns standard trade template with default values', () => {
  const schema = createSchemaContext();
  const entry = schema.emptyEntry();
  assert.ok(entry.id.startsWith('JRN-'));
  assert.equal(entry.pair, 'XAU/USD');
  assert.equal(entry.takeProfit1, '');
  assert.equal(entry.takeProfit2, '');
  assert.equal(entry.setupScore, '');
});

test('validate accepts single TP scalping trade (TP1 without TP2)', () => {
  const schema = createSchemaContext();
  const validSingleTp = {
    analysisTime: '2026-10-18T10:00:00Z',
    pair: 'XAU/USD',
    timeframe: 'M5',
    htfBias: 'BULLISH',
    setupType: 'Judas Swing',
    entryArea: '2650.00',
    stopLoss: '2645.00',
    takeProfit1: '2660.00',
    takeProfit2: '',
    setupScore: 85
  };

  const result = schema.validate(validSingleTp);
  assert.equal(result.ok, true);
  assert.equal(result.missing.length, 0);
});

test('validate accepts setup score of 0 without treating it as empty', () => {
  const schema = createSchemaContext();
  const entryWithZeroScore = {
    analysisTime: '2026-10-18T10:00:00Z',
    pair: 'XAU/USD',
    timeframe: 'M15',
    htfBias: 'BEARISH',
    setupType: 'Turtle Soup',
    entryArea: '2670.00',
    stopLoss: '2675.00',
    takeProfit1: '',
    takeProfit2: '2655.00',
    setupScore: 0 // Score 0 for failed setup
  };

  const result = schema.validate(entryWithZeroScore);
  assert.equal(result.ok, true);
  assert.equal(result.missing.length, 0);
});

test('validate rejects when both TP1 and TP2 are missing or setupScore is undefined', () => {
  const schema = createSchemaContext();
  const incompleteEntry = {
    analysisTime: '2026-10-18T10:00:00Z',
    pair: 'XAU/USD',
    timeframe: 'M5',
    htfBias: 'BULLISH',
    setupType: 'Silver Bullet',
    entryArea: '2650.00',
    stopLoss: '2645.00',
    takeProfit1: '',
    takeProfit2: '', // No TP defined
    setupScore: '' // Empty score
  };

  const result = schema.validate(incompleteEntry);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes('takeProfit1 / takeProfit2'));
  assert.ok(result.missing.includes('setupScore'));
});

test('computeRR calculates correct risk reward using TP1 or TP2', () => {
  const schema = createSchemaContext();
  // Entry 2650, SL 2645 (risk 5), TP1 2665 (reward 15) -> 3.00 R
  const rr1 = schema.computeRR({ entryArea: '2650.00', stopLoss: '2645.00', takeProfit1: '2665.00' });
  assert.equal(rr1, '3.00');

  // Entry 2650, SL 2640 (risk 10), TP2 2670 (reward 20) -> 2.00 R
  const rr2 = schema.computeRR({ actualEntryPrice: '2650.00', stopLoss: '2640.00', takeProfit2: '2670.00' });
  assert.equal(rr2, '2.00');
});
