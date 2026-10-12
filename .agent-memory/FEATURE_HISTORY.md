# Feature History

## 2026-09-30 — Pro381 Market Intel Kompas Fundamental Architecture

- **Kompas Fundamental Hub (Primary Priority & Default Tab):**
  - Repositioned Kompas Fundamental (`data-tab="sentiment"`, `panel-sentiment`) as the central hub of Market Intel.
  - Berita and Kalender remain operational as supporting evidence and catalyst schedules.
  - Answers all 8 core institutional questions: Gold bias, horizon, 3 ranked dominant factors with clear reasoning, supporting vs opposing evidence columns, structured scenarios (main, reinforcing, invalidation), catalyst countdown, and mapping technical bridge.
- **Supporting Evidence Drilldown:**
  - One-click evidence links (`openEvidenceNews(id)` and `openEvidenceCalendar()`) connect directly from Kompas claims to timestamped news cards and calendar items.
  - Reading position and expanded card states are preserved across news refreshes.
- **Truthful Multi-State Indicators:**
  - Synchronized state reports `🟢 Live Engine`, `🟡 Cache Lokal`, or `🟠 Cache Usang (>24 Jam)`. Missing data displays `🔴 Kalender Belum Terhubung`.
- **Hardened Client Translation & Security:**
  - Sentence chunking (≤450 chars) for MyMemory API with strict no-truncation caching policy.
  - Strict HTML escaping across all dynamic macro variables.

- **Update 1: Automated Economic Calendar & News Lock Safety Gate:**
  - Integrated Forex Factory / Fair Economy Media free JSON feed (`https://nfs.faireconomy.media/ff_calendar_thisweek.json`).
  - Added `evaluateEconomicCalendar(calendar, nowSeconds)` in `supabase/functions/scalper-engine/market-context.mjs`.
  - Replaced static `UNVERIFIED` news status with dynamic real-time states: `SAFE`, `UPCOMING`, `MEDIUM_ALERT`, and `NEWS_LOCK`.
  - Built-in News Lock gate: If a High-Impact USD news event is within -15m to +30m, `execution.status` is automatically locked to `NOT READY` to protect traders from wide spreads, slippage, and whipsaws.
  - Added warning indicators and badges (`.news-lock`, `.news-warning`, `.news-safe`) in the Gold Mapping Cockpit (`context-panel.js` and `ict-workspace.css`).
  - Edge function `scalper-engine` fetches calendar in parallel with candle loads without adding latency.

- **Update 2: Market Intel Redesign (Option A Execution):**
  - Fully removed redundant legacy Heatmap and Liquidity panels from Market Intel.
  - Focused Market Intel 100% on **Berita (News)** and **Kalender Ekonomi (Economic Calendar)**.
  - Added interactive filtering (`[Semua]`, `[High Impact 🔴]`, `[Medium 🟠]`, `[USD Only 🇺🇸]`).
  - Grouped releases by local day (`📅 Kamis, 24 Sep`) with local clock times (`Asia/Makassar` / WITA).
  - Dynamic countdown badges: `🔴 Sedang Rilis / Volatilitas Tinggi` (imminent pulse), `⏳ Rilis 35m lagi`, `✓ Selesai`.
  - Offline cache fallback (`amy_economic_calendar_v1`) in `localStorage` for zero-latency instant opening.

## 2026-09-24 — Pro360 Trading Buddy notification copy overhaul

- Push notification messages for Gold market context transformed from stiff server-log jargon into lively, trader-friendly copy (Gaya Trading Buddy).
- 3 Distinct Event Alert Categories:
  1. 🔔 *Gold Mendekati Zona [Beli/Jual]!* (Harga masuk radius 1x ATR area M15).
  2. ⚡ *Konfirmasi M5 Muncul! Siap Ditinjau* (Sweep + MSS terpenuhi di M5, mencantumkan level sweep dan invalidasi).
  3. ⚠️ *Hati-hati! M15 Mulai Melawan Arah H1* (Peringatan dini saat M15 berbalik arah melawan H1).
- Updated in `supabase/functions/scalper-engine/market-context.mjs` and Android `AmyFirebaseMessagingService.kt` fallback text.

## 2026-09-24 — Pro359 Gold market context M5 transition and resilient freshness

- Transitioned lower timeframe confirmation from M1 to M5 with 900s (15-minute) freshness TTL in `market-context.mjs`, `context-model.js`, and `scalper-system-push`.
- Resolved persistent empty dashboard issue (`WAIT · data belum siap / KONTEKS BELUM TERSEDIA`) caused by third-party feed 3–5 minute batching delays.
- Maintained backward compatibility by exposing both `.m5` and `.m1` in the context payload.
- Updated Mapping UI cards to `M5 · KONFIRMASI` and structural evidence flow `H1 → M15 → M5`.
- Updated Tanya Amy local assistant to read M5 confirmation.

