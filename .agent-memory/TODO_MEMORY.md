# TODO Memory

## 2026-09-30 — Pro381 Market Intel Kompas Overhaul

- [x] Local implementation completed: Kompas Fundamental default hub, Berita as supporting evidence, Kalender as upcoming catalyst.
- [x] 11 baseline bugs verified and resolved.
- [x] Hardening test suite `tests/market-intel-kompas-hardening.test.mjs` created (12/12 passing).
- [x] Full regression test suite verified: 143/143 test files passed 100%.
- [ ] Version bump, git commit, push, and CI workflow monitoring (pending user review & approval).

## 2026-09-30 — Pro374 Mapping audit fixes

- [x] Pro374 (950374) released: 139 regression files passed locally and Actions run 36689049436 succeeded. APK identity/signer and public download gates passed; update.json activated and downloaded APK SHA-256 matches d20dc579d73fc10d54e2e2624650aeea19fce5b436ad36c18d49c8dff40ecec9.
- [x] Backend scalper-engine v21 deployed; health and fresh scalper-setups context expose policyVersion mapping-audit-pro374.
- [ ] Physical device: confirm update popup, offline WAIT/cleared overlays, six model cards and eligible A+ presentation. Real independent evaluation of the six research models remains unavailable; UI reports this explicitly.

## 2026-09-24 — Pro361 Release & Verification Checklist

- [x] **Pro361 Released**:
  1. Economic Calendar integration: Forex Factory feed parsed, auto-updating with offline cache in Market Intel.
  2. News Lock Gate: `scalper-engine` evaluates USD events, locks execution to `NOT READY` when within -15m to +30m of High-Impact USD release.
  3. Market Intel Redesign: Fully removed Heatmap & Liquidity panels (Option A), dedicated 100% to Berita & Kalender with filter pills, date groupings, countdown badges, and local time.
  4. CI build completed (Run `36015938496`), signed APK `2.0.0-pro.361` (`950361`) published, and `update.json` activated.
- [ ] **Physical Device Verification (Pro 361)**:
  1. Buka aplikasi di HP Android dan verifikasi pop-up update versi Pro 361 muncul otomatis.
  2. Buka tab **Market Intel (Berita & Kalender)**:
     - Verifikasi hanya ada 2 tab: `Berita` dan `Kalender`.
     - Cek tab `Kalender`: pastikan rilis berita minggu ini tampil lengkap dengan bendera negara, badge High/Med/Low, jam WIB/WITA, dan hitung mundur ("Rilis dlm Xm" / "Sedang Rilis").
     - Uji tombol filter: `[High Impact 🔴]`, `[Medium 🟠]`, dan `[USD Only 🇺🇸]`.
  3. Buka tab **Mapping (Konteks Gold)**:
     - Periksa status `Berita berdampak tinggi`: pastikan berstatus `SAFE` atau menampilkan hitung mundur berita USD terdekat jika ada event.

## 2026-09-24 — Pro360 & Pro359 Verification & Next Steps

- [x] **Pro359**: Lower timeframe confirmation transitioned from M1 to M5 with 900s freshness window, fixing the empty dashboard issue. Backwards-compatible `.m5` & `.m1` exposed. Released via CI.
- [x] **Pro360**: Gold market context notification copy overhauled to "Trading Buddy" style (3 distinct event types). Edge Function deployed to Supabase. Released via CI and activated in `update.json`.
- [ ] **Physical Device Verification**:
  1. Confirm pop-up update to Pro 360 appears upon opening app.
  2. Confirm Mapping tab loads populated Gold market context with M5 confirmation card.
  3. Confirm background push notification arrival when price approaches M15 POI (*Gold Mendekati Zona*) or completes M5 sweep (*Konfirmasi M5 Muncul*).

## 2026-09-24 — Pro signer durable backup

- [ ] Provision `AMYFX_PRO_KEYSTORE_BASE64` from the exact existing `amyfxpro` keystore whose SHA-256 certificate is `97:E0:B1:B6:F6:A1:B3:98:59:00:69:7F:97:63:51:B6:09:BD:BC:ED:19:07:FE:EC:90:49:EC:8F:D7:B5:02:32`. Until then, the verified main-branch Actions cache remains a fallback and release fails closed if that cache is unavailable.
- [ ] After Pro357 merges, confirm the release log reports the pinned signer and that the installed Pro350 accepts the APK as an in-place update.

