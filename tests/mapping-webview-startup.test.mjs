import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/src/main/assets/apps/mapping/index.html', import.meta.url), 'utf8');

test('Mapping provides an ICU-safe fallback for Asia/Makassar', () => {
  assert.match(html, /options\.timeZone === 'Asia\/Makassar'/);
  assert.match(html, /fallback\.timeZone = 'Asia\/Singapore'/);
  assert.match(html, /Intl\.DateTimeFormat = AmyDateTimeFormat/);
});

test('Mapping never leaves an empty screen when startup rendering throws', () => {
  assert.match(html, /window\.__amyMappingStartupError/);
  assert.match(html, /MAPPING RECOVERY/);
  assert.match(html, /location\.reload\(\)/);
});
