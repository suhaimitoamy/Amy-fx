import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Item 2.9 & 2.23: Resume Cursor Button HTML in candle-replay.html', () => {
  const html = fs.readFileSync('app/src/main/assets/apps/academy/trading-practice/candle-replay.html', 'utf8');
  assert.match(html, /id="btnResumeReplay"/, 'Must contain btnResumeReplay element');
  assert.match(html, /Lanjutkan dari Bar Terakhir/, 'Must have resume title or text');
});

test('Item 2.9 & 2.23: candle-replay.js persists per-pack bookmark and provides resume button logic', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/candle-replay.js', 'utf8');
  assert.match(code, /amy_replay_last_cursor_['"]\s*\+\s*payload\.sourceId/, 'Must persist amy_replay_last_cursor_{sourceId}');
  assert.match(code, /amy_practice_last_cursor_['"]\s*\+\s*payload\.sourceId/, 'Must persist amy_practice_last_cursor_{sourceId}');
  assert.match(code, /function updateResumeButton\(\)/, 'Must define updateResumeButton function');
  assert.match(code, /replay\.seek\(savedNum\)/, 'Resume button must invoke replay.seek to jump to bookmarked bar');
});