## 2026-09-20 — Pro351 Replay history controls and focused Mapping

Candle Replay now offers a per-record Hapus action, repairs missing historical TP/SL evidence when its matching pack reaches the outcome candle, and reliably removes mirrored local-storage records. Mapping Analyze presents a compact evidence-first view with secondary details collapsed for mobile.

## 2026-09-20 — Pro350 Replay history

Replay now shows all locally saved replay decisions across packs/timeframes directly below its workspace, with WAIT, waiting-fill, active, TP and SL labels, notes, levels and timestamp/low/high evidence. Chart Analysis records are excluded; original decision identities remain readable.

## 2026-09-20 — Pro349 replay persistence and evidence

Pro349 adds resilient IndexedDB/localStorage trade reconciliation plus auditable SL/TP evidence in local replay history. The evidence records the touched level, closing candle timestamp and low/high range, including an explicit ambiguous-candle marker. No strategy, candle source, or decision geometry changes.

## 2026-09-19 — Pro348 unified application UI

Home, Mapping, Market Intel, Journal, and Academy now share a clearer typographic hierarchy, consistent touch targets/cards, restrained sticky navigation, readable news expansion cues, and single-column small-screen layouts. The polish uses existing semantic theme tokens so System, Light, Dark, and custom colors remain compatible.

## 2026-09-19 — Pro347 custom colors

Profile now provides persisted background, card, text, and accent color controls plus reset. Overrides are applied by the shared theme controller across Home and modules without replacing the existing System, Light, and Dark modes.

## 2026-09-17 — Pro345 preparation
Pro345 branch adds a native HTML × Hapus button inside the selected-drawing chart, touch target >=44px, accessible label and focus return. Shared Replay/Chart Analysis implementation; no menu required.

## 2026-09-17 — Pro344 replay fix
Pro344 /950344 prepared locally: sticky × Tutup button in drawing tools, focus returns to summary; Gesture Chart closes panel. Existing tool selection still auto-closes. Saved drawings preserved by tests.


## 2026-09-17 — Pro343 home chart

Pro343 home price chart: M5/M15, manual/60s visible refresh, local ICT plan levels, source timestamp/WITA, stale/error states and light/dark theme. All four module shortcuts remain. Focused18 tests passed; all130 JavaScript regression files passed (exit0). Visual Android validation remains unobserved.


## Market Intel Client-Side Auto-Translation and Offline Cache
- **Date:** 2026-09-13
- **Status:** ✅ Implemented and tested; bump Pro339
- **Description:** Real-time client-side translation directly in Android WebView/browser, bypassing server IP blocks with local cache persistence.
- **Release:** `2.0.0-pro.339` / `950339`.

## TradingView-style Horizontal Zoom and Drawing Synchronization
- **Date:** 2026-08-17
- **Status:** ✅ Released; eight focused chart tests and all 119 regression files pass; signed `.326` Android CI and endpoint verification pass
- **Description:** Candle spacing supports explicit horizontal pinch/time-axis scaling, blank Select/Edit space preserves chart gestures, and every drawing is reprojected from TIME + PRICE anchors across logical/time/price/size transformations.
- **Release:** Active `2.0.0-pro.326` / `950326` with verified identity, signer continuity, release asset, checksum, and download endpoint.

## Trading Practice Mobile Drawing Interaction Repair
- **Date:** 2026-08-17
- **Status:** ✅ Released; seven focused chart tests and all 119 regression files pass; signed `.325` Android CI and endpoint verification pass
- **Description:** Finished drawings automatically enter Select/Edit, rendered objects and handles expose mobile-sized hit targets, drag changes persist in TIME + PRICE, and annotation entry uses a fixed dialog that cannot be clipped by the chart.
- **Release:** First shipped in `.325`; current active `.326` preserves the mobile drawing repair.

## Trading Practice Advanced Drawings and Continuous Live Chart
- **Date:** 2026-08-17
- **Status:** ✅ Released; 17 focused tests and all 119 regression files pass; signed `.324` Android CI gates and endpoint verification pass
- **Description:** Added selectable/movable chart drawings, active-pack historical→Live continuity, and persistent replay-decision feedback/history retrieval.
- **Release:** Originally released in `.324`; current active `.326` includes both mobile drawing-interaction and scale-synchronization repairs while preserving this continuity contract.