## 2026-09-20 — Pro351

After the signed release activates, verify on the reporting Android device: an older terminal Replay record gains TP/SL evidence after its matching pack reaches the candle, deletion survives restart, Trading Practice has no Academy “Terakhir Dibaca” card, and Mapping Analyze remains readable in portrait. Native update notification receipt still requires device observation.

## 2026-09-20 — Pro350 Replay history

Verify Pro350 on the reporting Android device: save entry, open inline Riwayat, advance to SL/TP, switch timeframe, restart the app and inspect retained history. Native update notification receipt and device storage behavior require device observation. Release verification completed: source commit 9f43bdaea406f07c7673759dab1f3a08ff15cab1; signed workflow 35483550772 and lint workflow 35483550693 succeeded. All 136 JavaScript regression files pass. APK identity/signer and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.350 / 950350; release asset digest matches manifest SHA-256 26408fa3682197cc995c863d11e2ba35cbcd827b4576fea7e4b63e2cb391a513. Real Android rendering and receipt of native update notification remain unobserved.

## 2026-09-20 — Pro349

Verify on the reporting Android device that a replay decision survives app/page restart and that advancing into TP, SL, and same-candle SL+TP cases updates Riwayat with the expected timestamp and low/high evidence. CI can validate persistence contracts and rendering source but cannot prove device storage behavior or native update-notification receipt.

## 2026-09-19 — Pro348

Verify the five principal pages on the reporting Android device in portrait mode, especially sticky Mapping/News headers, custom-color contrast, long news text, and Journal/Academy one-column cards. Static regression tests cannot establish final Android WebView rendering or native update-notification receipt.

## 2026-09-19 — Pro347

Verify news branding removal, app-focused notification deep links, custom colors, reset, and light-theme contrast on the reporting Android device after the signed Pro347 release activates. Source tests cannot establish final WebView color rendering or native notification receipt.

## 2026-09-17 — Pro345 preparation
Pro345: verify home dark→light→dark on reporting device and direct chart delete in portrait/fullscreen. Home fix remains visually unverified; static CSS assertions cannot establish cascade/computed contrast. Branch push authorized; release/main merge not performed. Existing dirty preview-regression-failure.txt excluded.

## Drawing fixes — branch publication authorized
Amy authorized pushing Long/Short validation/labels and Object-menu close, without version bump. Publish on fix/replay-gesture-menu only; do not merge main or replace released Pro344 APK. This supersedes earlier no-push notes for these two fixes. Android visual verification remains pending.


## Long/Short drawing local fix
Local unpushed Long/Short fix: signed risk/reward validation; invalid creation and drag rejected; legacy invalid drawings retained with neutral fill and INVALID label; labels spaced.29 focused tests and all131 JS files pass. Still three-point entry/TP/SL interaction, not TradingView parity; device visual validation pending. No bump/commit/push authorized for this batch.


## 2026-09-17 — Pro344 replay fix
Pro344 awaits separate push/release permission, signed Android build and on-device timeframe/menu/fullscreen verification. Local branch fix/replay-gesture-menu in /root/Amy-fx-pro-home-chart. update.json remains published Pro343.


## 2026-09-17 — Pro343 home chart

Pro343: confirm CI signed release/manifest after push and visually smoke-test Android home chart, pinch, scroll, tab return, offline and theme. Browser access to local preview was blocked by private-address policy; no visual validation claim.


## Pending Tasks

- [ ] Verify Market Intel auto-translation on real Android device after Pro339 release activation.

- [ ] Confirm Pro333 Candle Replay fullscreen chart height and object-menu containment on the reporting Android device after the signed release is activated.

- [ ] Complete real-device WebView visual/gesture smoke tests after the signed `.326` release; CI owns Android unit, lint, build, identity, signer, and endpoint verification.

- [ ] Add automatic next/previous monthly-pack handoff in Candle Replay if seamless multi-month playback is later required; current design intentionally keeps one explicit local pack active at a time to bound memory.
- [ ] Add SMT guided-chart exercises only after a synchronized, provenance-preserving DXY dataset is available beside XAUUSD.
- [ ] Smoke-test the native live chart on a real Android device with a configured Twelve Data key; CI already validates source, Android unit/lint/build, APK identity, signer, release asset, and endpoint.

