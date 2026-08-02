# Technical Decisions

## 2026-08-02

### Professional Glassmorphism Presentation Contract
- The app-facing product name is `Amy FX`. The permanent Android package label, application ID, URI scheme, release tag, and native update notification retain the private Preview identity for upgrade safety.
- Beranda contains exactly five existing modules: Mapping, Berita, Jurnal Trading, Tutorial Trading, and Indikator TradingView. No duplicate access block, fabricated membership, sample profile, or hardcoded collection item is allowed.
- Koleksi displays only data actually stored on the device; an empty device receives an explicit empty state. Profil reports actual local counts, connectivity, scanner state, data source, notification test, version/update state, and System/Light/Dark theme preference.
- Shared presentation primitives are owned by `amyfx-ui-tokens.css`, `amyfx-theme.css`, `amyfx-components.css`, `amyfx-theme-controller.js`, and `amyfx-loading.js`. Legacy Blueprint assets remain loaded for runtime contracts, with the new presentation layer applied last.
- Dark navy/graphite and light ice-blue themes use semantic BUY/SELL/WAIT colors and vector icons. Android status/navigation bars follow the resolved app theme.
- Loading is delayed 350 ms, uses an Amy monogram and indeterminate ring, and exposes timeout/retry without fabricated percentage progress.
- This redesign is presentation-only. Mapping authority, formulas, market data, scanner, lifecycle, notification ownership, and user data remain unchanged. No backtest is run for UI work.

### Preview `.299` Update Activation Sequence
- Source identity advances to `2.0.0-preview.299` / `940299` while the published manifest remains `.298` until the signed release workflow succeeds.
- The workflow builds, tests, signs, verifies, and publishes the APK before updating `preview-update.json` to `.299`.
- A device on `.298` receives the exact native notification title `Update Amy FX Preview Tersedia` before the in-app Amy FX update dialog.

## 2026-08-01

### Private Preview Scalper Pattern v3 Contract
- This contract applies only to `personal/amyfx-private` and supersedes the 2026-07-30 Scalper Shadow buffer/target/BE contract for new schema-v3 setups. Legacy schema-v2 lifecycle remains readable and unchanged.
- The user-approved source of truth is `Blueprint Update Scalper Engine BT6 + AMD`; `Amy FX Master Backtest` was inspected read-only for baseline context. No backtest, replay, threshold search, or historical rerun is part of this upgrade.
- Nine existing drivers pass their raw closed-candle candidates through BT6 gates. The four named repair drivers additionally pass BT6.1 overlays. AMD is the tenth independent M30/H1 driver; there is no cross-driver veto or minimum-driver requirement.
- Pattern features are calculated only at the selected closed signal candle. Configuration IDs are immutable: `BT6-2025-V1`, `BT6.1-2026-H1-V1`, and `AMD-2025-V1`; global, repair, and per-driver kill switches remain available.
- New schema-v3 lifecycle uses a 0.18 ATR structural buffer, or 0.20 when ATR14/current is at least 1.20 of the previous-50 median with at least 20 samples. TP1 is fixed at +10 points, TP2 at +20 points, Stop Loss never moves to breakeven, max hold is 24 hours, and an ambiguous M1 candle resolves SL first.
- AMD waits for a midpoint FVG limit fill and cancels if the manipulation extreme breaks before the fill; the shortest qualifying accumulation window owns the candidate.

### Preview Notification Ownership
- Preview news devices are excluded at the upstream legacy data-push owner and from local WorkManager fallback. The unchanged downstream public system route therefore receives no new Preview delivery pairs. One Preview-only FCM system-notification route owns delivery using canonical event keys, an atomic per-device ledger, retries, and a scheduler lease.
- A newer enabled `preview-update.json` version must invoke the native `Update Amy FX Preview Tersedia` notification before showing the in-app update dialog. The signed release must exist and pass identity/signer verification before the manifest is activated.

## 2026-07-31

### Private Preview Live-Price Ownership
- These rules apply only to `personal/amyfx-private`; the public `main` release identity and pipeline remain unchanged.
- XAU/USD display price is owned by one native Android Twelve Data WebSocket subscription. The WebView receives validated price/status events and never receives the API key.
- The WebSocket key comes from encrypted native preferences, with an optional private CI build value for first connection. It is never stored in repository source or WebView `localStorage`.
- Mapping candle history and analysis continue using the existing Vercel Twelve Data REST proxy. Live ticks may update price-facing UI/snapshots but do not replace closed-candle facts.
- Provider timestamps determine live-tick freshness. Network return, foreground resume, socket closure, and a stalled tick stream trigger bounded reconnects without REST live-price fallback.

