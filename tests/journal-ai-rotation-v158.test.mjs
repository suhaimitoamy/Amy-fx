import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
const source = relative => readFileSync(path(relative), 'utf8');

test('journal runtime files remain syntactically valid and load in order', () => {
  const loader = source('app/src/main/assets/apps/journal/amy-journal-final-fix.js');
  for (const relative of [
    'app/src/main/assets/apps/journal/amy-journal-final-fix.js',
    'app/src/main/assets/apps/journal/amy-journal-final-fix-legacy.js',
    'app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js'
  ]) {
    execFileSync(process.execPath, ['--check', fileURLToPath(path(relative))], { stdio: 'pipe' });
  }
  assert.match(loader, /amy-journal-final-fix-legacy\.js\?v=20260725-v159/);
  assert.match(loader, /amy-journal-ai-runtime-fix\.js\?v=20260725-v159/);
});

test('journal history bridge persists the IndexedDB state used by the core app', () => {
  const runtime = source('app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js');
  assert.match(runtime, /JOURNAL_KEY = "tradingLibraryManager\.journals\.v1"/);
  assert.match(runtime, /Array\.isArray\(state\.journals\)/);
  assert.match(runtime, /state\.journals = typeof normalizeJournals/);
  assert.match(runtime, /saveJournals\(state\.journals\)/);
  assert.match(runtime, /queueMicrotask\(render\)/);
});

test('journal calendar displays green wins and red losses with signed amounts', () => {
  const runtime = source('app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js');
  assert.match(runtime, /net > 0 \? `\+\$\{formatTradeAmount\(net\)\}`/);
  assert.match(runtime, /net < 0 \? formatTradeAmount\(net\)/);
  assert.match(runtime, /"is-win"/);
  assert.match(runtime, /"is-loss"/);
  assert.match(runtime, /data-journal-date=/);
});

test('assistant rotates free Gemini and OpenRouter keys with bounded retries', () => {
  const runtime = source('app/src/main/assets/apps/journal/amy-journal-ai-runtime-fix.js');
  assert.match(runtime, /new Set\(\["gemini", "openrouter"\]\)/);
  assert.match(runtime, /amyAiKeyPoolInput/);
  assert.match(runtime, /amyAiPaidFallbackInput/);
  assert.match(runtime, /DeepSeek sebagai fallback berbayar terakhir/);
  assert.match(runtime, /timeout = 18000/);
  assert.match(runtime, /Date\.now\(\) - started > 65000/);
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

test('Amy FX Pro source identity remains internally consistent with the promoted Preview lineage', () => {
  const gradle = source('app/build.gradle.kts');
  const appVersion = source('app/src/main/assets/app-version.js');
  const identity = appVersion.match(/name: '(2\.0\.0-pro\.(\d+))', code: (95\d{4})/);
  assert.ok(identity, 'Pro app-version identity is missing');
  const [, versionName, sequence, versionCode] = identity;

  assert.match(gradle, /com\.amyelitesuite\.learningpreview/);
  assert.match(gradle, /Amy FX Pro/);
  assert.match(gradle, /amyfxpreview/);
  assert.equal(Number(versionCode), 950000 + Number(sequence));
  assert.ok(gradle.includes(`?: ${versionCode})`));
  assert.ok(gradle.includes(`?: "${versionName}"`));
  assert.match(appVersion, /Amy-fx-pro\/main\/update\.json/);
});