- [ ] Validate the real Causal V3 lifecycle against a naturally occurring setup when one eventually passes every unchanged gate; do not manufacture a setup or tune thresholds for this task.
- [ ] Manually validate Mapping Accuracy V3 on current/forward closed candles for M1, M5, M15, M30, H1, H4, D1, and W1 using `docs/MAPPING_ACCURACY_V3_MANUAL_VALIDATION.md`.
- [ ] Record repeatable reference mismatches with timeframe, candle open time, expected event, actual event, and screenshot before changing any Mapping V3 threshold.
- [ ] Add real passcode gate for Academy admin (`auth.js` is still a stub).
- [ ] Replace hardcoded `API_BASE` with relative `/api` path if safe (needs WebView testing).
- [ ] Add TwelveData error handling — check `data.status === "error"` in `api/heatmap.js`, `api/liquidity.js`, `api/twelvedata.js`.
- [ ] Add clearer news scraping failure message if Telegram extraction returns empty (diagnostic info).
- [ ] Add defensive WebView fallback for Telegram regex changes (only if primary regex starts failing).

## Notes

- Academy Trading Practice now supports local repaired-audited ZIP packs recursively, including nested annual/group archives, without bundling the historical library into the APK.
- Replay keeps one explicit pack active at a time and filters source candles at the real timestamp cursor before timeframe aggregation.
- Live Chart can preload closed candle context from native CandleStore and then continue with AmyLivePrice/Twelve Data WebSocket without Twelve Data REST/polling; it intentionally starts from WebSocket ticks if CandleStore is empty.
- Guided Practice is pinned to the packaged March 2009 sample so fixed exercise answers cannot drift when a user selects another historical pack.
- XAU/USD 2021–2022 M5/M15 replay still produces zero locked setups after causal-order and paired-leg fixes. The next cumulative blocker is the unchanged SESSION gate.
- Rolling 300 and 800 produce identical gate decisions, paired-anchor times/prices, and setup counts; only negligible EMA seed drift remains.
- Mapping V3 manual profiles (M1, M30, H4, D1, W1) have no win-probability claim and must not be tuned from isolated live outcomes.
- H1 bearish suppression is intentional reference parity, not a pending defect.
- Auth fix needs user decision: what passcode to use.
- API_BASE fix needs WebView testing — `file://` protocol doesn't support relative API paths.
- TwelveData error handling is the safest fix to implement first.


## 2026-09-05 — Pro328

Pro328 release: signed build and automatic update.json activation completed (run 33976208755). Remaining: verify drawing gestures and per-device controls on a real Android device. Local browser could not access the preview, so real-device visual validation remains pending.


## 2026-09-06 — Pro329

Pro329 pending: reconnect GitHub, apply the prepared changes to current main without overwriting any later work, publish commit with [release329-no-tests] marker, build/publish329. No tests/backtests/verification requested. Backend news-sync v11 already deployed. New news-feed translation-at-read design was rejected by automatic approval review and abandoned; existing news-feed is unchanged. Safer repair translates only freshly fetched public Telegram content and was accepted. No approval blocker remains on deployed news-sync.


## 2026-09-09 — Pro332

Pro332: signed APK build and automatic manifest activation pending at source commit. Real-device Android fullscreen/rotation/drawing and light/dark visual smoke checks remain necessary; no local browser executable was available.


Pro332 release completed: GitHub Actions run 34301702033 succeeded, including JavaScript regression, Android unit/lint/build, signing identity and published endpoint verification. Active public update.json is 2.0.0-pro.332 / 950332, enabled=true. Published APK SHA-256 62bd08b231bef85e768af95b50540ecfe3e0d6b3e71a77dbc670da18f4e297f1 matches the release asset digest. Earlier build/activation pending status is resolved. Actual device notification and WebView visual checks remain unobserved.


## 2026-09-09 — Pro334 server-owned live price

Pro334 source 2.0.0-pro.334 / 950334: push triggers existing signed APK workflow; keep update.json on published333 until CI activation. Confirm Vercel deployment has TWELVEDATA_API_KEY with XAU/USD WebSocket entitlement and observe stream on device; no credential value is copied into source.



## 2026-09-09 — Pro335 replay navigation

After Pro335 release, verify one/two-finger gestures, drawing-edge resizing, free pan over rectangles, portrait/landscape fullscreen and update notification on the reporting Android device. Browser access to local preview was blocked in this session. Full TradingView feature parity (including its proprietary indicators/layouts and complete drawing settings) remains outside this implemented release.


## 2026-09-09 — Pro336

