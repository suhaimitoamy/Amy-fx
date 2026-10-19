import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Android Scanner I/O: MainActivity.startBackgroundScanner and stopBackgroundScanner eliminate disk I/O and service launches (Item 1.22)', () => {
  const mainActivity = fs.readFileSync('app/src/main/java/com/amyelitesuite/MainActivity.kt', 'utf8');

  // Find startBackgroundScanner method body
  const startMatch = mainActivity.match(/fun startBackgroundScanner\([^)]*\)\s*\{([\s\S]*?)\n\s*\}\n\s*@JavascriptInterface/);
  assert.ok(startMatch, 'startBackgroundScanner method must exist');
  const startBody = startMatch[1];

  // Must NOT write to SharedPreferences
  assert.doesNotMatch(startBody, /getSharedPreferences/, 'startBackgroundScanner must not access SharedPreferences');
  assert.doesNotMatch(startBody, /prefs\.edit\(\)/, 'startBackgroundScanner must not call prefs.edit()');
  assert.doesNotMatch(startBody, /startService/, 'startBackgroundScanner must not launch retired ScannerService');

  // Find stopBackgroundScanner method body
  const stopMatch = mainActivity.match(/fun stopBackgroundScanner\([^)]*\)\s*\{([\s\S]*?)\n\s*\}\n\s*@JavascriptInterface/);
  assert.ok(stopMatch, 'stopBackgroundScanner method must exist');
  const stopBody = stopMatch[1];

  // Must NOT write to SharedPreferences or launch service
  assert.doesNotMatch(stopBody, /getSharedPreferences/, 'stopBackgroundScanner must not access SharedPreferences');
  assert.doesNotMatch(stopBody, /startService/, 'stopBackgroundScanner must not launch retired ScannerService');
});