## Academy Trading Practice + ICT Berbasis Backtest
- **Date:** 2026-08-16
- **Status:** ✅ Source implemented and targeted regression-validated; no APK/release/backtest run by request
- **Trading Practice:** Added a real locally bundled candlestick chart, M1–D1 aggregation, zoom/pan/crosshair, persistent drawing tools, CSV/JSON OHLC import, native Twelve Data WebSocket tick aggregation, manual BUY/SELL/WAIT records, local outcome history, and three guided chart exercises.
- **Replay:** Added timestamp-owned candle replay with previous/advance/play/speed controls and pre-aggregation future filtering across timeframe switches.
- **Learning:** Added the separate nine-document `ICT Berbasis Backtest` path from the requested Google Drive source, complete with source provenance, catalog progress, reading resume/history reuse, completion state, and supported Practice CTAs.
- **Academy integration:** Added three track selectors and global Academy navigation while preserving all existing Bagian 1–36 content, quiz behavior, history, and the market-learning bridge.
- **Validation:** JavaScript syntax, diff whitespace, static asset references, and four focused replay/core/trade regressions. No Android build, visual QA campaign, strategy validation, release, or metadata/version change.

## Amy-SMC-D Canonical Mapping Engine
- **Date:** 2026-08-11
- **Status:** ✅ Implemented and 112-file JavaScript regression validated; private signed release workflow verification required
- **Description:** Replaced the Preview directional Mapping path with a native deterministic replay of Amy-SMC-D baseline blob `d6e6d7c979dd5a852bddd9661bef0480caa2eb35`, covering descriptive/context fields, fresh structure evidence, and all named predictive event fields.
- **Dealing Range:** M5/M15 preserve structural ranges with pure-location 70/30 and 60/40 boundaries. H1 uses previous 240 closed H1 bars with 55/45 boundaries. All are descriptive-only and cannot alter predictors or Final Bias.
- **Data flow:** REST closed candles are validated, ordered, deduplicated, and replayed sequentially without future data, interpolation, or synthetic gap candles. The last valid closed result survives provider staleness. Native Twelve Data WebSocket ticks remain display-only.
- **UI/Consumers:** Dashboard is reduced to Final Bias, Next Move, and Dealing Range; Analyze separates context, fresh evidence, and predictive events. Rencana Eksekusi, Entry Watch, Scalper, scanner, lifecycle, and notifications consume the canonical snapshot without directional authority.
- **Validation:** Added deterministic fixtures for required SHA/contract, rejected forming/synthetic candles, unfilled gaps, live-price independence, H1 previous-240 exclusion, M5/M15 structural sources, DR dependency isolation, and qualified BOS `N=0`. Full suite passes 112/112 files.
- **Release:** Candidate `2.0.0-preview.316` / `940316`; private manifest activation remains post-signed-APK verification.

## Professional Glassmorphism Full UI Redesign
- **Date:** 2026-08-02
- **Status:** ✅ Implemented and regression/viewport validated; signed release activation pending
- **Description:** Reworked Beranda, Mapping, Berita, Jurnal Trading, Tutorial Trading, nested Academy pages, loading, update dialog, and Amy Mentor surfaces around a shared navy/graphite glass system with ice-blue accents and responsive vector UI.
- **Themes:** Added persistent System, Terang, and Gelap modes plus native Android status/navigation bar synchronization.
- **Truthful UI:** Beranda now exposes exactly five existing modules, Koleksi only renders actual stored items, and Profil removes fabricated VIP/profile claims while showing actual local counts, connectivity, scanner, data source, notification, and version/update state.
- **Compatibility:** Legacy Blueprint runtime contracts remain installed; Mapping engine, scanner, lifecycle, notifications, formulas, market sources, and user data were not refactored.
- **Validation:** Full 95-file JavaScript regression suite, syntax checks, and Chromium mobile viewport checks for dark/light themes, all principal modules, truthful empty states, overflow, and error fallbacks. No backtest was run.
- **Release:** Candidate `2.0.0-preview.299` / `940299`; manifest activation occurs only after the signed APK workflow succeeds.

## Scalper Pattern v3 — BT6/BT6.1 + AMD
- **Date:** 2026-08-01
- **Status:** ✅ Implemented; release/deployment verification required
- **Description:** Added closed-candle Pattern BT6 gates to nine existing Scalper drivers, BT6.1 repair overlays to the four Blueprint drivers, and an independent AMD M30/H1 driver with shortest-window accumulation selection, manipulation invalidation, distribution FVG confirmation, and midpoint-limit entry.
- **Lifecycle:** New schema-v3 setups use volatility-aware 0.18/0.20 ATR buffers, fixed TP1 +10 and TP2 +20 points, no breakeven move, 50-point structural-risk cap, 24-hour timeout, and chronological M1 SL-first evaluation.
- **Operations:** Added immutable config records, per-candidate telemetry, environment kill switches, Preview UI metadata, and deterministic unit/regression coverage.
- **Backtest:** Not rerun. The user-provided Blueprint results were accepted and the Master Backtest workbook was inspected read-only.

