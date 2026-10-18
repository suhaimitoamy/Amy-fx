import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainActivitySource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/MainActivity.kt', import.meta.url), 'utf8');
const filePathsXml = readFileSync(new URL('../app/src/main/res/xml/file_paths.xml', import.meta.url), 'utf8');

test('Item 1.7: MainActivity exposes openPdfDocument and openPdf @JavascriptInterface bridges', () => {
  assert.match(mainActivitySource, /fun\s+openPdfDocument\s*\(\s*filePath:\s*String\?\s*\)/);
  assert.match(mainActivitySource, /fun\s+openPdf\s*\(\s*filePath:\s*String\?\s*\)/);
  assert.match(mainActivitySource, /FileProvider\.getUriForFile/);
  assert.match(mainActivitySource, /Intent\.ACTION_VIEW/);
  assert.match(mainActivitySource, /"application\/pdf"/);
  assert.match(mainActivitySource, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(mainActivitySource, /FLAG_ACTIVITY_NEW_TASK/);
});

test('Item 1.7: file_paths.xml provides external-path and files-path mapping for FileProvider', () => {
  assert.match(filePathsXml, /<external-path\s+name="amyfx_external"\s+path="\."\s*\/>/);
  assert.match(filePathsXml, /<files-path\s+name="amyfx_files"\s+path="\."\s*\/>/);
  assert.match(filePathsXml, /<cache-path\s+name="amyfx_cache"\s+path="\."\s*\/>/);
});
