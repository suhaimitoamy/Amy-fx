import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('1. Native audio asset amy_gold_chime.wav exists with valid RIFF WAVE header', () => {
  const wavPath = path.join(ROOT, 'app/src/main/res/raw/amy_gold_chime.wav');
  assert.ok(fs.existsSync(wavPath), 'WAV resource must exist');
  const buffer = fs.readFileSync(wavPath);
  assert.ok(buffer.length > 10000, 'WAV size should be >10KB');
  const riff = buffer.subarray(0, 4).toString('ascii');
  const wave = buffer.subarray(8, 12).toString('ascii');
  assert.equal(riff, 'RIFF', 'Header must be RIFF');
  assert.equal(wave, 'WAVE', 'Format must be WAVE');
});

test('2. MainActivity.kt contains triggerPatternHaptic and playNativeChime bridge methods', () => {
  const mainActivityPath = path.join(ROOT, 'app/src/main/java/com/amyelitesuite/MainActivity.kt');
  const content = fs.readFileSync(mainActivityPath, 'utf8');
  assert.match(content, /fun triggerPatternHaptic\(patternType: String\?\)/, 'Must implement triggerPatternHaptic');
  assert.match(content, /fun playNativeChime\(chimeType: String\?\)/, 'Must implement playNativeChime');
  assert.match(content, /R\.raw\.amy_gold_chime/, 'Must reference R.raw.amy_gold_chime');
  assert.match(content, /GOLD_SIGNAL_CHANNEL_ID|amy_gold_signal_channel/, 'Must register gold signal channel');
  assert.match(content, /longArrayOf\(0, 80, 50, 80, 50, 120\)/, 'Must define TARGET rhythmic haptic pattern');
});

test('3. AmyFxApplication.kt and DriverSetupSyncWorker.kt configure GOLD_SIGNAL_CHANNEL_ID with chime sound', () => {
  const appPath = path.join(ROOT, 'app/src/main/java/com/amyelitesuite/AmyFxApplication.kt');
  const workerPath = path.join(ROOT, 'app/src/main/java/com/amyelitesuite/DriverSetupSyncWorker.kt');
  const appContent = fs.readFileSync(appPath, 'utf8');
  const workerContent = fs.readFileSync(workerPath, 'utf8');

  assert.match(appContent, /GOLD_SIGNAL_CHANNEL_ID\s*=\s*"amy_gold_signal_channel"/, 'App must define channel ID');
  assert.match(appContent, /R\.raw\.amy_gold_chime/, 'App must set chime audio resource');
  assert.match(workerContent, /AmyFxApplication\.GOLD_SIGNAL_CHANNEL_ID/, 'Worker must route Grade A+ to gold channel');
  assert.match(workerContent, /isAPlus/, 'Worker must detect A+ setups');
});

test('4. price-alert-manager.js and context-panel.js forward to playNativeChime and triggerPatternHaptic', () => {
  const alertMgrPath = path.join(ROOT, 'app/src/main/assets/apps/mapping/js/ict-workspace/price-alert-manager.js');
  const contextPanelPath = path.join(ROOT, 'app/src/main/assets/apps/mapping/js/ict-workspace/context-panel.js');
  const alertContent = fs.readFileSync(alertMgrPath, 'utf8');
  const contextContent = fs.readFileSync(contextPanelPath, 'utf8');

  assert.match(alertContent, /playNativeChime/, 'Alert manager must call playNativeChime');
  assert.match(alertContent, /triggerPatternHaptic/, 'Alert manager must call triggerPatternHaptic');
  assert.match(contextContent, /playNativeChime\('GOLD_A_PLUS'\)/, 'Context panel must trigger gold chime on Grade A+');
  assert.match(contextContent, /triggerPatternHaptic\('TARGET'\)/, 'Context panel must trigger target haptic on Grade A+');
});
