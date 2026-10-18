import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(`${root}/${path}`, 'utf8');

function assertSyntax(path) {
  const result = spawnSync(process.execPath, ['--check', `${root}/${path}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('Both home integration and profile system settings pass syntax check', () => {
  assertSyntax('app/src/main/assets/apps/shared/amyfx-home-data-integration-v1.js');
  assertSyntax('app/src/main/assets/profile-system-settings-v1.js');
});

test('Item 1.47: amyfx-home-data-integration-v1.js enforces equality guard on stat textContent', () => {
  const content = read('app/src/main/assets/apps/shared/amyfx-home-data-integration-v1.js');

  // Must check inequality before writing to textContent to prevent microtask childList mutation churn
  assert.match(
    content,
    /if\s*\(\s*mappingTarget\s*&&\s*mappingTarget\.textContent\s*!==\s*String\(analyses\)\s*\)\s*mappingTarget\.textContent\s*=\s*String\(analyses\)/
  );
  assert.match(
    content,
    /if\s*\(\s*journalTarget\s*&&\s*journalTarget\.textContent\s*!==\s*String\(journals\)\s*\)\s*journalTarget\.textContent\s*=\s*String\(journals\)/
  );
});

test('Item 1.47: amyfx-home-data-integration-v1.js scopes MutationObserver and filters self-mutations', () => {
  const content = read('app/src/main/assets/apps/shared/amyfx-home-data-integration-v1.js');

  // Targets specific .stats-grid container first rather than blind document.body
  assert.match(content, /const statsGrid = document\.querySelector\("\.stats-grid"\)/);
  assert.match(content, /const target = statsGrid \|\| document\.getElementById\("main-content"\) \|\| document\.body/);

  // Filters out mutations originating from stat cards
  assert.match(content, /const isSelf = mutations\.every/);
  assert.match(content, /if \(!isSelf\) schedule\(\)/);
});

test('Item 1.47: profile-system-settings-v1.js guards section title text and auto-disconnects observer', () => {
  const content = read('app/src/main/assets/profile-system-settings-v1.js');

  // Equality guard on title text
  assert.match(content, /prevTitle\.textContent\s*!==\s*['"]Tampilan & Gaya Kaca['"]/);

  // Auto-disconnects observer once injected
  assert.match(content, /if \(document\.querySelector\('\[data-amyfx-color-settings\]'\)\) \{\s*observer\.disconnect\(\);/);
});
