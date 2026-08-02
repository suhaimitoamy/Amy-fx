import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url); const path=r=>new URL(r,root); const source=r=>readFileSync(path(r),'utf8');
test('Amy FX 2.2.0 keeps the public Android identity and updater channel',()=>{
 const gradle=source('app/build.gradle.kts'),version=source('app/src/main/assets/app-version.js'),checker=source('app/src/main/assets/update-checker.js'),workflow=source('.github/workflows/build-apk.yml');
 assert.match(gradle,/com\.amyelitesuite/); assert.match(gradle,/\?: 56\)/); assert.match(gradle,/\?: "2\.2\.0"/); assert.match(gradle,/main\/update\.json/);
 assert.doesNotMatch(gradle,/learningpreview|Amy FX Preview|amyfxpreview|preview-update\.json/);
 assert.match(version,/name: '2\.2\.0', code: 56/); assert.match(version,/main\/update\.json/); assert.doesNotMatch(version,/Preview|personal\/amyfx-private/);
 assert.match(checker,/main\/update\.json/); assert.doesNotMatch(checker,/Amy FX Preview|personal\/amyfx-private|preview-update\.json/);
 assert.match(workflow,/AMYFX_VERSION_NAME: "2\.2\.0"/); assert.match(workflow,/AMYFX_VERSION_CODE: "56"/); assert.match(workflow,/latest_version_code=56/); assert.match(workflow,/Verify public update manifest/);
 assert.match(workflow,/TWELVEDATA_API_KEY: \$\{\{ secrets\.TWELVEDATA_API_KEY \}\}/);
 assert.equal(existsSync(path('preview-update.json')),false); assert.equal(existsSync(path('AmyFX-Preview-latest.apk')),false); assert.equal(existsSync(path('app/src/main/assets/apps/market-intel/private-market-api-router.js')),false);
});
test('Mapping presents a clean public interface without visible Preview badges',()=>{
 const html=source('app/src/main/assets/apps/mapping/index.html'),main=source('app/src/main/assets/apps/mapping/js/main.js'),branding=source('app/src/main/assets/apps/mapping/js/production-branding.js'),scalper=source('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
 execFileSync(process.execPath,['--check',fileURLToPath(path('app/src/main/assets/apps/mapping/js/production-branding.js'))],{stdio:'pipe'});
 assert.match(html,/<title>Amy FX · Market Intelligence<\/title>/); assert.doesNotMatch(html,/Amy FX Preview/); assert.match(html,/js\/production-branding\.js/); assert.ok(html.indexOf('js/production-branding.js')<html.indexOf('js/main.js')); assert.doesNotMatch(main,/mountPreviewUpdateBadge/); assert.match(branding,/card\?\.remove\(\)/);
 assert.doesNotMatch(scalper,/aktif dalam simulasi Preview/); assert.match(scalper,/aktif dalam simulasi Amy FX/);
});
test('public Mapping loads final Pattern v3 Scalper modules',()=>{
 const html=source('app/src/main/assets/apps/mapping/index.html'),panel=source('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js'),authority=source('app/src/main/assets/apps/mapping/js/scalper-execution-authority.js'),patterns=source('supabase/functions/scalper-engine/pattern-gates.mjs');
 assert.match(html,/js\/scalper-entry-watch-v1\.js/); assert.match(html,/js\/scalper-execution-authority\.js/);
 assert.match(panel,/10 driver BT6\/BT6\.1 \+ AMD/); assert.match(panel,/TP1 \+10/); assert.match(panel,/TP2 \+20/); assert.match(panel,/data-scalper-select-id/);
 assert.match(authority,/amyfx-preview-scalper-pattern-v3\.0/); assert.match(patterns,/BT6-2025-V1/); assert.match(patterns,/AMD-2025-V1/);
});