Confirm on the reporting Android device that downward swipes in replay (normal/fullscreen, chart/object, after background/resume) never show native refresh; navigating home must restore normal pull-to-refresh. Pro335's native refresh issue is addressed by Pro336 source, with signed release verification pending.

## 2026-09-12 — Pro337

- Verify new Mapping UI/chart/gestures on Android, including M5/M15 switch, timeout,
  background/resume, dark/light theme and receipt of the native update notification.
- Validate model on held-out broker-quality data including spread, commission, slippage
  and scheduled news; forward paper-test before drawing profitability conclusions.
- Pro337 signed release/manifest verification pending at source preparation.


## 2026-09-13 — Pro338 Academy

Verify Pro338 chart labels, gestures, narrow-screen layout, lesson return and native update notification on the reporting Android device. Cloud browser local preview was blocked (ERR_BLOCKED_BY_CLIENT); visual verification unobserved. Signed release and manifest activation pending at source preparation. The old note pinning Guided Practice to March2009 is superseded by Pro338 illustrative scenarios; Replay/Chart Analysis still use their existing sources.


## 2026-09-13 — Pro340 local application assistant

Verify Pro340 on real Android: open each main module then ask from another module; confirm IndexedDB journal reads, news refresh, reading/quiz progress, keyboard/scroll/close and update notification. Local browser preview blocked by ERR_BLOCKED_BY_CLIENT. Signed build and manifest activation pending at source preparation; do not claim device notification observed. Future broader language understanding requires additional rules/search or a separately approved model.


Pro340 release completed: source commit efa8c80406d57cc8c40b08ed6755d9ce3dac589e; signed workflow 34750969449 and lint workflow 34750969447 succeeded. All 127 JavaScript regression files and 14 dedicated assistant cases pass. Android unit tests, lint, APK identity/signer and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.340 / 950340. APK asset digest matches manifest SHA-256 3af71bbe25893f15411d380cc77938b5fd33f0f477f0a32a4df536d173f3f0b8. Earlier signed-release/manifest pending notes for Pro340 are resolved. Actual Android layout and receipt of native update notification remain unobserved; browser preview was blocked.


## 2026-09-13 — Pro341

- Verify cold-start menu, glass readability in both themes, BSL/SSL alignment with the selected Mapping timeframe, heatmap filters, background/resume and native update receipt on Android.
- Confirm the signed Pro341 workflow and active manifest after publishing source; local full JS regression passed.


Pro341 release verified: PR #3 merged as 89f147daa947632da15a21da5bd5b7ee5e8a297f. Signed release workflow34788293012 and main lint34788292968 succeeded. All128 JS files, Android tests/lint/build, existing signer continuity and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.341 /950341; APK digest matches manifest SHA-256 8f59f72ecb22ed384c5c390ea20e9a1927cd3e17ad9910b9ee6b4fde80d7943c. Earlier Pro341 publication-pending notes are resolved. Browser/device appearance and native notification receipt remain unobserved. Internal validation was aligned from Node20 to the repository-required Node22 after its old runtime failed to import stripTypeScriptTypes. Legacy Learning Preview and1.5.8 PR checks lacked their old signing cache; Pro release used its existing signer and passed verification.


## 2026-09-14 — Pro342 Mapping restoration

Pro342: confirm signed release/manifest activation and native update receipt. Verify Android Mapping selection, filters, timeframe and resume. Investigate existing Supabase Scalper504 failures; restored UI cannot supply new signals while engine remains failed. No database or backend function changes made.


## 2026-09-19 — Pro346
Observe new STRUCTURAL-2026-09-V1 results separately from old history; run held-out replay with broker costs before performance claims. Verify native update receipt on device after signed Pro346 release activation. Archived IFVG_LEGACY and FVG_BUY_HIGH_QUALITY remain retired.

## 2026-09-24 — Pro357 activation pending approval

- Deploy the already prepared `scalper-system-push`, `scalper-setups`, then `scalper-engine` Edge Functions only after approval for production replacement and FCM side effects; retain existing `verify_jwt=false` cron compatibility and service-role check on push.
- Verify a fresh `amyfx-gold-context-v1` result in `amyfx_preview_scalper_runs`, confirm no new setup row and no legacy setup notification, and check Pro357+ token delivery only after app registration.
- Merge the reviewed PR to main to trigger the signed APK workflow; verify package/version/signer, release asset digest and `update.json` at `2.0.0-pro.357` / `950357`, then observe Android notification/UI on a device.


