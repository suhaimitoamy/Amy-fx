import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('MappingLogicCore: tracks brokenSwings to eliminate repeated duplicate BOS events (Item 1.31)', () => {
  const code = fs.readFileSync('app/src/main/java/com/amyelitesuite/MappingLogicCore.kt', 'utf8');

  // Verify brokenSwings set declaration
  assert.match(code, /val brokenSwings = mutableSetOf<Int>\(\)/, 'Must initialize brokenSwings set');

  // Verify filtering checks it.index !in brokenSwings
  assert.match(code, /it\.kind == SwingPoint\.Kind\.HIGH && it\.index !in brokenSwings/);
  assert.match(code, /it\.kind == SwingPoint\.Kind\.LOW && it\.index !in brokenSwings/);

  // Verify broken swing is added to brokenSwings upon break
  assert.match(code, /brokenSwings\.add\(previousHigh\.index\)/);
  assert.match(code, /brokenSwings\.add\(previousLow\.index\)/);
});
