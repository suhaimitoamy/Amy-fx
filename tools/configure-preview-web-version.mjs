import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function jsString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function replaceExactly(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches?.length || 0}`);
  }
  return source.replace(pattern, replacement);
}

export async function configurePreviewWebVersion({
  root = process.cwd(),
  versionName,
  versionCode,
  manifestUrl
}) {
  const code = Number(versionCode);
  if (!String(versionName || '').trim()) throw new Error('versionName is required');
  if (!Number.isInteger(code) || code <= 0) throw new Error('versionCode must be a positive integer');
  const manifest = new URL(String(manifestUrl || ''));
  if (manifest.protocol !== 'https:') throw new Error('manifestUrl must use HTTPS');

  const appVersionPath = resolve(root, 'app/src/main/assets/app-version.js');
  const updateCheckerPath = resolve(root, 'app/src/main/assets/update-checker.js');
  let appVersion = await readFile(appVersionPath, 'utf8');
  let updateChecker = await readFile(updateCheckerPath, 'utf8');

  appVersion = replaceExactly(
    appVersion,
    /const VERSION = Object\.freeze\(\{ name: '[^']+', code: \d+ \}\);/g,
    `const VERSION = Object.freeze({ name: ${jsString(versionName)}, code: ${code} });`,
    'app-version VERSION'
  );

  const manifestLine = `  window.AmyFXUpdateManifestUrl = ${jsString(manifest.toString())};`;
  if (/^\s*window\.AmyFXUpdateManifestUrl\s*=.*;\s*$/m.test(appVersion)) {
    appVersion = replaceExactly(appVersion, /^\s*window\.AmyFXUpdateManifestUrl\s*=.*;\s*$/gm, manifestLine, 'preview manifest assignment');
  } else {
    appVersion = replaceExactly(
      appVersion,
      /^\s*window\.AmyFXAppVersion = VERSION;\s*$/gm,
      `  window.AmyFXAppVersion = VERSION;\n${manifestLine}`,
      'AmyFXAppVersion assignment'
    );
  }

  updateChecker = replaceExactly(
    updateChecker,
    /const VERSION = window\.AmyFXAppVersion \|\| \{ name: '[^']+', code: \d+ \};/g,
    `const VERSION = window.AmyFXAppVersion || { name: ${jsString(versionName)}, code: ${code} };`,
    'update checker VERSION fallback'
  );
  updateChecker = replaceExactly(
    updateChecker,
    /const CURRENT_VERSION_CODE = Number\(VERSION\.code\) \|\| \d+;/g,
    `const CURRENT_VERSION_CODE = Number(VERSION.code) || ${code};`,
    'update checker versionCode fallback'
  );
  updateChecker = replaceExactly(
    updateChecker,
    /const CURRENT_VERSION_NAME = String\(VERSION\.name \|\| '[^']+'\);/g,
    `const CURRENT_VERSION_NAME = String(VERSION.name || ${jsString(versionName)});`,
    'update checker versionName fallback'
  );
  updateChecker = replaceExactly(
    updateChecker,
    /const UPDATE_URL = (?:window\.AmyFXUpdateManifestUrl\s*\n\s*\|\|\s*)?'[^']+';/g,
    `const UPDATE_URL = window.AmyFXUpdateManifestUrl\n    || 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json';`,
    'update manifest URL'
  );

  if (!updateChecker.includes('function announceNativeUpdate')) {
    updateChecker = replaceExactly(
      updateChecker,
      /\n  function showUpdatePopup\(data, latestCode, latestName\) \{/g,
      `\n  function announceNativeUpdate(latestCode, latestName) {\n    const key = 'amy_fx_update_notified_' + latestCode;\n    try {\n      if (localStorage.getItem(key) === '1') return;\n      localStorage.setItem(key, '1');\n    } catch (_) {}\n    const message = 'Amy FX Preview ' + latestName + ' siap dipasang.';\n    try {\n      if (window.Android && typeof window.Android.showNotification === 'function') {\n        window.Android.showNotification('Update Amy FX Preview Tersedia', message);\n      } else {\n        notify(message);\n      }\n    } catch (_) { notify(message); }\n  }\n\n  function showUpdatePopup(data, latestCode, latestName) {`,
      'showUpdatePopup insertion point'
    );
  }

  if (!/announceNativeUpdate\(latestCode, latestName\);\s*\n\s*showUpdatePopup/.test(updateChecker)) {
    updateChecker = replaceExactly(
      updateChecker,
      /if \(latestCode > CURRENT_VERSION_CODE\) \{\s*\n\s*showUpdatePopup\(data, latestCode, latestName\);/g,
      `if (latestCode > CURRENT_VERSION_CODE) {\n          announceNativeUpdate(latestCode, latestName);\n          showUpdatePopup(data, latestCode, latestName);`,
      'update available notification hook'
    );
  }

  await writeFile(appVersionPath, appVersion);
  await writeFile(updateCheckerPath, updateChecker);
  return { appVersionPath, updateCheckerPath, versionName: String(versionName), versionCode: code, manifestUrl: manifest.toString() };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const [versionName, versionCode, manifestUrl] = process.argv.slice(2);
  configurePreviewWebVersion({ versionName, versionCode, manifestUrl })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
