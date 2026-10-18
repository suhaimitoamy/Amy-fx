import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bridgeSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/apps/shared/amy-academy-video-bridge.js'),
  'utf8'
);

test('amy-academy-video-bridge.js mendefinisikan API universal dan storage key', () => {
  assert.match(bridgeSource, /STORAGE_KEY\s*=\s*'amy_academy_video_session'/);
  assert.match(bridgeSource, /root\.AmyAcademyVideoBridge\s*=\s*api/);
  assert.match(bridgeSource, /isBridgeAvailable/);
  assert.match(bridgeSource, /getActiveLessonMetadata/);
  assert.match(bridgeSource, /handoffToBackground/);
  assert.match(bridgeSource, /restorePlaybackOnResume/);
});

test('handoffToBackground memprioritaskan playBackgroundVideoWithTarget dan menyertakan targetUrl deep link', () => {
  assert.match(bridgeSource, /playBackgroundVideoWithTarget/);
  assert.match(bridgeSource, /meta\.targetUrl/);
  assert.match(bridgeSource, /video\.pause\(\)/);
});

test('restorePlaybackOnResume membaca positionMs dan menyelaraskan currentTime video', () => {
  assert.match(bridgeSource, /getBackgroundVideoStateJson/);
  assert.match(bridgeSource, /video\.currentTime\s*=\s*positionSec/);
  assert.match(bridgeSource, /pauseBackgroundVideo/);
});

test('background-video.js di jurnal trading juga mendukung targetUrl deep link', () => {
  const journalSource = fs.readFileSync(
    path.resolve(__dirname, '../app/src/main/assets/apps/journal/background-video.js'),
    'utf8'
  );
  assert.match(journalSource, /playBackgroundVideoWithTarget/);
  assert.match(journalSource, /targetUrl\s*=\s*item\.lessonUrl\s*\|\|\s*window\.location\.href/);
});
