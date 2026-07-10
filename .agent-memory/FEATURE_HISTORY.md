# Feature History

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
