import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const settingsPath = 'app/src/main/assets/apps/journal/amy-preview-ai-settings-v2.js';
const loaderPath = 'app/src/main/assets/apps/journal/amy-journal-final-fix.js';
const bridgePath = 'app/src/main/java/com/amyelitesuite/NativeAiBridge.kt';

const settings = readFileSync(settingsPath, 'utf8');
const loader = readFileSync(loaderPath, 'utf8');
const bridge = readFileSync(bridgePath, 'utf8');

test('one-paste API settings JavaScript is syntactically valid', () => {
  assert.doesNotThrow(() => new vm.Script(settings, { filename: settingsPath }));
});

test('journal loader uses the clean v2 settings instead of the old overhaul panel', () => {
  assert.match(loader, /amy-preview-ai-settings-v2\.js/);
  assert.doesNotMatch(loader, /amy-preview-ai-overhaul\.js/);
});

test('current provider models and authentication contracts are locked', () => {
  assert.match(settings, /gemini-3\.6-flash/);
  assert.match(settings, /openrouter\/auto/);
  assert.match(settings, /deepseek-v4-flash/);
  assert.match(settings, /"x-goog-api-key": item\.key/);
  assert.doesNotMatch(settings, /generateContent\?key=/);
  assert.match(settings, /X-OpenRouter-Title/);
});

test('Gemini standard and authorization keys are both recognized', () => {
  assert.match(settings, /AQ\\\./);
  assert.match(settings, /AIza/);
  assert.match(settings, /sk-or-v1-/);
});

test('native Android bridge permits required provider headers', () => {
  assert.match(bridge, /"x-goog-api-key"/);
  assert.match(bridge, /"x-openrouter-title"/);
  assert.match(bridge, /generativelanguage\.googleapis\.com/);
  assert.match(bridge, /openrouter\.ai/);
  assert.match(bridge, /api\.deepseek\.com/);
});

test('no real-looking API credential is embedded in the changed source', () => {
  const changedSource = `${settings}\n${loader}\n${bridge}`;
  const secretPatterns = [
    /AIza[A-Za-z0-9_-]{30,}/g,
    /AQ\.[A-Za-z0-9_-]{25,}/g,
    /sk-or-v1-[A-Za-z0-9_-]{40,}/g,
    /sk-[a-f0-9]{32,}/gi
  ];
  for (const pattern of secretPatterns) {
    assert.equal(changedSource.match(pattern), null, `credential-like literal matched ${pattern}`);
  }
});
