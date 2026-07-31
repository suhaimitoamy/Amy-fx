import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Amy FX public source uses permanent production identity',()=>{
 const g=read('app/build.gradle.kts'),v=read('app/src/main/assets/app-version.js');
 assert.match(g,/configuredApplicationId = System\.getenv\("AMYFX_APPLICATION_ID"\) \?: "com\.amyelitesuite"/);
 assert.match(g,/configuredAppLabel = System\.getenv\("AMYFX_APP_LABEL"\) \?: "Amy FX"/);
 assert.match(g,/configuredUriScheme = System\.getenv\("AMYFX_URI_SCHEME"\) \?: "amyfx"/);
 assert.match(g,/versionCode[^\n]*55/); assert.match(g,/versionName[^\n]*"2\.1\.1"/);
 assert.match(v,/name: '2\.1\.1', code: 55/);
 assert.doesNotMatch(g,/learningpreview|Amy FX Preview|amyfxpreview|preview-update\.json/);
 assert.doesNotMatch(v,/Preview|personal\/amyfx-private/);
});

test('published metadata is never ahead of a supported production version',()=>{
 const m=JSON.parse(read('update.json'));
 const versions=new Map([[40,'1.4.17'],[41,'1.5.0'],[42,'1.5.1'],[43,'1.5.2'],[44,'1.5.3'],[45,'1.5.4'],[46,'1.5.5'],[47,'1.5.6'],[48,'1.5.7'],[49,'1.5.8'],[50,'1.5.9'],[51,'2.0.0'],[52,'2.0.1'],[53,'2.0.2'],[54,'2.1.0'],[55,'2.1.1']]);
 assert.equal(m.latest_version_name,versions.get(m.latest_version_code));
 assert.ok(m.latest_version_code<=55); assert.ok(m.release_notes.length>0);
});

test('native WebSocket credential stays native and REST remains candle-only',()=>{
 const g=read('app/build.gradle.kts'),native=read('app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt'),activity=read('app/src/main/java/com/amyelitesuite/MainActivity.kt'),main=read('app/src/main/assets/apps/mapping/js/main.js'),bridge=read('app/src/main/assets/apps/mapping/js/bridge/android-bridge.js'),market=read('app/src/main/assets/apps/mapping/js/api/market-data.js');
 assert.match(g,/TWELVE_DATA_API_KEY/); assert.match(native,/BuildConfig\.TWELVE_DATA_API_KEY/); assert.match(native,/wss:\/\/ws\.twelvedata\.com/);
 assert.match(activity,/addJavascriptInterface\(twelveDataPriceBridge, "AmyLivePrice"\)/);
 assert.doesNotMatch(main,/localStorage\.getItem\('twelve_api_key'\)/); assert.doesNotMatch(bridge,/localStorage\.setItem\('twelve_api_key'/);
 assert.doesNotMatch(market,/new WebSocket|function pollLivePrice|LIVE_POLL_MS/);
 assert.match(market,/amyfx:twelvedata-price/); assert.match(market,/PROXY_URL/);
});

test('release workflows pin version and permanent certificate',()=>{
 const fingerprint=/47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/;
 for(const p of ['.github/workflows/build-apk.yml','.github/workflows/build-release.yml','.github/workflows/stage5-apply.yml']){
  const w=read(p); assert.match(w,fingerprint); assert.match(w,/apksigner/); assert.match(w,/TWELVEDATA_API_KEY/);
 }
 const rolling=read('.github/workflows/build-apk.yml'); assert.match(rolling,/AMYFX_VERSION_NAME: "2\.1\.1"/); assert.match(rolling,/AMYFX_VERSION_CODE: "55"/); assert.match(rolling,/Verify public update manifest/);
 const manual=read('.github/workflows/build-release.yml'); assert.match(manual,/default: "2\.1\.1"/); assert.match(manual,/default: "55"/);
 const candidate=read('.github/workflows/stage5-apply.yml'); assert.match(candidate,/Validate Amy FX 2\.1\.1/);
});

test('public Firebase client remains public',()=>{const f=JSON.parse(read('app/google-services.json'));assert.equal(f.client[0].client_info.android_client_info.package_name,'com.amyelitesuite');assert.equal('private_key' in f,false)});