## Preview Canonical News Delivery and Native Update Alert
- **Date:** 2026-08-01
- **Status:** ✅ Implemented; release/deployment verification required
- **Description:** Added one Preview-only FCM notification route with canonical event keys, atomic per-device claims, retry/failure states, and a scheduler lease. Legacy server delivery and local fallback no longer target Preview devices.
- **Update UX:** A newer Preview manifest raises the native `Update Amy FX Preview Tersedia` notification and opens the existing signed-APK update dialog.

## Rencana Eksekusi
- **Date:** 2026-07-29
- **Status:** ✅ Implemented and regression/viewport validated
- **Description:** Added a compact Dashboard card and full Analyze card that translate the authoritative Mapping result into BUY/SELL/WAIT, focus, watch/entry area, next gates, locked entry/SL/TP/RR, structural target, invalidation, freshness, and lifecycle status without creating a second decision engine.
- **Authority:** `setupExecution` first, `entryMap.setup` second, then existing authoritative runtime contracts. Causal Entry Watch remains the only lifecycle owner.
- **Amy Bot:** Contextual buttons send the exact card decision and official levels through a secret-free `execution_plan` Context Envelope; Amy uses a deterministic explanation path and cannot change the decision.
- **Validation:** Feature regression matrix, full 87-file JavaScript suite, Mapping Accuracy V3 suite, and Android-size Chromium verification for duplicate cards, order, overflow, errors, navigation, accordion, and scroll stability.

## Causal Entry Watch 2021–2022 Correctness Hardening
- **Date:** 2026-07-29
- **Status:** ✅ Implemented and regression-validated
- **Description:** Preserved terminal lifecycle state across Mapping consumers, made replay session time injectable, separated structural-target diagnostics, enforced forecast-before-sweep-before-MSS ordering, and replaced unpaired Dealing Location anchors with a causal paired structural leg.
- **Validation:** XAU/USD 2021–2022 M5/M15 closed-candle replay, rolling 300 and 800 parity, priority-window audit, and full regression suite.
- **Result:** Dealing Location passes 2/2 M5 and 33/38 M15 displaced-MSS candidates. Final setup remains zero because SESSION is the next cumulative blocker; no threshold was changed.
- **Reference:** `docs/backtests/AMYFX_CAUSAL_ENTRY_WATCH_2021_2022_FINAL_VALIDATION.md`

## Mapping Accuracy V3 — All-Timeframe Causal Entry
- **Date:** 2026-07-28
- **Status:** ✅ Implemented; manual chart validation pending
- **Description:** Rebuilt Mapping around one closed-candle authority, strict structure/liquidity/zone lifecycle, point-in-time HTF and EMA entry gates, a causal entry sequence, and timeframe profiles for M1 through W1. Scanner and Entry Watch consume the same setup contract. H1 bearish remains suppressed; extrapolated profiles are labeled rule-based without probability claims.
- **Reference:** `docs/MAPPING_ACCURACY_V3_MANUAL_VALIDATION.md`
- **Backtest:** Not run by user request.

## Context-Aware Mapping & Deep-Link News
- **Date:** 2026-07-11
- **Status:** ✅ Implemented
- **Description:** Added point-in-time FVG ATR, volatility-scaled liquidity tolerance, displaced-origin OB validation, structurally anchored HTF ranges, context-only standalone structure events, plain-language Mapping explanation, newest-first News ordering, and exact notification-to-news deep links.
- **Backtest:** 117 filled M15 trades, 70.09% TP1 hit rate, +14.76R after $0.30 assumed cost, profit factor 1.34, maximum drawdown 6.34R.

## M15 Precision Mode
- **Date:** 2026-07-11
- **Status:** ✅ Implemented
- **Description:** Restricted actionable setups to M15, added 1R TP1 protection with 90% secure and 10% break-even runner toward TP2 ≥2R, synchronized live lifecycle states, and blocked raw non-M15 scanner targets.
- **Backtest:** Superseded by the stricter Context-Aware Mapping revalidation above.

## Mapping Logic Production Hardening
- **Date:** 2026-07-11
- **Status:** ✅ Implemented
- **Description:** Added historical liquidity sweep tracking, point-in-time ATR, strict sweep reclaim validation, minimum 1:2 RR rejection, structure-aware HTF narrative, active Silver Bullet routing, and seven JavaScript regression tests against the production engine.

