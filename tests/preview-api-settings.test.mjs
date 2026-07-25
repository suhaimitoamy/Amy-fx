import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const loaderUrl = new URL('app/src/main/assets/apps/journal/amy-journal-final-fix.js', root);
const accessUrl = new URL('app/src/main/assets/apps/journal/amy-preview-api-access.js', root);
const loader = readFileSync(loaderUrl, 'utf8');
const access = readFileSync(accessUrl, 'utf8');

test('preview API access scripts remain syntactically valid and load after AI runtime', () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(loaderUrl)], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', fileURLToPath(accessUrl)], { stdio: 'pipe' });
  assert.ok(loader.indexOf('amy-preview-api-access.js') > loader.indexOf('amy-journal-ai-runtime-fix.js'));
});

test('preview keeps API settings visible and easy to open', () => {
  assert.match(access, /#assistantApiSettings/);
  assert.match(access, /amyOpenApiSettingsBtn/);
  assert.match(access, /Pengaturan API/);
  assert.match(access, /workspace\.insertBefore\(settings, workspace\.firstElementChild\)/);
  assert.match(access, /if \(!hasStoredApi\(\)\) settings\.open = true/);
  assert.match(access, /#amyAiKeyPoolInput, #geminiApiKeyInput/);
  assert.match(access, /Gemini dan OpenRouter/);
});
