# Changelog

## 2026-07-11 — Market Context & Notification Routing Hardening

- Replaced latest-regime FVG validation with point-in-time ATR.
- Made equal-high/equal-low, external-level, sweep, and deduplication tolerances volatility-aware.
- Required Order Blocks to originate from a valid displaced structure break and scored their imbalance origin.
- Anchored HTF dealing ranges to confirmed structural swings instead of the nearest level around current price.
- Downgraded standalone BOS/CHOCH and displacement candles to context-only; they can no longer trigger execution.
- Rewrote Mapping explanation into plain Indonesian: direction, confirmation, target, action, and risk.
- Sorted Telegram news by numeric post ID before filtering and reduced edge-cache staleness.
- Added per-news deep links, focused-item scrolling, bounded synchronization retry, and generic native routes for News, Journal, and Academy notifications.
- Added five regression checks; 14 JavaScript tests now pass.
- Revalidated January–June candles: 70.09% TP1 hit rate across 117 trades, +14.76R, profit factor 1.34, and 6.34R maximum drawdown after a $0.30 cost assumption.

## 2026-07-11 — M15 Precision Mode

- Restricted actionable Mapping setups and native scanner targets to M15.
- Added TP1 at 1R, 90% profit secure, break-even runner, and TP2 ≥2R lifecycle.
- Added TP1 Secured, Runner to TP2, TP1 + BE, and TP2 Hit live states.
- Superseded by the stricter Market Context revalidation above.

## 2026-07-11 — Mapping Logic Production Hardening

- Prevented swept liquidity from becoming active again after price reversal.
- Replaced latest-ATR historical validation with point-in-time ATR.
- Required sweep candles to close back inside the liquidity level.
- Raised minimum setup RR to 1:2 and made violations fatal.
- Combined HTF structure with Premium/Discount location.
- Fixed Silver Bullet precedence inside the New York session.
- Added seven production-engine regression tests.

## 2026-07-11 — Institutional Intelligence UI

- Added shared XAU/USD Market Command Strip to Market Intel and Mapping.
- Added rule-based Market Briefing combining liquidity, Mapping, session, and news risk.
- Upgraded Liquidity Node Map with proximity/freshness strength and Nearest Draw emphasis.
- Added Setup Lifecycle Rail for Sweep → MSS → FVG/OB → Entry → Target.
- Added request cancellation, visibility-aware refresh, reduced-motion handling, and targeted Mapping live-price updates.

## 2026-07-10 — Stability Pass

## 2026-07-11 — Mockup UI Pass

- Reworked the main shell toward the Amy FX black-and-gold mockup: Beranda, Proyek, Koleksi, and Profil.
- Added a compact home dashboard, quick module access, local collection history, and device profile status.
- Simplified Mapping Dashboard into price, bias, timeframe, setup focus, and active-session cards.
- Kept detailed Mapping diagnostics available under Analyze instead of showing every block at once.

- Disabled automatic Mapping setup notifications to prevent conflicts with native scanner alerts.
- Fixed candle cache retention using seconds instead of milliseconds.
- Excluded the latest still-forming REST candle from Mapping analysis.
- Aligned Mapping and native scanner target expiry to 24 hours.
- Fixed setup conflict handling in Decision confidence.
- Improved TwelveData provider error propagation.
- Excluded secondary Mapping diagnostics behind collapsible sections on mobile.
- Replaced the Academy auth stub with a device-local access code.
- Synchronized Market Intel Liquidity assets into the Android APK source.
- Restored the missing Kotlin MappingLogicCore source used by unit tests.

## 1.2.0 - 2026-06-25

### Android / Build

- Target SDK dinaikkan ke 35.
- Version name disiapkan ke 1.2.0.
- Release build mengaktifkan R8 minify dan resource shrink.
- Debug build dipisahkan dengan suffix `.debug`.

### Security

- Menambahkan `SecurePrefs.kt` untuk penyimpanan API key dengan encrypted preferences.
- Menambahkan ProGuard rules agar WebView bridge tetap aman saat R8 aktif.

### Scanner

- Menambahkan cooldown notifikasi 30 menit per level BSL/SSL.
- Menambahkan expiry target Mapping setelah 24 jam.
- Menambahkan reconnect bertahap.
- Memisahkan channel notifikasi foreground scanner, target alert, dan info.
- Tap notifikasi target membuka Mapping.

### Data

- Menambahkan index SQLite tambahan.
- Menambahkan cleanup candle cache berdasarkan umur data.
- Menambahkan fungsi clear cache dan cek ukuran storage.

### Mapping

- Menambahkan `MappingLogicCore.kt` untuk logic dasar swing, BOS/CHOCH, FVG, OB, dan setup score breakdown.
- Menambahkan unit test awal untuk score, FVG, dan swing detection.

### Docs

- Menambahkan dokumentasi arsitektur.
- Menambahkan dokumentasi setup API.