## Institutional Market Intelligence Upgrade
- **Date:** 2026-07-11
- **Status:** ✅ Implemented
- **Description:** Added a shared Market Command Strip, deterministic Intel Briefing, distance-weighted Liquidity Magnetic Spine, Mapping Setup Lifecycle Rail, background-aware Market Intel refresh, request cancellation, and targeted live-price rendering for Android WebView performance.
- **Scope:** Additive UI/shared modules only. Heatmap computation, liquidity endpoint logic, ICT rules engine, and native scanner ownership remain unchanged.

## Admin Academy Link Fix
- **Date:** 2026-07-10
- **Status:** ✅ Implemented
- **Files:**
  - `app/src/main/assets/apps/academy/index.html`
- **Description:** Fixed WebView navigation to admin panel by using explicit `admin/index.html` path.

## News Translation to Indonesian
- **Date:** 2026-07-10
- **Status:** ✅ Implemented
- **Files:**
  - `api/news.js` — added `translateToId()` function
- **Description:** News from Telegram automatically translated to Bahasa Indonesia using Google Translate free API. Original text preserved in `textOriginal` field. Falls back to original text if translation fails.

## News Expand In-App (No Telegram Redirect)
- **Date:** 2026-07-10
- **Status:** ✅ Implemented
- **Files:**
  - `apps/market-intel/app.js` — changed `onclick` from `openLink()` to `classList.toggle('expanded')`
  - `apps/market-intel/styles.css` — added expand/collapse CSS
- **Description:** News items now expand/collapse text in-app instead of redirecting to Telegram. Source shown as label `Sumber: SM_News_24h`.

## Liquidity Tracker Tab
- **Date:** 2026-07-10
- **Status:** ✅ Implemented
- **Files:**
  - `api/liquidity.js` — new serverless endpoint (independent from heatmap)
  - `apps/market-intel/index.html` — added Liquidity tab button and panel
  - `apps/market-intel/app.js` — added `loadLiquidity()`, `renderLiquidity()`, tab handler, auto-refresh
  - `apps/market-intel/styles.css` — added `.liquidity-list`, `.liq-card`, `.liq-badge`, `.liq-price`, `.liq-meta`
- **Description:** New tab in Market Intel showing BSL/SSL swing levels that haven't been swept, sorted by distance from current price. Limited to 15 nearest levels.

## Liquidity API Endpoint
- **Date:** 2026-07-10
- **Status:** ✅ Implemented
- **Files:**
  - `api/liquidity.js`
- **Description:** Independent Vercel serverless function. Copies `fetchCandles()` and swing detection from heatmap.js. Detects BSL (swing highs) and SSL (swing lows), tracks sweep status, returns 15 nearest unswept levels.


## 2026-09-05 — Pro328

Pro328 source: Discipline Scalper (13 total registered methods including existing ERR/SMR); persisted method switches in Mapping history/performance; scoped backend preferences, setups and push; Academy track03 manual plan workspace, drawing style/drag improvements and 15 guided exercises. Upload/parser, replay candle progression and tracks01/02 preserved. Files span scalper engine/APIs, additive device identity, Mapping views, Academy trading-practice, migration and build version/workflow.

Pro328 released: signed APK and update manifest 950328 verified, GitHub Actions run 33976208755 passed the full JavaScript suite, Android tests/lint/build, signature continuity and downloaded checksum. Supabase migration 20260905154829 applied; preferences v1, device-register v4, setups v8, scoped push v6 and engine v11 deployed. Engine health returned HTTP200 with 13 drivers; preferences without a device capability returned HTTP401. APK SHA-256: ceed5e4408e5aabfd0387f2d1d977dcee6aa983bd5915bca24956f7458bbfd08.


## 2026-09-06 — Pro329

Pro329 source prepared: replay repeat mode, two-tap/drag drawing, direct object selection, eight rectangle resize handles, projections, object list, duplicate/delete/color controls, fullscreen including Android WebView CSS fallback. Source version 2.0.0-pro.329 / 950329. Supabase news-sync v11 deployed from public Telegram text; no manual invocation/post-deployment verification. GitHub connection is unavailable in this session, so commit publishing and APK329 release remain pending. Existing update.json remains328.


## 2026-09-09 — Pro332

Pro332 source: compact Replay heading, persistent fullscreen exit, object popover, data/help disclosures, concise copy, shared flat surfaces/spacing/typography for Home, Mapping, Market Intel, Journal and Academy, and collapsible Academy course summaries. Trading calculations, candle sources, history and notification ownership are unchanged.


