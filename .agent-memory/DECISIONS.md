# Technical Decisions

## 2026-07-11

### Mapping Production Logic
- Liquidity state is historical and irreversible within the loaded candle set: once a post-origin candle sweeps a level, that level cannot return to ACTIVE.
- Structure displacement uses point-in-time ATR from candles available before the breakout.
- Valid liquidity sweeps require both wick penetration and a close back inside the swept range.
- Minimum accepted setup RR is 1:2; lower RR is a fatal conflict and INVALID.
- HTF structure owns directional bias; Premium/Discount is an alignment filter, not a standalone direction signal.
- Silver Bullet takes precedence over the broader New York Killzone during 10:00–11:00 New York time.

### Institutional Intelligence UI
- Market Intel and Mapping share a local `AmyFXIntel` snapshot/event layer.
- The shared layer is presentation-only and does not replace or modify the ICT rules engine.
- Market briefing remains deterministic and rule-based; it must not be presented as AI or an execution signal.
- Market Intel requests are cancellable per panel and pause while the WebView is hidden.

### Mapping Render Performance
- Live price ticks update targeted DOM nodes instead of fully rebuilding the Analyze view.
- Connection and scanner synchronization use explicit selectors; full-document scanning is not allowed in the recurring one-second task.

## 2026-07-10

### Notification Ownership
- Automatic setup notifications from the Mapping WebView are disabled.
- Automatic target alerts are owned by the native `ScannerService` only.
- Mapping keeps the manual test notification action for debugging.

### API Separation
- Mapping candle history uses the existing Vercel `/api/twelvedata` proxy.
- Mapping live price and background scanning continue using TwelveData WebSocket directly because the Vercel functions are request-based, not persistent WebSocket relays.
- Market Intel continues using separate Vercel endpoints for News, Heatmap, and Liquidity.

### Android Asset Synchronization
- `apps/market-intel/` is synchronized into `app/src/main/assets/apps/market-intel/` so the APK receives the same three-tab implementation as the repo source.

### Mapping UI Density
- Analyze keeps the Decision card and Valid Break visible as the primary view.
- M1–H4 table, Mapping Notes, and active setup details are collapsible to reduce mobile information overload.

### Mockup UI Direction
- Main navigation follows the provided Amy FX mockup: Beranda, Proyek, Koleksi, and Profil.
- Home prioritizes a compact hero, quick module cards, and recent projects.
- Mapping Dashboard prioritizes price/bias, timeframe, setup focus, and session focus; detailed diagnostics remain in Analyze.

### Academy Access
- Academy access uses a local first-use code rather than a paid backend or hardcoded shared password.

### Admin Academy WebView Fix
- Admin Academy WebView error fixed by changing `admin/` link to `admin/index.html`.
- WebView Android via `file:///android_asset/...` does not auto-resolve folders to `index.html`.
- Fix applied in `app/src/main/assets/apps/academy/index.html` only — `MainActivity.kt` not touched.

### News Translation
- News translation uses Google Translate unofficial free endpoint (`translate.googleapis.com/translate_a/single?client=gtx`) with native `fetch`.
- Fallback: if translation fails, original English text is preserved.
- Original text stored in `textOriginal` field in API response.
- Translation happens server-side in `api/news.js`, not on frontend.

### News Click Behavior
- News item click should expand/collapse text in-app using CSS class toggle, not auto-redirect to Telegram.
- Source shown as label `Sumber: SM_News_24h` instead of Telegram link.

### Liquidity Tracker Architecture
- Liquidity tracker is a **separate endpoint** `api/liquidity.js` — independent from `api/heatmap.js`.
- Swing detection logic is copied (not imported) from heatmap to maintain independence.
- Tracks BSL (buy-side liquidity / swing highs) and SSL (sell-side liquidity / swing lows).
- Only shows levels that have NOT been swept.
- Sorted by distance from current price, limited to 15 nearest levels.

### Heatmap Preservation
- Heatmap logic (`computeHeatmap` in `api/heatmap.js`) must remain untouched.
- Any new liquidity-related features must be built as separate files/endpoints.

### Dependency Policy
- Project should avoid npm dependencies unless necessary.
- All serverless functions use native `fetch` — no axios, node-fetch, etc.

### Hermes Model Switch
- Hermes agent switched from DeepSeek to Gemini to save DeepSeek tokens.
- MOA (Mixture of Agents) disabled to reduce double API calls.
- Config: `/root/.hermes/config.yaml`
