# Bug History

## Fixed Market Context & Notification Defects — 2026-07-11

### Historical FVG ATR Contamination
- **Severity:** High
- **Cause:** Every historical FVG was validated with the newest ATR regime.
- **Fix:** Each FVG now stores and uses ATR from immediately before it formed.

### Fixed-Price Liquidity Tolerance
- **Severity:** High
- **Cause:** Equal highs/lows and level deduplication used hardcoded XAU distances regardless of volatility.
- **Fix:** Clustering, external classification, sweep penetration, and deduplication now scale with current ATR.

### Weak Order Block Origin
- **Severity:** High
- **Cause:** The last opposite candle could be labeled an OB even without a valid displaced break.
- **Fix:** OB creation now requires a valid displaced break and records whether the impulse created imbalance.

### News Notification Opened Generic Page
- **Severity:** High
- **Cause:** Notifications carried only the Market Intel page URL, not the Telegram post ID.
- **Fix:** Notifications now deep-link to `#news=<post-id>`; Market Intel opens the News tab, expands the item, and scrolls it into view.

### Newest News Missing
- **Severity:** High
- **Cause:** The API sliced Telegram HTML order before sorting, while item timestamps could be empty or approximate.
- **Fix:** Posts are sorted by numeric Telegram ID before filtering/slicing and refreshed with a minute cache key.

## Fixed Mapping Logic Defects — 2026-07-11

### Historical Liquidity Reactivation
- **Severity:** High
- **Cause:** Mapping classified liquidity from current price only, allowing previously swept levels to become active again after price returned.
- **Fix:** BSL/SSL and EQH/EQL now scan every closed candle after their origin index and preserve `SWEPT` state.

### Historical ATR Regime Contamination
- **Severity:** High
- **Cause:** All historical structure breaks used the latest 14-candle ATR.
- **Fix:** Each breakout now uses ATR calculated only from candles preceding that breakout.

### Loose Sweep and RR Validation
- **Severity:** High
- **Cause:** The primary sweep model did not require a close back inside the level, and RR below 1:2 could survive filtering.
- **Fix:** Sweep requires wick penetration plus reclaim close; RR below 2.0 is a fatal conflict.

### HTF Location-Only Bias
- **Severity:** High
- **Cause:** Discount automatically implied bullish and Premium automatically implied bearish.
- **Fix:** Confirmed HTF structure determines direction; Premium/Discount now measures alignment and entry quality.

### Unreachable Silver Bullet Window
- **Severity:** Medium
- **Cause:** New York Killzone matched before its nested Silver Bullet window.
- **Fix:** Silver Bullet is evaluated first.

## Fixed Bugs

### Mapping Closed-Candle Contamination
- **Date:** 2026-07-10
- **Severity:** High — the latest TwelveData candle was treated as closed during Mapping analysis.
- **Fix:** Mapping candle loading now excludes the newest still-forming REST candle from the analysis set.

### Target Expiry Documentation Mismatch
- **Date:** 2026-07-10
- **Severity:** Medium — Mapping and native scanner used a 4-hour expiry while project QA specified 24 hours.
- **Fix:** Both JS live-state filtering and native scanner expiry now use 24 hours.

### Mapping Conflict Confidence Penalty
- **Date:** 2026-07-10
- **Severity:** Medium — confidence checked the final bias text for `CONFLICT`, although conflicts belong to the setup object.
- **Fix:** Decision confidence now reads the setup conflict level.

### TwelveData Error Masking
- **Date:** 2026-07-10
- **Severity:** Medium — provider HTTP/status errors were converted into empty successful responses.
- **Fix:** TwelveData proxy, Heatmap, Liquidity, and News endpoints now expose provider failures with error HTTP statuses.

### Mapping Analysis UI Density
- **Date:** 2026-07-10
- **Severity:** Medium — Analyze rendered every diagnostic section expanded at once.
- **Fix:** Secondary Mapping sections are now collapsible; the Decision card and Valid Break section remain visible first.

### Academy Admin Auth Stub
- **Date:** 2026-07-10
- **Severity:** High — Academy access functions always returned success.
- **Fix:** Added a device-local first-use access code with SHA-256 storage and session-based access.

### Mapping Automatic Notification Collision
- **Date:** 2026-07-10
- **Severity:** High — WebView setup notifications could duplicate or conflict with native scanner alerts.
- **Cause:** `runAnalysis()` called `notifyImportant()` after each analysis result.
- **Fix:** Removed the automatic `notifyImportant()` call. Native `ScannerService` remains the only automatic target-alert owner; manual test notification remains available.