## 2026-07-30

### Preview Mapping Stable-DOM Contract
- `#app` renders are state-signature gated. Equal Mapping state must not rebuild or republish the root view.
- Dashboard and Analyze use stable keys and canonical source order. Disclosure nodes retain their identity/open state, and presentation observers may not invent a different order.
- Background analysis and Scalper requests are single-flight/cancellable. A superseded result cannot write state, and background refresh cannot show a full-page loading placeholder or force scroll.
- Scalper Shadow owns exactly one permanent shell in each current Mapping view. No setup, stale data, or a transient backend error changes the shell’s existence or clears the last valid content.
- The Mapping header has one textual value only: `●`. Fresh/loading/stale/offline state is color/attribute metadata; obsolete header clocks remain hidden while the in-card WITA session clock remains available.

### Scalper Shadow Causal Stop and Lifecycle Contract
- These rules apply only to Scalper Shadow and do not alter Mapping Accuracy V3, Rencana Eksekusi, Causal Entry Watch, or legacy Mapping SL/TP.
- Signal structure and ATR are taken from fully closed setup-timeframe candles. The stop reference must already be below BUY entry or above SELL entry before an ATR buffer is applied.
- FVG/IFVG stops use their recorded structural invalidation wick/zone with a 0.20 closed-M15 ATR buffer and preserve a 2R target. A wrong-side reference is `INVALIDATED`; the buffer must not manufacture valid risk.
- “Next open” means the first live M1 open after database detection (with causal M15 fallback), never a historical open after the signal close.
- Activation is saved with `entry_locked`, entry timestamp, source timestamp, and lifecycle sequence. SL/BE/TP evaluation begins in a later engine run and only considers closed candles at or after entry.
- Setup ID is the identity boundary. Optimistic writes require the expected `updated_at` and status, and terminal states cannot regress because of a late API response.
- Validation for this change is syntax, deterministic fixtures, regression, Android gates, and manual device review. Backtesting remains explicitly out of scope.

## 2026-07-29

### Causal Entry Watch 2021–2022 Correctness Contract
- An eligible opposing sweep must be confirmed on a closed candle at or after Direction Forecast start; an MSS must be a later displaced closed-candle break.
- Dealing Location uses a confirmed paired structural leg built from consecutive opposite slow pivots. Consecutive same-kind pivots compress to the more structural extreme.
- Dealing Location's hard-gate reference is the sweep level. POI location, MSS-entry location, and MSS close strength remain separate diagnostics.
- BUY remains valid only at sweep position `<= 0.60`; SELL remains valid only at `>= 0.40`. These thresholds may not be tuned to create setups.
- Live analysis time defaults to the current clock. Replay time must be explicit or derive from the last closed candle; an open future candle cannot provide replay time.
- `entryMap.setup` is authoritative for terminal lifecycle state even when `activeSetup` is null. Terminal states must remain `SL HIT`, `TP1 HIT / BE`, `TP2 HIT`, `TP1 / BE`, or `EXPIRED`.
- Structural target diagnosis distinguishes no target, below 2R, above 8R, risk above 6 ATR, and valid 2R–8R without changing entry geometry or target thresholds.
- The 2021–2022 final validation remains at zero M5/M15 setups because `SESSION` is the next cumulative blocker. Session rules must not be loosened from this result.

### Rencana Eksekusi Read-Only Contract
- Rencana Eksekusi is a presentation consumer, not a strategy or analysis engine. Its setup priority is `setupExecution` → `entryMap.setup` → another authoritative runtime output only when the higher-priority source lacks that field.
- BUY/SELL is fail-closed and requires fresh Mapping data, an active aligned official direction, `entryWatch.entryAllowed === true`, a locked execution plan, the official closed-candle entry lifecycle (`ENTRY_ACTIVE` / `ENTRY CONFIRMED`, or the equivalent internal `ENTRY_TRIGGERED`), valid geometry, and official entry/SL/target levels.
- WAIT is mandatory for incomplete gates, official context conflict, stale/expired data, post-TP1 management, or terminal lifecycle. Non-executable and old levels remain hidden.
- Internal lifecycle names are never renamed or duplicated. UI labels only translate the existing Causal Entry Watch status.
- The feature does not read forming candles, call a market API, create polling, calculate indicators, recalculate RR, or mutate Mapping/Entry Watch objects. It refreshes from existing Mapping, Entry Watch, candle, and market-state events with a content fingerprint.
- Amy Bot receives the same structured `execution_plan` Context Envelope as the card and uses a deterministic read-only answer path before other market-answer paths. It may explain but cannot reverse the decision or create levels.
- In Analyze, Rencana Eksekusi is immediately followed by Penjelasan Mapping; dynamic Asia Liquidity is anchored after Penjelasan Mapping. This is presentation-only and does not change Asia session calculation or WITA timing.

