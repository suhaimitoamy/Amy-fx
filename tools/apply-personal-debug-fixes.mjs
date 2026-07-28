import { readFile, writeFile } from 'node:fs/promises';

const PREVIEW_VERSION = '2.0.0-preview.173';
const PREVIEW_CODE = 940173;
const PREVIEW_MANIFEST = 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/personal/amyfx-private/preview-update.json';

async function read(path) {
  return readFile(path, 'utf8');
}

async function write(path, content) {
  await writeFile(path, content, 'utf8');
  console.log(`patched ${path}`);
}

function replaceLiteral(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one literal match, found ${count}`);
  return source.replace(before, after);
}

function replaceRegex(source, pattern, replacement, label) {
  if (typeof replacement === 'string' && source.includes(replacement)) return source;
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected one regex match, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

async function patch(path, transform) {
  const before = await read(path);
  const after = await transform(before);
  if (after !== before) await write(path, after);
  else console.log(`unchanged ${path}`);
}

await patch('app/build.gradle.kts', source => {
  source = source.replace('?: "com.amyelitesuite"', '?: "com.amyelitesuite.learningpreview"');
  source = source.replace('?: "Amy FX"', '?: "Amy FX Preview"');
  source = source.replace('?: "amyfx"', '?: "amyfxpreview"');
  source = source.replace('https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json', PREVIEW_MANIFEST);
  source = source.replace('?: 50)', `?: ${PREVIEW_CODE})`);
  source = source.replace('?: "1.5.9"', `?: "${PREVIEW_VERSION}"`);
  source = source.replace('// Official Amy FX releases use the permanent signing certificate.', '// Amy FX Preview personal releases use the permanent Preview signing certificate.');
  return source;
});

await patch('app/src/main/assets/app-version.js', source => {
  source = source.replace('// Amy FX production release identity.', '// Amy FX Preview personal release identity.');
  source = source.replace(/const VERSION = Object\.freeze\(\{ name: '[^']+', code: \d+ \}\);/, `const VERSION = Object.freeze({ name: '${PREVIEW_VERSION}', code: ${PREVIEW_CODE} });`);
  if (!source.includes('window.AmyFXUpdateManifestUrl')) {
    source = replaceLiteral(
      source,
      '  window.AmyFXAppVersion = VERSION;',
      `  window.AmyFXAppVersion = VERSION;\n  window.AmyFXUpdateManifestUrl = '${PREVIEW_MANIFEST}';`,
      'app-version manifest assignment'
    );
  } else {
    source = source.replace(/^\s*window\.AmyFXUpdateManifestUrl\s*=.*;$/m, `  window.AmyFXUpdateManifestUrl = '${PREVIEW_MANIFEST}';`);
  }
  source = source.replaceAll('Amy FX v${VERSION.name}', 'Amy FX Preview v${VERSION.name}');
  return source;
});

await patch('tools/configure-preview-web-version.mjs', source =>
  source.replaceAll(
    'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json',
    PREVIEW_MANIFEST
  )
);

await patch('app/src/main/assets/update-checker.js', source => {
  source = source.replace(/const VERSION = window\.AmyFXAppVersion \|\| \{ name: '[^']+', code: \d+ \};/, `const VERSION = window.AmyFXAppVersion || { name: '${PREVIEW_VERSION}', code: ${PREVIEW_CODE} };`);
  source = source.replace(/const CURRENT_VERSION_CODE = Number\(VERSION\.code\) \|\| \d+;/, `const CURRENT_VERSION_CODE = Number(VERSION.code) || ${PREVIEW_CODE};`);
  source = source.replace(/const CURRENT_VERSION_NAME = String\(VERSION\.name \|\| '[^']+'\);/, `const CURRENT_VERSION_NAME = String(VERSION.name || '${PREVIEW_VERSION}');`);
  source = source.replace(/const UPDATE_URL = (?:window\.AmyFXUpdateManifestUrl\s*\n\s*\|\|\s*)?'[^']+';/, `const UPDATE_URL = window.AmyFXUpdateManifestUrl\n    || '${PREVIEW_MANIFEST}';`);
  source = source.replaceAll('Update Amy FX Tersedia', 'Update Amy FX Preview Tersedia');
  source = source.replaceAll('Versi Amy FX ini', 'Versi Amy FX Preview ini');
  source = source.replaceAll('Menyiapkan unduhan Amy FX ${latestName}', 'Menyiapkan unduhan Amy FX Preview ${latestName}');
  source = source.replaceAll('Amy FX v${CURRENT_VERSION_NAME}', 'Amy FX Preview v${CURRENT_VERSION_NAME}');
  return source;
});

await patch('tests/five-issues-regression.test.mjs', source => {
  source = source.replace("const updatePath = 'update.json';", "const updatePath = 'preview-update.json';");
  source = replaceRegex(
    source,
    /test\('README retains the production identity and official APK route',[\s\S]*?\n\}\);/,
    `test('README retains the private Preview identity and APK route', () => {\n  assert.match(readme, /personal\\/amyfx-private/);\n  assert.match(readme, /Amy FX Preview/);\n  assert.match(readme, /com\\.amyelitesuite\\.learningpreview/);\n  assert.match(readme, /AmyFX-Preview-latest\\.apk/);\n});`,
    'README Preview identity regression'
  );
  source = replaceRegex(
    source,
    /test\('source version is 1\.5\.9 while publication stays safe during release',[\s\S]*?\n\}\);/,
    `test('source version and updater stay on the private Preview channel', () => {\n  assert.match(appVersion, /name: '2\\.0\\.0-preview\\.173', code: 940173/);\n  assert.match(appVersion, /personal\\/amyfx-private\\/preview-update\\.json/);\n  assert.ok(update.latest_version_code >= 940000);\n  assert.match(update.latest_version_name, /^2\\.0\\.0-preview\\.\\d+$/);\n  assert.match(update.apk_url || update.downloadUrl || '', /AmyFX-Preview-latest\\.apk/);\n});`,
    'Preview source version regression'
  );
  return source;
});

await patch('app/src/main/assets/apps/mapping/js/api/market-data.js', source => {
  source = source.replace('    let staleFetchFailed = false;', '    const refreshFailures = new Set();');
  source = replaceLiteral(
    source,
    "        try { await fetchTf(currentTf); } catch (_) {\n          log(`Candle ${currentTf} belum diperbarui, memakai cache.`);\n          if (isStale || !state.candles[currentTf]?.length) staleFetchFailed = true;\n        }",
    "        try { await fetchTf(currentTf); } catch (error) {\n          log(`Candle ${currentTf} belum diperbarui, memakai cache.`);\n          if (isStale || !state.candles[currentTf]?.length) refreshFailures.add(currentTf);\n        }",
    'Mapping refresh failure tracking'
  );
  source = source.replace(
    '    if (staleFetchFailed) {',
    "    const currentDataUnavailable = !state.candles[tf]?.length || (refreshFailures.has(tf) && isCandleStale(tf));\n    if (currentDataUnavailable) {"
  );
  const routerLine = '    result = applyRegimeRouter(result, htfBiases);';
  const degradedBlock = `${routerLine}\n    result.dataDegraded = refreshFailures.size > 0;\n    result.dataWarnings = [...refreshFailures].filter(item => item !== tf);\n    if (result.dataDegraded) {\n      result.dataStatus = 'PARTIAL';\n      result.dataStatusText = result.dataWarnings.length\n        ? \`Sebagian timeframe belum diperbarui: \${result.dataWarnings.join(', ')}. Analisis utama \${tf} tetap memakai data valid terakhir.\`\n        : 'Timeframe utama tersedia; pembaruan tambahan sedang dicoba ulang.';\n    }`;
  if (!source.includes('result.dataDegraded = refreshFailures.size > 0;')) {
    source = replaceLiteral(source, routerLine, degradedBlock, 'Mapping degraded data contract');
  }
  return source;
});