### Candle Cache Retention Unit Mismatch
- **Date:** 2026-07-10
- **Severity:** High — candle cleanup compared Unix seconds with Unix milliseconds.
- **Cause:** candle `open_time` values are stored in seconds, while `cleanupExpiredCandles()` used a millisecond cutoff.
- **Fix:** Retention cutoff now uses Unix seconds.

### Android Market Intel Asset Drift
- **Date:** 2026-07-10
- **Severity:** Medium — APK assets had only News and Heatmap while repo source had Liquidity.
- **Cause:** `apps/market-intel/` and `app/src/main/assets/apps/market-intel/` were different versions.
- **Fix:** Synchronized the repo source version into the Android WebView assets.

### Missing Kotlin Mapping Core
- **Date:** 2026-07-10
- **Severity:** Medium — unit tests referenced `MappingLogicCore` without a production source file.
- **Fix:** Restored `MappingLogicCore.kt` from the repository backup so the test source has its required class.

### Admin Academy Failed to Load
- **Date:** 2026-07-10
- **Severity:** High — page completely fails to open
- **Cause:** `apps/academy/index.html` used folder-only link:
  ```html
  <a href="admin/">Admin</a>
  ```
  Android WebView with `file:///android_asset/...` does not auto-resolve folders to `index.html`, causing the page to fail and redirect to `error.html`.
- **Fix:** Use explicit path:
  ```html
  <a href="admin/index.html">Admin</a>
  ```
- **File changed:** `app/src/main/assets/apps/academy/index.html`
- **Note:** Do NOT modify `MainActivity.kt` for this issue.

---

## Known Issues (Not Fixed Yet)

### auth.js Is Still a Stub
- **Status:** ⚠️ Known issue, not fixed
- **File:** `app/src/main/assets/apps/academy/assets/js/auth.js`
- **Problem:** `requireLogin()` always returns true, `validateCode()` always returns `{ok: true}`. Admin panel is not actually protected — anyone can access and edit Academy content.
- **Risk:** Low if app is private, High if app goes public.
- **Proposed fix:** Add SHA-256 passcode validation (see implementation plan).

### API_BASE Hardcoded
- **Status:** ⚠️ Known issue, not fixed
- **File:** `apps/market-intel/app.js` (line 9)
- **Problem:** `API_BASE = 'https://amy-fx.vercel.app/api'` — if domain changes, frontend will still hit old domain.
- **Risk:** Medium — breaks if Vercel deployment moves to a different domain.
- **Proposed fix:** Detect WebView (`file://` protocol) and fallback to hardcoded, otherwise use relative `/api`.

### TwelveData Error Response Not Handled
- **Status:** ⚠️ Known issue, not fixed
- **Files:** `api/heatmap.js`, `api/twelvedata.js`, `api/liquidity.js`
- **Problem:** TwelveData can return HTTP 200 with `{"status": "error", "message": "..."}` (e.g., rate limit). Code currently ignores this and returns empty data silently.
- **Risk:** Low — fails silently, user sees "no data" without explanation.
- **Proposed fix:** Add `if (data.status === 'error') throw new Error(data.message)` after `res.json()`.

### Telegram Scraping Regex May Break
- **Status:** ⚠️ Known issue, not fixed
- **File:** `api/news.js` — `extractPosts()` function
- **Problem:** Regex depends on exact Telegram HTML class names (`tgme_widget_message_text`, etc.). If Telegram changes their web view markup, scraping silently returns empty.
- **Risk:** Medium — no monitoring or alert when this happens.
- **Note:** Do NOT change `extractPosts()` regex unless it actually breaks. Adding diagnostic info is safer.

## GitHub Actions Academy Vault Checkout Failure — 2026-07-11

- **Severity:** High — APK build stopped before Gradle ran.
- **Cause:** Both APK workflows tried to checkout the private `amy-trading-academy-vault` repository during every build, although the generated Academy assets were already committed in Amy-fx. The missing cross-repository token caused `Input required and not supplied: token`.
- **Fix:** Removed the private Vault checkout and runtime Academy generator steps from `.github/workflows/build-apk.yml` and `.github/workflows/build-debug.yml`. APK builds now use the committed Academy assets directly.
- **Verification:** GitHub Actions `Build Amy FX APK` run 29158586991 completed successfully.
