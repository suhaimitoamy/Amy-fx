import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isWeekendClosure } from '../app/src/main/assets/apps/mapping/js/ict-workspace/scalper-panel.js';

test('Item 1.49: scalper-model.js resolves ENDPOINT dynamically on local preview', () => {
  const modelCode = fs.readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/scalper-model.js', 'utf8');
  assert.match(
    modelCode,
    /isLocal\s*=\s*typeof location !== 'undefined'/,
    'scalper-model.js must detect if running on local environment'
  );
  assert.match(
    modelCode,
    /export const ENDPOINT = isLocal \? `\$\{location\.origin\}\/api\/scalper-setups` : 'https:\/\/amy-fx\.vercel\.app\/api\/scalper-setups'/,
    'scalper-model.js must resolve dynamic local origin'
  );
});

test('Item 1.49: isWeekendClosure correctly flags weekend gold market closure', () => {
  // Saturday: always closed
  const saturday = Date.parse('2026-10-17T12:00:00Z') / 1000;
  assert.equal(isWeekendClosure(saturday), true, 'Saturday must be closed');

  // Sunday before 17:00 NY (e.g. 15:00 NY = 19:00 UTC): closed
  const sundayMorning = Date.parse('2026-10-18T15:00:00Z') / 1000;
  assert.equal(isWeekendClosure(sundayMorning), true, 'Sunday morning NY must be closed');

  // Monday: open
  const mondayTrading = Date.parse('2026-10-19T14:00:00Z') / 1000;
  assert.equal(isWeekendClosure(mondayTrading), false, 'Monday trading session must be open');
});

test('Item 1.49: scalper-panel.js schedule prevents 30s polling during weekend closure', () => {
  const panelCode = fs.readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/scalper-panel.js', 'utf8');
  assert.match(
    panelCode,
    /if \(isWeekendClosure\(\)\)\s*\{\s*\/\/[^\n]*\s*if \(!document\.hidden\) timer = setTimeout\(refresh, 900000\);\s*return;\s*\}/,
    'scalper-panel.js must defer refresh interval during weekend closure to prevent server spam'
  );
});