Pro332 release completed: GitHub Actions run 34301702033 succeeded, including JavaScript regression, Android unit/lint/build, signing identity and published endpoint verification. Active public update.json is 2.0.0-pro.332 / 950332, enabled=true. Published APK SHA-256 62bd08b231bef85e768af95b50540ecfe3e0d6b3e71a77dbc670da18f4e297f1 matches the release asset digest. Earlier build/activation pending status is resolved. Actual device notification and WebView visual checks remain unobserved.



## 2026-09-09 — Pro335 replay navigation

Pro335 adds explicit Geser, return-to-cursor/follow, auto/manual price scale, redo (Ctrl/Cmd+Shift+Z), and Ctrl/Cmd+Z undo. Replay defaults to one-shot drawings with repeat still available. Existing drawing tools and fullscreen remain. This improves TradingView-style interactions; full TradingView feature parity is not claimed.


Pro335 release completed: commit 9d57a417d15b7774d04b26ec680a164240f35494, signed release workflow 34371918736 and lint workflow 34371918728 both succeeded. Active update.json is enabled at 2.0.0-pro.335 / 950335. APK asset digest matches manifest SHA-256 6c5815bf444b08e826032e8acdd3c8bbcf548098d06e069262627192caa4f49c. Release notes now describe replay navigation changes. No trading backtest was run. Actual Android gestures and receipt of the native update notification remain unobserved.

## 2026-09-12 — Pro337 ICT workspace

New Mapping engine, provider adapter and responsive chart workspace: H1 structure,
M5/M15 entry, evidence timestamps, pending/active distinction, locked entry/SL/target,
WAIT diagnostics and explicitly gross windowed simulation history. 125 JavaScript
regression files pass; source version337 prepared for existing signed release pipeline.
Profitability remains unverified; no backtest result is claimed.


## 2026-09-13 — Pro338 Academy

Pro338: 60 guided exercises across mudah/sedang/advanced, random choices and unseen-first sessions of 10/20/all, matching illustrative candle charts, session score and grouped mistakes with exact Jalur 01 lesson links; persisted last summary. Jalur 02 removed from panel/navigation. Existing Replay and Chart Analysis data providers preserved.


## 2026-09-13 — Pro340 local application assistant

Pro340 adds four-menu navigation and a local, deterministic application assistant: multi-module questions, short topic follow-ups, cached news search, journal totals/outcomes/recent evaluations, reading and guided progress, source-linked Academy passage lookup. It does not implement unrestricted natural-language understanding, live tick fetching, external AI, or order execution. All 127 JS regression files passed at source preparation; 13 dedicated assistant cases cover empty/stale data, analytics, retrieval and integration. Browser preview was blocked by ERR_BLOCKED_BY_CLIENT; real Android UI unobserved. Signed release pending at source preparation.


Pro340 release completed: source commit efa8c80406d57cc8c40b08ed6755d9ce3dac589e; signed workflow 34750969449 and lint workflow 34750969447 succeeded. All 127 JavaScript regression files and 14 dedicated assistant cases pass. Android unit tests, lint, APK identity/signer and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.340 / 950340. APK asset digest matches manifest SHA-256 3af71bbe25893f15411d380cc77938b5fd33f0f477f0a32a4df536d173f3f0b8. Earlier signed-release/manifest pending notes for Pro340 are resolved. Actual Android layout and receipt of native update notification remain unobserved; browser preview was blocked.


## 2026-09-13 — Pro341

- Brighter blue/violet frosted panels across Home, Mapping, News, Journal and Academy, preserving theme choice and data.
- ICT liquidity ladder with exact zone ranges, BSL/SSL side filters, source timeframe/time, distance from the Mapping candle close, relative swing counts, and expandable confirmation times. Hero, ladder and liquidity list refresh together; failures retain explicitly stale references.
- Source341 prepared for the existing signed APK pipeline. Signed release and on-device appearance not yet verified at this checkpoint.


Pro341 release verified: PR #3 merged as 89f147daa947632da15a21da5bd5b7ee5e8a297f. Signed release workflow34788293012 and main lint34788292968 succeeded. All128 JS files, Android tests/lint/build, existing signer continuity and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.341 /950341; APK digest matches manifest SHA-256 8f59f72ecb22ed384c5c390ea20e9a1927cd3e17ad9910b9ee6b4fde80d7943c. Earlier Pro341 publication-pending notes are resolved. Browser/device appearance and native notification receipt remain unobserved. Internal validation was aligned from Node20 to the repository-required Node22 after its old runtime failed to import stripTypeScriptTypes. Legacy Learning Preview and1.5.8 PR checks lacked their old signing cache; Pro release used its existing signer and passed verification.


## 2026-09-14 — Pro342 Mapping restoration

