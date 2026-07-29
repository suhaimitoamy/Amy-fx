# Feature History

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
