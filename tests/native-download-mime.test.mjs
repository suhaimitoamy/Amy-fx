import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/MainActivity.kt', import.meta.url), 'utf8');

test('blob download listener extracts filename from anchor and detects MIME from blob type', () => {
  // Listener must NOT blindly hardcode Trading_Report_*.pdf
  assert.doesNotMatch(activity, /Trading_Report_\$\{System\.currentTimeMillis\(\)\}\.pdf/);

  // Must check anchor download attribute and blob type
  assert.match(activity, /anchor\.getAttribute\('download'\)/);
  assert.match(activity, /blob\.type\.indexOf\('csv'\)/);
  assert.match(activity, /blob\.type\.indexOf\('json'\)/);
  assert.match(activity, /blob\.type\.indexOf\('zip'\)/);
});

test('saveBlob applies dynamic MIME type based on file extension', () => {
  // Must NOT hardcode application/pdf in openDownloadOutputStream call inside saveBlob
  assert.doesNotMatch(activity, /openDownloadOutputStream\(filename,\s*"application\/pdf"\)/);

  // Must dynamically map extensions
  assert.match(activity, /filename\.endsWith\("\.csv",\s*ignoreCase\s*=\s*true\)\s*->\s*"text\/csv"/);
  assert.match(activity, /filename\.endsWith\("\.json",\s*ignoreCase\s*=\s*true\)\s*->\s*"application\/json"/);
  assert.match(activity, /filename\.endsWith\("\.pdf",\s*ignoreCase\s*=\s*true\)\s*->\s*"application\/pdf"/);
  assert.match(activity, /filename\.endsWith\("\.zip",\s*ignoreCase\s*=\s*true\)\s*->\s*"application\/zip"/);
});