await patch('app/src/main/assets/apps/mapping/js/clock-sync.js', source => {
  source = source.replaceAll('Asia/Jakarta', 'Asia/Makassar');
  source = source.replaceAll('WIB', 'WITA').replaceAll('wib', 'wita');
  if (!source.includes('window.AmyWibClock = window.AmyWitaClock;')) {
    source = source.replace(
      'window.AmyWitaClock = {\n  now: witaClockText,\n  refresh: () => paint(Date.now(), true)\n};',
      'window.AmyWitaClock = {\n  now: witaClockText,\n  refresh: () => paint(Date.now(), true)\n};\nwindow.AmyWibClock = window.AmyWitaClock; // kompatibilitas kode lama'
    );
  }
  return source;
});

await patch('app/src/main/assets/apps/mapping/js/ui/ui-render.js', source => {
  source = source.replaceAll('id="kz-wib"', 'id="kz-wita"');
  source = source.replaceAll('id="top-wib"', 'id="top-wita"');
  source = source.replaceAll('${s.wib} WIB', '${s.wita} WITA');
  source = source.replaceAll('WIB ${nowTime()}', 'WITA ${nowTime()}');
  source = source.replaceAll(' • WIB ', ' • WITA ');
  return source;
});

await patch('app/src/main/assets/app.js', source => {
  if (!source.includes('function readJsonArray(key)')) {
    const marker = '  async function loadRepoIndicators() {';
    const helper = `  function readJsonSafe(key, fallback) {\n    try {\n      const raw = localStorage.getItem(key);\n      if (raw == null || raw === '') return fallback;\n      return JSON.parse(raw);\n    } catch (_) {\n      try { localStorage.removeItem(key); } catch (_) {}\n      return fallback;\n    }\n  }\n\n  function readJsonArray(key) {\n    const value = readJsonSafe(key, []);\n    return Array.isArray(value) ? value : [];\n  }\n\n  function deleteIndexedDatabase(name) {\n    return new Promise(resolve => {\n      if (!('indexedDB' in window)) return resolve(false);\n      let settled = false;\n      const finish = value => { if (!settled) { settled = true; resolve(value); } };\n      try {\n        const request = indexedDB.deleteDatabase(name);\n        request.onsuccess = () => finish(true);\n        request.onerror = () => finish(false);\n        request.onblocked = () => finish(false);\n        setTimeout(() => finish(false), 2500);\n      } catch (_) { finish(false); }\n    });\n  }\n\n  async function clearPersonalLocalData() {\n    const keys = [\n      'amy_mapping_logs', 'amy_mapping_analyses', 'amy_mapping_setups',\n      'amy_mapping_lifecycle_v4', 'amy_mapping_active_pointer_v4',\n      'amy_entry_watch_state_v3', 'amy_recent_projects', 'amy_saved_code',\n      'amy_journal_entries', 'amy_mapping_notified'\n    ];\n    keys.forEach(key => { try { localStorage.removeItem(key); } catch (_) {} });\n    return deleteIndexedDatabase('tradingLibraryManager.files');\n  }\n\n`;
    source = replaceLiteral(source, marker, helper + marker, 'Root safe storage helpers');
  }
  source = source.replace(/JSON\.parse\(localStorage\.getItem\('([^']+)'\) \|\| '\[\]'\)/g, "readJsonArray('$1')");
  source = source.replace('Bersihkan cache aplikasi', 'Bersihkan data lokal');
  source = source.replace('Tidak menghapus lisensi atau API key.', 'Menghapus riwayat, jurnal, dan koleksi lokal. API key tetap disimpan.');
  source = replaceLiteral(
    source,
    "      if (window.confirm('Hapus riwayat analisis, jurnal, dan koleksi lokal? API key tidak ikut dihapus.')) {\n        ['amy_mapping_logs', 'amy_mapping_analyses', 'amy_mapping_setups', 'amy_recent_projects', 'amy_saved_code', 'amy_journal_entries'].forEach(key => localStorage.removeItem(key));\n        showToast('Riwayat lokal sudah dibersihkan.');\n        renderProfile();\n      }",
    "      if (window.confirm('Hapus riwayat analisis, jurnal, library, dan koleksi lokal? API key tidak ikut dihapus.')) {\n        await clearPersonalLocalData();\n        showToast('Data lokal sudah dibersihkan. API key tetap tersimpan.');\n        renderProfile();\n      }",
    'Root clear data handler'
  );
  return source;
});

await patch('app/src/main/assets/apps/market-intel/app.js', source => {
  if (!source.includes('function clearHeatmapState()')) {
    const marker = '// ─── Init ────────────────────────────────────────────────';
    const helper = `function clearHeatmapState() {\n  const canvas = document.getElementById('heatmap-canvas');\n  if (canvas) canvas.replaceChildren();\n  const price = document.getElementById('heatmap-price');\n  if (price) price.textContent = '--';\n  hideLoading();\n}\n\nfunction payloadIsFresh(updated, maxAgeMs = 10 * 60 * 1000) {\n  if (!updated) return true;\n  const timestamp = new Date(updated).getTime();\n  return !Number.isFinite(timestamp) || Date.now() - timestamp <= maxAgeMs;\n}\n\n`;
    source = replaceLiteral(source, marker, helper + marker, 'Market Intel stale visual helpers');
  }
  source = replaceLiteral(
    source,
    "    if (!data.zones || data.zones.length === 0) {\n      status.textContent = '⚠️ Data belum cukup untuk heatmap';\n      return;\n    }",
    "    if (!data.zones || data.zones.length === 0) {\n      status.textContent = '⚠️ Data belum cukup untuk heatmap';\n      clearHeatmapState();\n      return;\n    }\n    if (!payloadIsFresh(data.updated)) throw new Error('Heatmap yang diterima sudah usang');",
    'Heatmap empty and stale handling'
  );
  source = source.replace(
    "    window.AmyFXIntel?.write('heatmap', { updated: data.updated, currentPrice: data.currentPrice, zones: data.zones });",
    "    window.AmyFXIntel?.write('heatmap', { updated: data.updated, capturedAt: data.updated, source: 'SUPABASE_EDGE', currentPrice: data.currentPrice, zones: data.zones });"
  );
  source = source.replace(
    "    if (e.name === 'AbortError') return;\n    status.textContent = '⚠️ Gagal memuat heatmap';",
    "    if (e.name === 'AbortError') return;\n    clearHeatmapState();\n    status.textContent = '⚠️ Gagal memuat heatmap';"
  );
  source = source.replace(
    "    window.AmyFXIntel?.write('liquidity', { updated: data.updated, currentPrice: data.currentPrice, levels: data.levels });",
    "    if (!payloadIsFresh(data.updated)) throw new Error('Liquidity yang diterima sudah usang');\n    window.AmyFXIntel?.write('liquidity', { updated: data.updated, capturedAt: data.updated, source: 'SUPABASE_EDGE', currentPrice: data.currentPrice, levels: data.levels });"
  );
  source = source.replace(
    "    window.AmyFXIntel?.write('news', { updated: data.updated, items: sortedNews.slice(0, 10) });",
    "    window.AmyFXIntel?.write('news', { updated: data.updated, capturedAt: data.updated, source: 'VERCEL_NEWS', items: sortedNews.slice(0, 10) });"
  );
  source = source.replace('  return str.replace(/[&<>"\']/g,', '  return String(str ?? \'\').replace(/[&<>"\']/g,');
  return source;
});

await patch('app/src/main/assets/apps/journal/app.js', source => {
  source = source.replace(
    'if (isAssistantSurface && pendingId) updateAssistantChatMessage(pendingId, safeText, extra);',
    'if (isAssistantSurface && loadingId) updateAssistantChatMessage(loadingId, safeText, extra);'
  );
  if (!source.includes('finally {\n    if (isAssistantSurface) state.isAiProcessing = false;\n  }')) {
    source = replaceLiteral(
      source,
      "  } catch (error) {\n    const message = `Asisten berhenti karena error: ${error.message || \"proses gagal\"}`;\n    if (!isAssistantSurface && dom.saveAiPopupMaterialBtn) dom.saveAiPopupMaterialBtn.disabled = true;\n    return finish(message);\n  }\n}",
      "  } catch (error) {\n    const message = `Asisten berhenti karena error: ${error.message || \"proses gagal\"}`;\n    if (!isAssistantSurface && dom.saveAiPopupMaterialBtn) dom.saveAiPopupMaterialBtn.disabled = true;\n    return finish(message);\n  } finally {\n    if (isAssistantSurface) state.isAiProcessing = false;\n  }\n}",
      'Journal assistant processing reset'
    );
  }
  return source;
});

await patch('app/src/main/assets/apps/academy/assets/js/auth.js', source => {
  if (!source.includes("const ACADEMY_ACCESS_MODE='PERSONAL_PREVIEW';")) {
    source = source.replace(
      "const ACADEMY_SESSION_KEY='amy_academy_session';",
      "const ACADEMY_SESSION_KEY='amy_academy_session';\nconst ACADEMY_ACCESS_MODE='PERSONAL_PREVIEW';"
    );
  }
  source = source.replace(
    "async function requireLogin(){sessionStorage.setItem(ACADEMY_SESSION_KEY,'true');document.documentElement.classList.add('is-authed');return true}",
    "async function requireLogin(){\n    sessionStorage.setItem(ACADEMY_SESSION_KEY,ACADEMY_ACCESS_MODE);\n    document.documentElement.classList.add('is-authed');\n    window.AmyAcademyAccess=Object.freeze({mode:ACADEMY_ACCESS_MODE,personal:true});\n    return true;\n}"
  );
  return source;
});

const testContent = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst read = path => fs.readFileSync(path, 'utf8');\n\ntest('personal source keeps immutable Preview identity', () => {\n  const gradle = read('app/build.gradle.kts');\n  const version = read('app/src/main/assets/app-version.js');\n  const updater = read('app/src/main/assets/update-checker.js');\n  assert.match(gradle, /com\\.amyelitesuite\\.learningpreview/);\n  assert.match(gradle, /Amy FX Preview/);\n  assert.match(gradle, /amyfxpreview/);\n  assert.match(version, /2\\.0\\.0-preview\\.173/);\n  assert.match(version, /personal\\/amyfx-private\\/preview-update\\.json/);\n  assert.match(updater, /personal\\/amyfx-private\\/preview-update\\.json/);\n});\n\ntest('Mapping only blocks when its active timeframe is unavailable', () => {\n  const source = read('app/src/main/assets/apps/mapping/js/api/market-data.js');\n  assert.doesNotMatch(source, /staleFetchFailed/);\n  assert.match(source, /currentDataUnavailable/);\n  assert.match(source, /dataDegraded/);\n  assert.match(source, /dataWarnings/);\n});\n\ntest('Mapping clock and labels use WITA', () => {\n  const clock = read('app/src/main/assets/apps/mapping/js/clock-sync.js');\n  const ui = read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');\n  assert.match(clock, /Asia\\/Makassar/);\n  assert.match(clock, /WITA/);\n  assert.doesNotMatch(clock, /Asia\\/Jakarta/);\n  assert.match(ui, /WITA/);\n});\n\ntest('home storage and clear-data flow are hardened', () => {\n  const source = read('app/src/main/assets/app.js');\n  assert.match(source, /function readJsonArray/);\n  assert.match(source, /deleteIndexedDatabase\\('tradingLibraryManager\\.files'\\)/);\n  assert.match(source, /await clearPersonalLocalData\\(\\)/);\n});\n\ntest('Market Intel clears stale heatmap visuals and labels backend freshness', () => {\n  const source = read('app/src/main/assets/apps/market-intel/app.js');\n  assert.match(source, /clearHeatmapState/);\n  assert.match(source, /payloadIsFresh/);\n  assert.match(source, /SUPABASE_EDGE/);\n  assert.match(source, /VERCEL_NEWS/);\n});\n\ntest('Journal assistant base runtime updates the correct loading message', () => {\n  const source = read('app/src/main/assets/apps/journal/app.js');\n  assert.doesNotMatch(source, /pendingId/);\n  assert.match(source, /updateAssistantChatMessage\\(loadingId/);\n  assert.match(source, /state\\.isAiProcessing = false/);\n});\n\ntest('Academy explicitly declares personal Preview access mode', () => {\n  const source = read('app/src/main/assets/apps/academy/assets/js/auth.js');\n  assert.match(source, /PERSONAL_PREVIEW/);\n  assert.match(source, /AmyAcademyAccess/);\n});\n`;
await write('tests/personal-source-debug.test.mjs', testContent);

console.log('Amy FX personal source debugging fixes applied.');
