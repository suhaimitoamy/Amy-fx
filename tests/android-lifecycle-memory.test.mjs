import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Android Lifecycle & Memory: MainActivity.onDestroy detaches ViewGroup, removes all JS interfaces, and destroys WebView (Item 1.43)', () => {
  const mainActivity = fs.readFileSync('app/src/main/java/com/amyelitesuite/MainActivity.kt', 'utf8');

  // Must clean up twelveDataPriceBridge
  assert.match(mainActivity, /twelveDataPriceBridge\.close\(\)/);

  // Must remove from parent ViewGroup
  assert.match(mainActivity, /\(webView\.parent as\? android\.view\.ViewGroup\)\?\.removeView\(webView\)/);

  // Must stop loading
  assert.match(mainActivity, /webView\.stopLoading\(\)/);

  // Must remove all 4 JavascriptInterfaces
  assert.match(mainActivity, /webView\.removeJavascriptInterface\("Android"\)/);
  assert.match(mainActivity, /webView\.removeJavascriptInterface\("AmyLivePrice"\)/);
  assert.match(mainActivity, /webView\.removeJavascriptInterface\("AmyNativeAIRepair"\)/);
  assert.match(mainActivity, /webView\.removeJavascriptInterface\("AmyNativeAI"\)/);

  // Must call webView.destroy()
  assert.match(mainActivity, /webView\.destroy\(\)/);
});

test('Android Lifecycle & Memory: BackgroundVideoPlaybackService removes stateTicker before stopSelf (Item 1.43)', () => {
  const service = fs.readFileSync('app/src/main/java/com/amyelitesuite/BackgroundVideoPlaybackService.kt', 'utf8');

  // Verify stopPlaybackAndService removes callbacks from mainHandler
  const stopMethodMatch = service.match(/fun stopPlaybackAndService\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(stopMethodMatch, 'stopPlaybackAndService method must exist');

  const stopMethodBody = stopMethodMatch[1];
  assert.match(stopMethodBody, /mainHandler\.removeCallbacks\(stateTicker\)/);
  assert.match(stopMethodBody, /stopSelf\(\)/);

  // Verify onDestroy also removes callbacks
  const onDestroyMatch = service.match(/override fun onDestroy\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(onDestroyMatch, 'onDestroy method must exist');
  assert.match(onDestroyMatch[1], /mainHandler\.removeCallbacks\(stateTicker\)/);
});
