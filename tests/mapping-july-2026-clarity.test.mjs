// Release gate for Amy FX Preview Mapping clarity.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const clarity = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-clarity-v1.js', import.meta.url),
  'utf8'
);
const mappingV2 = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-v2.js', import.meta.url),
  'utf8'
);
const asiaRange = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/session/asia-range.js', import.meta.url),
  'utf8'
);
const asiaRangeUi = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/session/asia-range-ui.js', import.meta.url),
  'utf8'
);
const uiRender = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/ui/ui-render.js', import.meta.url),
  'utf8'
);

test('July 2026 clarity layer is loaded after Mapping runtime', () => {
  assert.match(mappingV2, /mapping-clarity-v1\.js/);
  assert.match(clarity, /AmyFXMappingClarity/);
});

test('Asia Range keeps its DST-aware session source and stays outside D Mapping recomputation', () => {
  assert.match(asiaRange, /SESSION_ZONE = 'America\/New_York'/);
  assert.match(asiaRange, /SESSION_START_HOUR = 18/);
  assert.match(asiaRange, /SESSION_END_HOUR = 2/);
  assert.match(asiaRange, /sourceSeason/);
  assert.match(asiaRangeUi, /syncClarityAsiaWindow/);
  assert.match(asiaRangeUi, /canonicalAsia\.window = label/);
  assert.match(asiaRangeUi, /Asia Session Context · \$\{label\}/);
  assert.doesNotMatch(clarity, /calculateAsiaRange|canonicalAsia|ASIA_ENTRY/);
});

test('Mapping explanation exposes D source candle and keeps execution read-only', () => {
  assert.match(clarity, /Sumber Analisis/);
  assert.match(clarity, /Candle sudah resmi tutup/);
  assert.match(clarity, /descriptive.dealingRange.location/);
  assert.match(clarity, /state.result.setupExecution/);
  assert.doesNotMatch(clarity, /confidence percentage live[^<]*\d+%/i);
});

test('all-timeframe Mapping separates context, fresh evidence, and D predictive output', () => {
  assert.match(clarity, /Context • Fresh Evidence • Predictive/);
  assert.match(clarity, /Final Bias/);
  assert.match(clarity, /Next Move/);
  assert.match(clarity, /Dealing Range/);
  assert.match(clarity, /Fresh Structure/);
  assert.match(clarity, /Qualified CHoCH/);
  assert.match(clarity, /Qualified Pattern/);
});

test('WAIT event remains distinct from continuous or stale descriptive state', () => {
  assert.match(clarity, /if \(!event\) return 'WAIT'/);
  assert.match(clarity, /Tidak ada event struktur baru; state yang tampil adalah continuous\/stale context/);
  assert.match(clarity, /Tidak ada event baru/);
});

test('Market Summary uses per-timeframe D replay without cross-timeframe scalping voting', () => {
  assert.match(clarity, /SUPPORTED_MAPPING_TIMEFRAMES\.map\(analyzeTimeframe\)/);
  assert.match(clarity, /source: 'AMY_SMC_D'/);
  assert.match(clarity, /amyfxSyntheticCurrent !== true/);
  assert.doesNotMatch(clarity, /SCALPER_AUTHORITY_TFS|SCALPER_WEIGHTS|weighted vote/i);
  assert.doesNotMatch(clarity, /setInterval\s*\(|state\.price/);
  assert.doesNotMatch(clarity, /14\.353 snapshot|42,86%|78,79%|win rate/i);
});

test('Valid Break displays the raw and D-qualified event contracts without synthetic BOS', () => {
  assert.match(clarity, /Raw Valid Break/);
  assert.match(clarity, /Qualified Valid Break/);
  assert.match(clarity, /Qualified CHoCH/);
  assert.match(clarity, /Qualified BOS/);
  assert.match(clarity, /tidak membuat qualified BOS synthetic/);
  assert.match(clarity, /Harga live tidak mengubah event ini/);
});

test('Setup Aktif remains an execution consumer and clarity code does not delete or rewrite it', () => {
  assert.match(uiRender, /data-stability-key="active-setup"/);
  assert.match(uiRender, /Setup Aktif/);
  assert.doesNotMatch(clarity, /data-stability-key="active-setup"/);
  assert.doesNotMatch(clarity, /state\.setups\s*=\s*\[\]/);
  assert.doesNotMatch(clarity, /delete.*setupExecution/i);
});
