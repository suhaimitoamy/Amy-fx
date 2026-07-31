import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

async function exists(path) {
  try { await access(url(path)); return true; }
  catch (_) { return false; }
}

test('Twelve Data REST is owned by one POST-only central M1 synchronizer', async () => {
  const source = await read('supabase/functions/market-candles/index.ts');
  assert.match(source, /const PROVIDER_REFRESH_MS = 180_000/);
  assert.match(source, /interval: "1min"/);
  assert.match(source, /request\.method === "POST"/);
  assert.match(source, /return await serveRead\(symbol, interval, outputsize\)/);
  assert.doesNotMatch(source, /syncRequestedInterval/);
  assert.doesNotMatch(source, /fetchProvider\(symbol, interval/);
  assert.match(source, /supabase-market-closed/);
});

test('Scalper Engine reads Supabase only and ignores legacy engine versions', async () => {
  const engine = await read('supabase/functions/scalper-engine/index.ts');
  const endpoint = await read('supabase/functions/scalper-setups/index.ts');
  assert.match(engine, /candle_source: "supabase-central-read-only"/);
  assert.match(engine, /provider_requests: 0/);
  assert.match(engine, /engine_version: `eq\.\$\{ENGINE_VERSION\}`/);
  assert.doesNotMatch(engine, /refreshMarketData/);
  assert.doesNotMatch(engine, /functions\/v1\/market-candles/);
  assert.match(endpoint, /CURRENT_ENGINE_VERSION = "amyfx-preview-scalper-multidriver-v2\.0"/);
  assert.match(endpoint, /authority: "SCALPER_ENGINE_EXECUTION_AUTHORITY"/);
  assert.doesNotMatch(endpoint, /IFVG Legacy/);
});

test('legacy nonterminal setups are retired and only one market/scalper cron is scheduled', async () => {
  const migration = await read('supabase/migrations/20260731090000_amyfx_unified_market_scalper.sql');
  assert.match(migration, /amyfx-market-central-sync/);
  assert.match(migration, /'\*\/3 \* \* \* \*'/);
  assert.match(migration, /amyfx-scalper-engine-unified/);
  assert.match(migration, /status = 'CANCELLED'/);
  assert.match(migration, /recommendation_status = 'CLOSED'/);
  assert.match(migration, /'retired', true/);
  assert.match(migration, /engine_version IS DISTINCT FROM 'amyfx-preview-scalper-multidriver-v2\.0'/);
});

test('Mapping practical execution follows Scalper Engine without touching WebSocket', async () => {
  const adapter = await read('app/src/main/assets/apps/mapping/js/scalper-execution-authority.js');
  const bridge = await read('app/src/main/assets/apps/mapping/js/scalper-execution-decision-bridge.js');
  const index = await read('app/src/main/assets/apps/mapping/index.html');
  assert.match(index, /js\/scalper-execution-authority\.js/);
  assert.match(index, /js\/scalper-execution-decision-bridge\.js/);
  assert.match(adapter, /SCALPER_ENGINE_EXECUTION_AUTHORITY/);
  assert.match(adapter, /result\.setupExecution = authority\.setupExecution/);
  assert.match(adapter, /result\.entryWatch =/);
  assert.match(adapter, /result\.entryMap =/);
  assert.match(adapter, /mappingContextBeforeScalper/);
  assert.match(bridge, /result\.directionDecision = decision/);
  assert.match(bridge, /result\.mappingDirectionDecision/);
  assert.doesNotMatch(`${adapter}\n${bridge}`, /WebSocket|TwelveDataPriceBridge|lastWsTickAt|connect\(/i);
});

test('Academy stores and restores the exact last-read lesson position', async () => {
  const history = await read('app/src/main/assets/apps/academy/assets/js/reading-history-v2.js');
  const auth = await read('app/src/main/assets/apps/academy/assets/js/auth.js');
  assert.match(auth, /reading-history-v2\.js/);
  assert.match(history, /amy_academy_last_read_v2/);
  assert.match(history, /amy_academy_reading_history_v2/);
  assert.match(history, /amy_academy_reading_positions_v2/);
  assert.match(history, /window\.scrollTo\(0, Math\.min\(y, maxY\)\)/);
  assert.match(history, /TERAKHIR DIBACA/);
  assert.match(history, /Lanjutkan dari posisi terakhir/);
});

test('unified build keeps Amy FX production identity and has no Preview artifact channel in main', async () => {
  const gradle = await read('app/build.gradle.kts');
  const version = await read('app/src/main/assets/app-version.js');
  const workflow = await read('.github/workflows/build-apk.yml');
  const update = JSON.parse(await read('update.json'));
  assert.match(gradle, /"com\.amyelitesuite"/);
  assert.match(gradle, /"Amy FX"/);
  assert.match(gradle, /"amyfx"/);
  assert.match(gradle, /versionCode = .*\?: 54/);
  assert.match(gradle, /versionName = .*"2\.1\.0"/);
  assert.match(gradle, /TWELVE_DATA_API_KEY/);
  assert.match(version, /name: '2\.1\.0', code: 54/);
  assert.match(workflow, /TWELVEDATA_API_KEY: \$\{\{ secrets\.TWELVEDATA_API_KEY \}\}/);
  assert.equal(update.latest_version_code, 54);
  assert.equal(update.latest_version_name, '2.1.0');
  assert.equal(await exists('preview-update.json'), false);
  assert.equal(await exists('AmyFX-Preview-latest.apk'), false);
});
