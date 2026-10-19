import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('1. Modul 01 and Modul 02 HTML pages have 1-Tap Masterclass PDF open button', () => {
  const mod01Html = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/modul-01/index.html'), 'utf8');
  const mod02Html = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/modul-02/index.html'), 'utf8');

  assert.match(mod01Html, /class="[^"]*open-masterclass-pdf-btn[^"]*"/, 'Modul 01 must contain open-masterclass-pdf-btn');
  assert.match(mod01Html, /data-pdf-filename="Amy FX Academy - Modul 01 \[Fondasi Pasar\]\.pdf"/, 'Modul 01 must specify PDF filename');
  assert.match(mod01Html, /Buka Versi Ebook Masterclass A4 \(PDF\)/, 'Modul 01 must have readable button label');

  assert.match(mod02Html, /class="[^"]*open-masterclass-pdf-btn[^"]*"/, 'Modul 02 must contain open-masterclass-pdf-btn');
  assert.match(mod02Html, /data-pdf-filename="Amy FX Academy - Modul 02 \[Membaca Chart & Candlestick\]\.pdf"/, 'Modul 02 must specify PDF filename');
});

test('2. Academy main.js delegates click to window.Android.openPdfDocument', () => {
  const mainJs = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/assets/js/main.js'), 'utf8');
  assert.match(mainJs, /open-masterclass-pdf-btn/, 'main.js must listen for open-masterclass-pdf-btn');
  assert.match(mainJs, /window\.Android\.openPdfDocument/, 'main.js must call openPdfDocument bridge');
});

test('3. MainActivity.kt contains openPdfDocument with DIRECTORY_DOWNLOADS resolution', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/amyelitesuite/MainActivity.kt'), 'utf8');
  assert.match(content, /fun openPdfDocument\(filePath: String\?\)/, 'Must declare openPdfDocument');
  assert.match(content, /Environment\.DIRECTORY_DOWNLOADS/, 'Must resolve filename from Downloads');
  assert.match(content, /FileProvider\.getUriForFile/, 'Must use FileProvider for Scoped Storage compatibility');
  assert.match(content, /application\/pdf/, 'Must set application/pdf MIME type');
});