## 2026-07-28

### Mapping Accuracy V3
- This section supersedes the 2026-07-11 decision that restricted actionable entries to M15.
- Causal Entry Map is supported on M1, M5, M15, M30, H1, H4, D1, and W1. Source and trigger are the selected timeframe; each profile has an explicit context, session, sweep-memory, and bar-expiry contract.
- The required causal order is active Direction Forecast → point-in-time context alignment → local EMA21/34/90 stack → opposing confirmed liquidity sweep → later displaced MSS → location/session filters → first still-available structural target at 2R–8R.
- M5 entry context follows the trusted indicator's default H4 bias. Every context gate uses only the latest context candle closed by the trigger close; later HTF candles cannot validate an earlier trigger.
- H1 entry close must remain within 2.00 ATR of EMA21.
- Entry is the closed MSS candle close, SL is beyond the protected swing plus 0.50 ATR, TP1 is 1R, and the runner moves to break-even toward the first structural target.
- H1 bearish forecast remains suppressed and must return `NO CLEAR DIRECTION`, matching the trusted reference.
- M1, M30, H4, D1, and W1 profiles are rule-based/manual-validation profiles and may not display a win-probability claim.
- `AMY_MAPPING_SINGLE_AUTHORITY_V3` is the read-only UI contract. Live price is provisional and cannot rewrite closed-candle facts or lifecycle.
- Weak structure close-crosses are candidates only. Confirmed breaks require ATR penetration, minimum body, and body/range quality.
- Liquidity first interaction is irreversible and distinguishes closed-through, unconfirmed sweep, and confirmed reaction.
- FVG/OB inversion requires accepted break (three closes plus continuation), retest, and inverse rejection.
- Previous-period liquidity is unavailable until its source period closes. W1 candle closure is anchored to Monday UTC.
- Validation for this change is regression/syntax/build plus user-performed manual chart validation; no backtest is run.

## 2026-07-11

### Mapping Production Logic
- Liquidity state is historical and irreversible within the loaded candle set: once a post-origin candle sweeps a level, that level cannot return to ACTIVE.
- Structure displacement uses point-in-time ATR from candles available before the breakout.
- Valid liquidity sweeps require both wick penetration and a close back inside the swept range.
- Minimum accepted setup RR is 1:2; lower RR is a fatal conflict and INVALID.
- HTF structure owns directional bias; Premium/Discount is an alignment filter, not a standalone direction signal.
- Silver Bullet takes precedence over the broader New York Killzone during 10:00–11:00 New York time.
- Actionable setup generation is restricted to M15 Precision Mode; other timeframes remain analysis context only.
- M15 Precision Mode secures TP1 at 1R, closes 90%, moves the 10% runner stop to break-even, and retains a main target of at least 2R.
- Native Background Scanner receives targets only from an active `M15_PRECISION` setup.

### Institutional Intelligence UI
- Market Intel and Mapping share a local `AmyFXIntel` snapshot/event layer.
- The shared layer is presentation-only and does not replace or modify the ICT rules engine.
- Market briefing remains deterministic and rule-based; it must not be presented as AI or an execution signal.
- Market Intel requests are cancellable per panel and pause while the WebView is hidden.

### Mapping Render Performance
- Live price ticks update targeted DOM nodes instead of fully rebuilding the Analyze view.
- Connection and scanner synchronization use explicit selectors; full-document scanning is not allowed in the recurring one-second task.

### Market Context Accuracy
- FVG quality must use ATR from the candle history available when the imbalance formed.
- Liquidity clustering and sweep penetration use ATR-scaled tolerance instead of fixed XAU price distances.
- An Order Block is only eligible when it precedes a confirmed displaced structure break; an accompanying imbalance improves quality.
- HTF dealing ranges are anchored to confirmed structural swings and may not be inferred from the nearest level around live price alone.
- Standalone BOS/CHOCH and displacement are context, not executable entry triggers.

### Notification Destinations
- News notifications carry the Telegram post ID in the URL and must open, expand, and focus that exact item.
- Telegram post ID is the authoritative newest-first ordering key; timestamp is secondary display metadata.
- Native notifications without an explicit URL resolve to an explicit local `index.html` destination based on their module.

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