## 2026-09-30 — Pro375 release verification

- Source 2.0.0-pro.375 / 950375 prepared; deploy updated scalper-engine and verify the cron snapshot, then signed Actions/release/update.json activation.
- Observe native update receipt and actual WebView gestures on the user's Android device. Compare against the user's TradingView broker/symbol/timezone; browser fixtures and causal tests do not establish identical broker data or profitability.

Pro375 backend deployed as scalper-engine v22. Health and the scheduled COMPLETED/fresh scalper-setups snapshot expose amy-ict-complete-pro375 and context.amy. Real read-only feed validation supplies exact NY MO, locked Asia H/L and D/W/M pivots. Signed release/manifest verification remains pending at source publication.

Pro375 signed release verified: Actions36695782397 success, active manifest950375, SHA-25629cdc5ee0619fcd7500d0173f52bd703cc4eae77e40cde90086c2a69b567badf. Pro376/950376 is the follow-up for explicit counter-bias score narration and latest closed M5 execution geometry, with29 dedicated cases. Keep published375 identity until signed376 activation.


Pro376 final verification completed: signed Actions36696811345 and lint36696811141 succeeded. Active public update.json is enabled at2.0.0-pro.376/950376. Downloaded32,666,230-byte APK SHA-256 matches f1b861ca698ccd608b8fb88510e57adecc1acdc233a672459d5062ffd1580712, packaged app-version is376 and packaged amy-ict.js is byte-identical to the backend module. Final local140-file regression (30 dedicated AMY cases) and Chromium mobile dark/light/all-controls/offline checks pass, including a real server snapshot. scalper-engine v24 runs on scheduled cron, fresh COMPLETED snapshots expose amy-ict-complete-pro376; primary targets reject opposing/reached/wrong-side DOL. The last fix changes only backend serialization/tests/docs, not APK assets; [skip ci] prevents rebuilding/replacing the already verified APK at the same code. Real-device notification receipt and broker-matched TradingView comparison remain unobserved. Earlier Pro375/376 deployment/build-pending entries are resolved.


## 2026-09-30 — Pro377 Mapping ringkas

User authorized a presentation-only simplification and version bump. Main Mapping shows market state, manual readiness/news, primary POI/CE/invalidation/target and chart. Full bias, narration, evidence, liquidity, conditions, alternatives and six reference models stay accessible in closed Detail accordions; opened driver/scenario details survive refresh. All46 display controls remain in four groups, stored preferences are preserved. Chart narration prioritizes risk warnings in two lines; repeated structural labels and overlapping text are suppressed without removing drawings or numerical logic. Canonical engine, backend, scoring, risk gates and notification policies are unchanged. Source2.0.0-pro.377/950377; signed CI owns manifest activation after publication. Local141 regression files and Chromium360/390 dark/light/menu/offline smoke passed; release verification pending.


Pro377 release verification completed: source dc1ff82e9f6bd0571bac754484654141212ebafc; signed Actions36701710390 and lint36701710388 succeeded. Public update.json is enabled at2.0.0-pro.377/950377. Downloaded32,667,949-byte APK SHA-2561998d6efe381114b230d393db90f0a675dc2b7b6263f10f12775941796e7ed76 matches manifest/checksum; all changed Mapping assets match APK and shared trading engine remains byte-identical to backend. Final141 regression files and Chromium360/390 dark/light/settings/driver-refresh/news-lock/offline smoke passed. Earlier Pro377 publication-pending note is resolved. Real Android update-notification receipt remains unobserved.


## 2026-09-30 — Pro378 Chart Gold fullscreen

Source2.0.0-pro.378/950378 prepared. Verify signed Actions/release/APK checksum and manifest activation; preserve published377 identity until CI completes. Observe actual Android rotation/Back/pinch and native update receipt on the reporting device.


Pro378 release verification completed: source7d9b2d608e4fe6dbb6addb7063dd039401282beb, signed Actions36704449764 and lint36704449726 succeeded. Public update.json enabled at2.0.0-pro.378/950378. Downloaded32,670,025-byte APK SHA-256516d95d6fd9bcfec15985dc6b8cc354e51480265d8ab0689936dce1947ce91bf matches manifest/checksum; all fullscreen assets match source and canonical trading engine remains byte-identical to backend. Final141 regression files and Chromium portrait/landscape360/390/844px, pinch/pan/zoom/scroll/Back/Escape/fallback/theme/refresh/offline checks passed. Earlier Pro378 release-pending note resolved. Actual Android device behavior and update notification receipt remain unobserved.