Pro342 Mapping: BUY/SELL filter, entry/SL/TP1/TP2 and zones from Supabase, explicit lifecycle and source age, selected setup chart overlay, 24-hour server history and existing full archive/method controls. All129 JavaScript regression files passed; five dedicated restore tests cover geometry, stale/terminal state, authoritative removal, device headers and provider failure. Browser preview blocked by ERR_BLOCKED_BY_CLIENT. Signed release pending.

## 2026-09-24 — Pro357 prepared on review branch

The Gold context workspace presents H1 bias and health, M15 control and POI lifecycle, M1 evidence, primary/alternative manual scenarios with numeric invalidation, liquidity levels, session/ATR context, narrative, and execution readiness. Supabase source functions generate context snapshots and context-only FCM events; archived setups remain accessible without issuing new active setups. Assistant and Market Intel no longer build a live plan from the retired local signal generator. Production deployment and signed APK release are pending approval; local JavaScript regression suite passed 137/137.


## 2026-09-30 — Pro375 AMY ICT complete Mapping

Implemented shared closed-candle Dashboard V2 (bias, locked invalidation, range/EQ, liquidity sweep, DOL, POI lifecycle), dual entry scores/near-invalid penalty, 16-row including header bias dashboard, score panel, narration and Strong/Ready markers. Added ICT reference MSS/BOS, displacement, OB/breakers/polarity, FVG/Implied FVG/BPR/VI, liquidity boxes, NWOG/NDOG, eight-level Fibonacci, D/W/M pivots, exact NY midnight and Asia range plus DST-aware killzones. Forty-six persisted display controls; chart candles now come from the same backend analysis snapshot. Local 140-file regression and 29 dedicated cases pass; Chromium mobile dark/light/all-controls/offline checks pass without page errors or overflow. See docs/mapping/AMY_ICT_PRO375.md for causal corrections and provider-period semantics.

## 2026-09-30 — Pro376 final integration guard

Completes the Pro375 integration with explicit opposing-score narration and current closed-M5 execution geometry. Source376 is a new APK identity because signed375 had already activated; do not replace a published APK at the same versionCode.


Pro376 final verification completed: signed Actions36696811345 and lint36696811141 succeeded. Active public update.json is enabled at2.0.0-pro.376/950376. Downloaded32,666,230-byte APK SHA-256 matches f1b861ca698ccd608b8fb88510e57adecc1acdc233a672459d5062ffd1580712, packaged app-version is376 and packaged amy-ict.js is byte-identical to the backend module. Final local140-file regression (30 dedicated AMY cases) and Chromium mobile dark/light/all-controls/offline checks pass, including a real server snapshot. scalper-engine v24 runs on scheduled cron, fresh COMPLETED snapshots expose amy-ict-complete-pro376; primary targets reject opposing/reached/wrong-side DOL. The last fix changes only backend serialization/tests/docs, not APK assets; [skip ci] prevents rebuilding/replacing the already verified APK at the same code. Real-device notification receipt and broker-matched TradingView comparison remain unobserved. Earlier Pro375/376 deployment/build-pending entries are resolved.


## 2026-09-30 — Pro377 Mapping ringkas

User authorized a presentation-only simplification and version bump. Main Mapping shows market state, manual readiness/news, primary POI/CE/invalidation/target and chart. Full bias, narration, evidence, liquidity, conditions, alternatives and six reference models stay accessible in closed Detail accordions; opened driver/scenario details survive refresh. All46 display controls remain in four groups, stored preferences are preserved. Chart narration prioritizes risk warnings in two lines; repeated structural labels and overlapping text are suppressed without removing drawings or numerical logic. Canonical engine, backend, scoring, risk gates and notification policies are unchanged. Source2.0.0-pro.377/950377; signed CI owns manifest activation after publication. Local141 regression files and Chromium360/390 dark/light/menu/offline smoke passed; release verification pending.


Pro377 release verification completed: source dc1ff82e9f6bd0571bac754484654141212ebafc; signed Actions36701710390 and lint36701710388 succeeded. Public update.json is enabled at2.0.0-pro.377/950377. Downloaded32,667,949-byte APK SHA-2561998d6efe381114b230d393db90f0a675dc2b7b6263f10f12775941796e7ed76 matches manifest/checksum; all changed Mapping assets match APK and shared trading engine remains byte-identical to backend. Final141 regression files and Chromium360/390 dark/light/settings/driver-refresh/news-lock/offline smoke passed. Earlier Pro377 publication-pending note is resolved. Real Android update-notification receipt remains unobserved.


## 2026-09-30 — Pro378 Chart Gold fullscreen

