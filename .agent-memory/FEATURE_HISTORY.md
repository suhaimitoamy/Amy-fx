# Feature History

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
