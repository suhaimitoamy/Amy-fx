import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const source = path => fs.readFileSync(path, 'utf8');
const index = source('app/src/main/assets/apps/journal/index.html');
const app = source('app/src/main/assets/apps/journal/app.js');
const core = source('app/src/main/assets/apps/journal/app-core.js');
const finalFix = source('app/src/main/assets/apps/journal/amy-journal-final-fix.js');
const runtimeFix = source('app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js');
const history = source('app/src/main/assets/apps/journal/amy-journal-history-bridge.js');
const styles = source('app/src/main/assets/apps/journal/styles.css');

test('journal runtime files remain syntactically valid and load in order', () => {
  for (const path of [
    'app/src/main/assets/apps/journal/app.js',
    'app/src/main/assets/apps/journal/app-core.js',
    'app/src/main/assets/apps/journal/amy-journal-final-fix.js',
    'app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js',
    'app/src/main/assets/apps/journal/amy-journal-history-bridge.js'
  ]) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
  assert.ok(index.indexOf('app.js') < index.indexOf('amy-journal-history-bridge.js'));
  assert.ok(index.indexOf('amy-journal-history-bridge.js') < index.indexOf('amy-journal-final-fix.js'));
  assert.ok(index.indexOf('amy-journal-final-fix.js') < index.indexOf('amy-journal-ai-runtime-fix.js'));
});

test('journal history bridge persists the IndexedDB state used by the core app', () => {
  assert.match(app, /app-core\.js/);
  assert.match(history, /indexedDB/);
  assert.match(history, /AmyFXJournal/);
  assert.match(history, /journalEntries/);
  assert.match(core, /db\.journal/);
});

test('journal calendar displays green wins and red losses with signed amounts', () => {
  assert.match(finalFix, /journal-calendar-day--win/);
  assert.match(finalFix, /journal-calendar-day--loss/);
  assert.match(finalFix, /formatSignedAmount/);
  assert.match(styles, /journal-calendar-day--win/);
  assert.match(styles, /journal-calendar-day--loss/);
});

test('assistant rotates free Gemini and OpenRouter keys with bounded retries', () => {
  const runtime = runtimeFix;
  assert.match(runtime, /gemini/i);
  assert.match(runtime, /openrouter/i);
  assert.match(runtime, /cooldowns\.set/);
  assert.match(runtime, /loadingId/);
  assert.doesNotMatch(runtime, /pendingId/);
  assert.match(runtime, /state\.isAiProcessing = false/);
});

test('journal runtime cannot create the global MutationObserver feedback loop that freezes navigation', () => {
  const runtime = source('app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js');
  assert.doesNotMatch(runtime, /new MutationObserver\(ensurePoolUi\)/);
  assert.match(runtime, /if \(target\.textContent !== next\) target\.textContent = next/);
  assert.match(runtime, /poolUiScheduled/);
  assert.match(runtime, /bindPoolUiNavigation/);
});

test('Amy FX public source identity is 2.3.0 code 58', () => {
  const gradle = source('app/build.gradle.kts');
  assert.match(gradle, /com\.amyelitesuite/);
  assert.match(gradle, /Amy FX/);
  assert.match(gradle, /amyfx/);
  assert.match(gradle, /\?: 58\)/);
  assert.match(gradle, /\?: "2\.3\.0"/);
  assert.doesNotMatch(gradle, /learningpreview|Amy FX Preview|amyfxpreview|preview-update\.json/);
  assert.match(source('app/src/main/assets/app-version.js'), /name: '2\.3\.0', code: 58/);
});