Chart Gold gains Fullscreen/Keluar, adaptive portrait/landscape layout, 16px price-axis and14px ICT/narration text. Close button, Back and Escape restore Mapping. Underlying menus/assistant are hidden while fullscreen, and46 display preferences remain unchanged.

Local verification: all141 regression files passed; Chromium360/390 portrait and844×390 landscape verified viewport fill,16px axis/14px overlay, one-finger pan, two-finger pinch, wheel zoom, preserved zoom/scroll, Back/Escape/native-request rejection, refresh/theme and offline clearing without errors or overflow. These are browser checks; actual Android device behavior remains unobserved.


Pro378 release verification completed: source7d9b2d608e4fe6dbb6addb7063dd039401282beb, signed Actions36704449764 and lint36704449726 succeeded. Public update.json enabled at2.0.0-pro.378/950378. Downloaded32,670,025-byte APK SHA-256516d95d6fd9bcfec15985dc6b8cc354e51480265d8ab0689936dce1947ce91bf matches manifest/checksum; all fullscreen assets match source and canonical trading engine remains byte-identical to backend. Final141 regression files and Chromium portrait/landscape360/390/844px, pinch/pan/zoom/scroll/Back/Escape/fallback/theme/refresh/offline checks passed. Earlier Pro378 release-pending note resolved. Actual Android device behavior and update notification receipt remain unobserved.


## 2026-09-30 — Pro379 TradingView axis gestures

Chart Gold supports drag right price axis for vertical scale, drag bottom time axis for candle width, native double-tap reset and Auto harga button. Gesture-driven canvas reprojection keeps ICT/AMY geometry aligned and dynamic axis widths protect plot bounds. Display preferences and fullscreen are preserved.

Local Pro379 verification: all142 regression files passed. Chromium touch price/time-axis scaling, overlay alignment, double-tap/Auto harga reset and refresh-preserved manual viewport passed; existing fullscreen, theme, Back/Escape, pinch/pan and offline checks passed without errors or overflow. Official Lightweight Charts v4.2.3 references and root cause are recorded in docs/mapping/CHART_GESTURES_PRO379.md.


Pro379 release verification completed: source6b6d447ead4e60b1f12957e42f0c20f543241af7, signed Actions36707758513 and lint36707758575 succeeded. Public update.json enabled at2.0.0-pro.379/950379. Downloaded32,670,665-byte APK SHA-256ff37cbe0180131239ae56fa46bb9b1b07c28a62f323e79d295922b91d80136ae matches public manifest/checksum; eight affected/fullscreen assets match source and canonical trading engine remains byte-identical to backend. All142 regression files and Chromium touch price/time-axis scaling, double-tap/Auto harga reset, overlay alignment, refresh-preserved viewport and existing fullscreen/pinch/pan/Back/Escape/theme/offline checks passed. Earlier Pro379 release-pending notes resolved. Actual Android device gestures and update notification receipt remain unobserved.
 
 
## 2026-09-30 — Pro380 Academy Curriculum Restructure
 
Restructured Amy FX Academy from 665 fragmented HTML files down to 56 files (91% reduction in fragmentation). Implemented university-style 3 Semester structure with 36 Pertemuan (~1 Jam / SKS per Pertemuan). 569 sub-chapters consolidated into 36 master modules with chapter badges, desktop sticky sidebar TOC with scroll-spy highlight, mobile expandable drawer TOC, quiz container, and smooth next/prev navigation. Cleaned duplicates and stubs, synchronized 36-entry registry, and audited 1,360 links with zero broken links.


## 2026-09-30 — Pro382 six-driver evaluation

Pro382 / 950382: six-drivers.mjs, six-driver-lifecycle.mjs; backend persistence + telemetry; enam toggle; setup/level chart/riwayat; BE Adaptive, conditional early cut Rapid, risk policy Shield. Tambah migration constraint enam model dan regression/replay tools. Validasi dan publikasi dicatat setelah selesai.


Pro382 release verification completed: source 11239e1de1b42d6677cbd074619c636507d762ab; signed Actions36792997261 and lint36792997230 succeeded. Public update.json enabled at2.0.0-pro.382/950382. Downloaded31,534,089-byte APK SHA25634f42b0f0e34995e7df9ff0a425e3e68b74ec59acfa531f08f0ea007d4b32b3f matches manifest/checksum; all11 changed assets match source.146 regression files pass. Production engine25/setup-reader11/preferences2 active; five engine files byte-identical to source and successful live run returns all6 driver evaluations. Browser360/390 light/dark, toggles, detail refresh, selected chart, offline and overflow checks pass. Replay240 M5 with synthetic calendar produced one Rapid candidate; not a profitability backtest. Earlier build/deployment-pending notes are resolved. Actual Android update receipt remains unobserved.
