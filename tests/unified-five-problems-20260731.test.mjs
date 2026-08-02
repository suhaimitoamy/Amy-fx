import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
const url=path=>new URL(`../${path}`,import.meta.url); const read=path=>readFile(url(path),'utf8');
async function exists(path){try{await access(url(path));return true}catch(_){return false}}

test('Twelve Data REST remains one central M1 synchronizer',async()=>{
 const source=await read('supabase/functions/market-candles/index.ts'),gateway=await read('api/twelvedata-internal.js');
 assert.match(source,/PROVIDER_REFRESH_MS = 180_000/); assert.match(source,/interval: "1min"/); assert.match(source,/request\.method === "POST"/);
 assert.match(source,/return await serveRead\(symbol, interval, outputsize\)/); assert.doesNotMatch(source,/syncRequestedInterval/); assert.match(source,/provider_data_stale/);
 assert.match(gateway,/twelvedata-internal-direct/); assert.match(gateway,/private, no-store/); assert.doesNotMatch(gateway,/market-candle-store|SUPABASE_STALE_FALLBACK/);
});

test('Scalper Engine reads Supabase only and exposes Pattern v3',async()=>{
 const engine=await read('supabase/functions/scalper-engine/index.ts'),endpoint=await read('supabase/functions/scalper-setups/index.ts'),patterns=await read('supabase/functions/scalper-engine/pattern-gates.mjs');
 assert.match(engine,/candle_source: "supabase-central-read-only"/); assert.match(engine,/provider_requests: 0/); assert.doesNotMatch(engine,/refreshMarketData|functions\/v1\/market-candles/);
 assert.match(endpoint,/CURRENT_ENGINE_VERSION = "amyfx-preview-scalper-pattern-v3\.0"/); assert.match(endpoint,/SCALPER_ENGINE_EXECUTION_AUTHORITY/); assert.doesNotMatch(endpoint,/IFVG Legacy/);
 assert.match(patterns,/BT6-2025-V1/); assert.match(patterns,/BT6\.1-2026-H1-V1/); assert.match(patterns,/AMD-2025-V1/);
});

test('legacy setups retire and unified crons remain recorded',async()=>{
 const migration=await read('supabase/migrations/20260731090000_amyfx_unified_market_scalper.sql');
 assert.match(migration,/amyfx-market-central-sync/); assert.match(migration,/'\*\/3 \* \* \* \*'/); assert.match(migration,/amyfx-scalper-engine-unified/);
 assert.match(migration,/status = 'CANCELLED'/); assert.match(migration,/recommendation_status = 'CLOSED'/); assert.match(migration,/'retired', true/);
});

test('Mapping execution follows Scalper while native WebSocket stays independent',async()=>{
 const adapter=await read('app/src/main/assets/apps/mapping/js/scalper-execution-authority.js'),decision=await read('app/src/main/assets/apps/mapping/js/scalper-execution-decision-bridge.js'),market=await read('app/src/main/assets/apps/mapping/js/api/market-data.js');
 assert.match(adapter,/SCALPER_ENGINE_EXECUTION_AUTHORITY/); assert.match(adapter,/result\.setupExecution = authority\.setupExecution/); assert.match(adapter,/mappingContextBeforeScalper/);
 assert.match(decision,/result\.directionDecision = decision/); assert.doesNotMatch(`${adapter}\n${decision}`,/TwelveDataPriceBridge|lastWsTickAt|connect\(/i);
 assert.match(market,/amyfx:twelvedata-price/); assert.doesNotMatch(market,/function pollLivePrice/);
});

test('Academy restores the last-read position',async()=>{
 const history=await read('app/src/main/assets/apps/academy/assets/js/reading-history-v2.js'),auth=await read('app/src/main/assets/apps/academy/assets/js/auth.js');
 assert.match(auth,/reading-history-v2\.js/); assert.match(history,/amy_academy_last_read_v2/); assert.match(history,/amy_academy_reading_positions_v2/); assert.match(history,/Lanjutkan dari posisi terakhir/);
});

test('unified production build is Amy FX 2.2.0 and has no Preview artifact channel',async()=>{
 const gradle=await read('app/build.gradle.kts'),version=await read('app/src/main/assets/app-version.js'),workflow=await read('.github/workflows/build-apk.yml'),update=JSON.parse(await read('update.json'));
 assert.match(gradle,/"com\.amyelitesuite"/); assert.match(gradle,/versionCode = .*\?: 56/); assert.match(gradle,/versionName = .*"2\.2\.0"/); assert.match(gradle,/TWELVE_DATA_API_KEY/);
 assert.match(version,/name: '2\.2\.0', code: 56/); assert.match(workflow,/AMYFX_VERSION_NAME: "2\.2\.0"/); assert.match(workflow,/AMYFX_VERSION_CODE: "56"/);
 assert.ok(Number(update.latest_version_code)<=56); assert.equal(await exists('preview-update.json'),false); assert.equal(await exists('AmyFX-Preview-latest.apk'),false);
});
