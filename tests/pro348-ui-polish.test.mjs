import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const polishName = 'amyfx-ui-polish-pro348.css';
const polish = read(`app/src/main/assets/apps/shared/${polishName}`);

const pages = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html',
  'app/src/main/assets/apps/journal/index.html',
  'app/src/main/assets/apps/academy/index.html',
];

test('all principal pages load the Pro348 polish after shared components', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, new RegExp(polishName.replace('.', '\\.') + '" data-amyfx-ui-polish="pro348"'));
    assert.ok(
      html.indexOf('amyfx-components.css') < html.indexOf(polishName),
      `${page} must load the polish after shared components`,
    );
  }
});

test('Mapping is connected to the shared design hook without replacing its ICT hook', () => {
  const html = read('app/src/main/assets/apps/mapping/index.html');
  assert.match(html, /<body class="amyfx-module amyfx-module--mapping amyfx-module--ict">/);
});

test('polish provides light-theme and small-screen readability safeguards', () => {
  assert.match(polish, /html\[data-amyfx-theme="light"\]/);
  assert.match(polish, /@media \(max-width: 560px\)/);
  assert.match(polish, /--amy-text-secondary/);
  assert.match(polish, /\.metrics \{ grid-template-columns: 1fr; \}/);
  assert.match(polish, /\.card-grid,[\s\S]*\.library-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(polish, /\.cards \{ grid-template-columns: 1fr; \}/);
});

test('release identity is synchronized at Pro413', () => {
  assert.match(read('app/build.gradle.kts'), /versionCode = .*950413/);
  assert.match(read('app/build.gradle.kts'), /2\.0\.0-pro\.413/);
  assert.match(read('app/src/main/assets/app-version.js'), /code: 950413/);
  assert.match(read('app/src/main/assets/update-checker.js'), /CURRENT_VERSION_CODE = Number\(VERSION\.code\) \|\| 950413/);
});
