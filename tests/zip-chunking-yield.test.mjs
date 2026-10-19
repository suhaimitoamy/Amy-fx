import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/data-provider.js', 'utf8');

test('data-provider.js scanZip yields 16ms between entries to prevent UI freeze and ANR (Item 1.6)', () => {
  // Extract scanZip function body
  const scanMatch = code.match(/async function scanZip\([\s\S]*?\n  \}/);
  assert.ok(scanMatch, 'scanZip function must exist');
  const scanBody = scanMatch[0];

  // Verify m1Entries > 1 loop contains chunking yield with 16ms delay
  const m1LoopPattern = /for\s*\(\s*var m\s*=\s*0;\s*m\s*<\s*m1Entries\.length;\s*m\s*\+=\s*1\s*\)\s*\{[\s\S]*?setTimeout\s*\(\s*resolve\s*,\s*16\s*\)/;
  assert.match(scanBody, m1LoopPattern, 'm1Entries extraction loop must yield 16ms (1 frame @ 60fps) after each file');

  // Verify nested zip extraction loop yields 16ms
  const nestedLoopPattern = /for\s*\(\s*var i\s*=\s*0;\s*i\s*<\s*nested\.length;\s*i\s*\+=\s*1\s*\)\s*\{[\s\S]*?setTimeout\s*\(\s*resolve\s*,\s*16\s*\)/;
  assert.match(scanBody, nestedLoopPattern, 'nested zip loop must yield 16ms after each archive extraction');
});