## 2026-09-30 — Pro379 TradingView axis gestures

Source2.0.0-pro.379/950379 prepared. Verify signed Actions/release/APK/checksum and manifest activation; keep published378 identity until CI completes. Observe price/time axis gestures, manual vertical pan and update receipt on the actual Android device.


Pro379 release verification completed: source6b6d447ead4e60b1f12957e42f0c20f543241af7, signed Actions36707758513 and lint36707758575 succeeded. Public update.json enabled at2.0.0-pro.379/950379. Downloaded32,670,665-byte APK SHA-256ff37cbe0180131239ae56fa46bb9b1b07c28a62f323e79d295922b91d80136ae matches public manifest/checksum; eight affected/fullscreen assets match source and canonical trading engine remains byte-identical to backend. All142 regression files and Chromium touch price/time-axis scaling, double-tap/Auto harga reset, overlay alignment, refresh-preserved viewport and existing fullscreen/pinch/pan/Back/Escape/theme/offline checks passed. Earlier Pro379 release-pending notes resolved. Actual Android device gestures and update notification receipt remain unobserved.
 
 
## 2026-09-30 — Pro380 Academy Curriculum Restructure
 
Source 2.0.0-pro.380/950380 prepared. Verify signed Actions/release/APK/checksum and manifest activation; keep published 379 identity until CI completes. Observe Academy semester views, drawer TOC, module navigation, and update notification receipt on the actual Android device.


## 2026-09-30 — Mapping driver expectation follow-up (local audit)

- [ ] Clarify desired active driver architecture with user after the read-only no-setup diagnosis. If six-driver setups are required, specify and wire real detectors and per-driver telemetry/lifecycle; currently cards are references. No implementation authorized by this inspection request. See /workspace/mapping-driver-audit/DIAGNOSIS.md.


## 2026-09-30 — Six-driver definitions follow-up (supersedes inspection-only scope above)

User now requests driver audit/correction before global gates. Local false Sniper attribution corrected. Review missing entry/fill/expiry/exit contracts and external backtest rules for all six; implement real detectors and replay net-R outcomes before wiring production. Ensemble quorum/ATR units, Shield sizing and Rapid -0.35R exit semantics remain undefined. Do not treat audit proposals as approved historical strategies. See docs/mapping/SIX_DRIVER_LOGIC_AUDIT.md.


## 2026-09-30 — Pro382 six-driver evaluation

Pro382 menggantikan status lima detector tidak ada pada catatan audit sebelumnya. Enam detector dan integrasi sudah diimplementasikan. Verifikasi build signed/APK/manifest serta deployment live diperlukan sebelum menyebut rilis selesai. Validasi profitabilitas/biaya broker dan observasi nyata perangkat Android tetap belum tersedia; tidak menjanjikan setup harian.

Validasi lokal Pro382: seluruh 146 file regresi lulus; 21 kasus driver/lifecycle + 2 kasus API baru, BUY/SELL keenam model. Browser mobile 360/390, enam kartu/toggle, filter OFF, refresh detail, mode gelap, offline dan tanpa overflow/pageerror. Replay 240 M5 produksi: satu kandidat Rapid; fixture kalender sintetis, bukan backtest profit. Migration constraint applied; scalper-engine25, scalper-setups11, scalper-preferences2 deployed. Build signed dan manifest masih menunggu publikasi.


Pro382 release verification completed: source 11239e1de1b42d6677cbd074619c636507d762ab; signed Actions36792997261 and lint36792997230 succeeded. Public update.json enabled at2.0.0-pro.382/950382. Downloaded31,534,089-byte APK SHA25634f42b0f0e34995e7df9ff0a425e3e68b74ec59acfa531f08f0ea007d4b32b3f matches manifest/checksum; all11 changed assets match source.146 regression files pass. Production engine25/setup-reader11/preferences2 active; five engine files byte-identical to source and successful live run returns all6 driver evaluations. Browser360/390 light/dark, toggles, detail refresh, selected chart, offline and overflow checks pass. Replay240 M5 with synthetic calendar produced one Rapid candidate; not a profitability backtest. Earlier build/deployment-pending notes are resolved. Actual Android update receipt remains unobserved.
