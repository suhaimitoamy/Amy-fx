import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const gradle = read("app/build.gradle.kts");
const manifest = read("app/src/main/AndroidManifest.xml");
const activity = read("app/src/main/java/com/amyelitesuite/MainActivity.kt");
const service = read("app/src/main/java/com/amyelitesuite/BackgroundVideoPlaybackService.kt");
const journal = read("app/src/main/assets/apps/journal/background-video.js");
const index = read("app/src/main/assets/apps/journal/index.html");

test("Android Media3 service is declared as media playback foreground service", () => {
  assert.match(gradle, /media3-exoplayer:1\.4\.1/);
  assert.match(gradle, /media3-session:1\.4\.1/);
  assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
  assert.match(manifest, /BackgroundVideoPlaybackService/);
  assert.match(manifest, /foregroundServiceType="mediaPlayback"/);
  assert.match(manifest, /androidx\.media3\.session\.MediaSessionService/);
});

test("native player handles loop, audio focus, noisy audio and persistent state", () => {
  assert.match(service, /class BackgroundVideoPlaybackService : MediaSessionService/);
  assert.match(service, /setAudioAttributes\(audioAttributes, true\)/);
  assert.match(service, /setHandleAudioBecomingNoisy\(true\)/);
  assert.match(service, /setWakeMode\(C\.WAKE_MODE_LOCAL\)/);
  assert.match(service, /Player\.REPEAT_MODE_ONE/);
  assert.match(service, /MediaSession\.Builder/);
  assert.match(service, /ACTION_PAUSE/);
  assert.match(service, /ACTION_SEEK/);
  assert.match(service, /ACTION_STOP/);
});

test("IndexedDB video transfer is chunked, ordered and size validated", () => {
  assert.match(journal, /const CHUNK_SIZE = 512 \* 1024/);
  assert.match(journal, /blob\.slice\(/);
  assert.match(journal, /readAsDataURL\(slice\)/);
  assert.doesNotMatch(journal, /readAsDataURL\(blob\)/);
  assert.match(activity, /chunkIndex != session\.nextChunkIndex/);
  assert.match(activity, /session\.expectedSize == session\.writtenBytes/);
  assert.match(activity, /session\.file\.length\(\) == session\.writtenBytes/);
  assert.match(activity, /abortBackgroundVideoTransferInternal/);
});

test("web player autoplays, loops, hands off on lifecycle and prevents dual playback", () => {
  assert.match(index, /background-video\.js/);
  assert.match(journal, /video\.autoplay = true/);
  assert.match(journal, /video\.loop = true/);
  assert.match(journal, /pauseOtherVideos\(video\)/);
  assert.match(journal, /visibilitychange/);
  assert.match(journal, /handoffFromNativeLifecycle/);
  assert.match(journal, /restoreHtmlPlayback/);
  assert.match(activity, /mediaPlaybackRequiresUserGesture = false/);
  assert.match(activity, /AmyBackgroundVideo\?\.handoffFromNativeLifecycle/);
  assert.match(activity, /AmyBackgroundVideo\?\.resumeFromNativeLifecycle/);
});
