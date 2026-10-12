# Bug History

## 2026-09-30 — Pro381 Market Intel Baseline 11 Bugs Hardening

1. **Bug 1 (Kompas without data hardcoded SELL ON RALLY & connection badge)**:
   - *Fix*: If calendar events/USD data are missing or empty, bias outputs `⚪ Belum Cukup Data Fundamental Baru`, conclusion `⚪ BELUM CUKUP DATA`, and badge `🔴 Kalender Belum Terhubung`.
2. **Bug 2 (Analysis ignored Actual)**:
   - *Fix*: `analyzeMacroEvent` checks `isReleased && aVal !== null`, evaluating Actual vs Forecast surprise according to indicator category (claims, CPI/inflation, NFP/labor, PMI).
3. **Bug 3 (Calendar stale cache showed as synchronized)**:
   - *Fix*: Distinguishes `isCalendarLive` (`🟢 Sinkronisasi Live`), fresh local cache < 24h (`🟡 Cache Lokal (Tersimpan)`), and stale cache > 24h (`🟠 Cache Usang (>24 Jam)`).
4. **Bug 4 (Telegram parser mixed text with ID/datetime of other posts)**:
   - *Fix*: Slice HTML strictly by boundary chunk (`postChunk = html.slice(current.index, nextIndex)`) in `api/news.js` and `supabase/functions/news-sync/handler.ts`.
5. **Bug 5 (Failed request wiped cached news DOM)**:
   - *Fix*: In `loadNews` catch block, if `list.children.length > 0`, cached news is retained and status reports `Gagal sinkronisasi feed baru • Menampilkan berita tersimpan`.
6. **Bug 6 (Calendar hung indefinitely without client timeout)**:
   - *Fix*: Added 4000ms `AbortController` timeout per endpoint in `loadCalendar()`, with retry button on complete failure.
7. **Bug 7 (Deep link outside latest 20 items failed)**:
   - *Fix*: `fetchLimit` expands to 50 items when `pendingNewsId` is present.
8. **Bug 8 (Irrelevant news triggered Gold notification)**:
   - *Fix*: Removed broad pronoun `'us'` from `GEOPOLITICAL_ACTORS` in `lib/news-relevance.mjs`. Added client guard `isNewsRelevantForGold(latestNews)` before triggering Android/Web notifications.
9. **Bug 9 (Old translation request overwrote fresh feed cache)**:
   - *Fix*: Guarded async translation callbacks with monotonic sequence counter `newsFetchSequence`.
10. **Bug 10 (Fallback translation truncated 500 chars and saved as final)**:
    - *Fix*: `translateTextClient` splits text into sentence chunks ≤ 450 chars for MyMemory API. `saveTranslationToCache` rejects truncated strings ending with `…`.
11. **Bug 11 (Forecast and dynamic values injected into innerHTML without escaping)**:
    - *Fix*: All dynamic values (`forecast`, `previous`, `actual`, `title`, `conclusionGuide`, etc.) wrapped with `escapeHtml()`.

## 2026-09-30 — Pro374 Mapping audit fixes

Fixed seven Mapping audit findings: offline/cache authority, unsupported driver triggers/WR, false A+ badge, gap-spanning FVG/confirmation, stale calendar SAFE, shared opposite-side invalidation, and fabricated notification TP. Added executable DOM/engine regressions; also prevent cached startup heartbeat invention and give NEWS_LOCK narration priority.

## 2026-09-24 — Pro362 Kalender Ekonomi Kosong Akibat Blokir CORS di Android WebView

- **Symptoms**: Tab Kalender Ekonomi pada Market Intel menampilkan pesan kosong:
  `Data kalender belum tersedia.`
  `Tidak ada jadwal kalender ekonomi tersedia saat ini.`
- **Root Cause**: Feed Forex Factory `https://nfs.faireconomy.media/ff_calendar_thisweek.json` disajikan oleh Cloudflare CDN tanpa header `Access-Control-Allow-Origin: *`. Akibatnya, `fetch()` dari Android WebView diblokir oleh kebijakan CORS browser dan melempar `TypeError: Failed to fetch`.
- **Resolution**:
  1. Membuat dan mendeploy Supabase Edge Function `economic-calendar` (`supabase/functions/economic-calendar/index.ts`) yang mengambil feed Forex Factory dan mengembalikannya dengan header CORS `Access-Control-Allow-Origin: *`.
  2. Menambahkan serverless endpoint fallback `api/calendar.js` di Vercel.
  3. Memperbarui `loadCalendar()` di `app.js` dengan multi-endpoint fallback chain (`CALENDAR_ENDPOINTS`): Supabase proxy → Vercel proxy → AllOrigins CORS proxy → direct fetch.
  4. Memperbarui cache-first render agar saat data sudah pernah tersimpan, langsung muncul instan tanpa jeda loading.
  5. Bump versi ke `2.0.0-pro.362` (`950362`), lulus CI workflow Run `36018003253`, dan `update.json` teraktivasi.

## 2026-09-24 — Pro359 Dashboard Gold Kosong Akibat Timeout Kesegaran M1

- **Symptoms**: Layar Mapping Gold XAU/USD menampilkan `WAIT · data belum siap` dan `KONTEKS BELUM TERSEDIA / Evaluasi server belum lengkap atau candle tertutup sudah terlambat` dengan semua kartu bernilai strip (`—`) meskipun app version sudah di-bump 2 kali.
- **Root Cause**: Feed data market provider memperbarui candle tertutup dengan jeda batch 3–5 menit (180–300 detik). Logika `buildMarketContext` dan `context-model.js` menerapkan pengecekan ketat `now - source.M1 <= 180`, sehingga data hampir selalu dinilai basi (`fresh: false`) dan memicu fallback `empty()`.
- **Resolution**:
  1. Mengganti timeframe konfirmasi dari M1 ke M5 di `supabase/functions/scalper-engine/market-context.mjs` dan `index.ts`.
  2. Memperluas toleransi kesegaran M5 menjadi 900 detik (15 menit) di backend dan client `context-model.js`.
  3. Memperbarui `scalper-system-push` agar tidak mendrop event push M5 yang valid.
  4. Memperbarui kartu UI Mapping (`context-panel.js` dan `index.html`) menjadi `M5 · KONFIRMASI`.
  5. Seluruh 137 test suites lulus dan data langsung tampil terisi (`fresh: true`).

## 2026-09-24 — Pro357 PR signing checks used a retired certificate

- Cause: the Learning Preview and archived 1.5.8 workflows gated every Pro pull request on the expired `amy-fx-debug-keystore-v1` cache and old `47:C2:…:AD:C7` certificate. The active Pro workflow could also prefer that old signer if its cache reappeared and did not pin the current Pro cache certificate.
- Fix: legacy jobs now run only for their own branches, while the active Pro release restores only `amy-fx-pro-signing-key-v1` (or the durable Pro keystore secret), pins the verified Pro350 certificate `97:E0:…:02:32`, and fails instead of generating or accepting another identity.

## 2026-09-20 — Pro351 Replay history and mobile density

- Terminal Replay records created before outcome evidence existed were skipped because only OPEN records were evaluated. Matching records now reconstruct deterministic SL/TP candle evidence without losing the stored terminal result on rewind.
- Successful IndexedDB deletion left an older localStorage fallback copy able to reappear. Deletion now clears both stores.
- Academy resume history could render on nested Trading Practice index pages. It is now scoped to the Academy/Belajar Trading home.
- Mapping Analyze exposed secondary liquidity/rule text at full length. Primary evidence remains visible; secondary detail is collapsed and liquidity is limited to the six nearest levels.

## 2026-09-20 — Pro350 Replay history

Pro349 still navigated Replay history to the shared page and rendered no history on Replay itself. Added immediate/reloadable inline history with entry/SL/TP and candle evidence. Fixed stale IndexedDB overriding a newer fallback outcome, asynchronous save cursor drift, and reevaluation of candles before a previously persisted entry fill. Existing records and terminal outcomes remain intact. Validation: all 136 JavaScript regression files pass, including executable save/reload/rewind, BUY/SELL SL/TP, ambiguous candle, cross-timeframe, storage reconciliation and cursor-race cases.

## 2026-09-20 — Candle Replay notes could disappear and SL/TP lacked evidence

- Resolved: a trade written to localStorage fallback could be hidden when later IndexedDB reads succeeded but did not contain that record.
- Resolved: terminal replay history exposed only WIN/LOSS without the candle time, touched level, candle range, or ambiguous-candle rule.
- Fix: merge fallback trades into successful IndexedDB reads and persist explicit SL/TP outcome evidence. Same-candle SL/TP remains conservatively resolved as SL.

## 2026-09-19 — Inconsistent module UI and cramped mobile layouts

- Resolved: Mapping used the `amyfx-module--ict` body class but omitted the `amyfx-module--mapping` design-system hook, so shared Mapping presentation rules did not apply.
- Resolved: module-specific typography, spacing, card surfaces, and mobile grids produced uneven hierarchy and weak light-theme readability.
- Fix: add a UI-only shared polish layer after the component stylesheet and apply responsive, semantic-token overrides without changing JavaScript or trading logic.

## 2026-09-19 — Market Intel source leakage and light-theme contrast

- Resolved: news cards linked users to Telegram and displayed provider branding.
- Resolved: Market Intel redefined legacy dark-only colors after shared theme tokens, causing weak or invisible light-theme content.
- Fix: sanitize app-facing news, remove outbound source links, and bind Market Intel primitives to shared semantic theme variables.

## 2026-09-17 — Pro345 preparation
Pro345 branch: direct on-chart × Hapus reuses deleteSelected, preserves other objects/storage/Undo and hides during gestures. Home light CSS adds legacy-surface/text overrides. Earlier broad root-cause claim is unconfirmed: shared components already override many home surfaces; no browser/device reproduction of reported home symptom. Browser bootstrap failed on filesystem hardlink permission. Targeted 28 tests pass (chart/fullscreen/version/static CSS contrast), not Android visual verification.

## Drawing fixes — branch publication authorized
Amy authorized pushing Long/Short validation/labels and Object-menu close, without version bump. Publish on fix/replay-gesture-menu only; do not merge main or replace released Pro344 APK. This supersedes earlier no-push notes for these two fixes. Android visual verification remains pending.


## Object menu close — local only
Added × Tutup button reusing sticky drawing-menu-close style; closes native details and restores summary focus without changing drawings/fullscreen. Seven targeted menu/fullscreen tests pass. Not pushed, no version bump; Android visual check pending.


## Long/Short drawing local fix
Local unpushed Long/Short fix: signed risk/reward validation; invalid creation and drag rejected; legacy invalid drawings retained with neutral fill and INVALID label; labels spaced.29 focused tests and all131 JS files pass. Still three-point entry/TP/SL interaction, not TradingView parity; device visual validation pending. No bump/commit/push authorized for this batch.


## 2026-09-17 — Pro344 replay fix
Confirmed stale drawing gesture blocked new timeframe candles. Invalid pointerup now cancels safely; pointerup completion flushes queued updates even for first taps/short paths. Added executable regressions. All131 JS test files pass;19 focused tests pass. Android visual verification pending.


## 2026-09-17 — Pro343 verification

Preserved the tested adjacent version/app/updater script sequence after regression exposed the insertion conflict. Shared chart now fits first nonempty data after timeframe reset/offline recovery. Full130-file regression passes. Browser private-address block prevented visual validation.


## 2026-09-13 — Pro339 Market Intel client-side auto-translation with local cache

- Cause: Google blocked unofficial serverless/cloud requests to `translate.googleapis.com` (HTTP 429/CAPTCHA), causing server-side translations to fail and fallback to English text.
- Fix: Added resilient client-side auto-translation in `app/src/main/assets/apps/market-intel/app.js` using the client's residential/cellular IP, backed by MyMemory free fallback and offline `localStorage` cache (`amy_news_tr_cache_v1`).
- Version: Bumped version to `2.0.0-pro.339` / `950339` to trigger native in-app updater notification.

## 2026-09-08 — Pro330 news translation bypass (local repair, not deployed)

- GitHub commit 28661ed9 added central-feed translation normalization; f5678597 removed it. Latest fetched origin/main f0e4f244 has no subsequent api/news.js repair.
- Live public Supabase news-feed returned English text equal to textOriginal. Vercel handler previously returned that payload without calling its translator.
- Local api/news.js now normalizes missing/equal/placeholder translations on the central path, preserves originals and metadata without mutating upstream items, and retries failed items on a later request. Telegram fallback keeps its existing behavior and shares the unavailable message.
- Added deterministic handler regression for missing originals, empty text, whitespace, existing translation, placeholder retry, HTTP429, network errors, malformed response, unchanged English and recovery. Corrected an already-stale news-relevance regression import expectation to the current bundled ./news-relevance.mjs path.
- Verification: 23 focused routing/relevance tests pass; node --check and git diff --check pass. Live local handler returned HTTP200/backend=supabase with the unavailable message; direct Google translation returned HTTP429. Successful live translation is NOT verified, and provider throttling remains unresolved. No push, deployment, APK build, or database writes performed.

## Trading Practice horizontal zoom failed and drawings drifted from chart scale
- **Date:** 2026-08-17
- **Severity:** High
- **Cause:** Select/Edit gave the full SVG overlay pointer ownership, blocking blank-chart gestures. Drawing redraws listened only to visible time-range changes, which can remain unchanged when clamped edges keep the same timestamps while logical bar spacing changes; price-scale gestures also had no redraw signal.
- **Fix:** Explicitly enabled Lightweight Charts pinch and time-axis scaling, passed blank Select/Edit space through to the chart while retaining painted-object/handle hit targets, subscribed to logical-range and pane-size changes, and coalesced wheel/pointer/touch redraws from persistent TIME + PRICE anchors.
- **Validation:** Eight focused chart tests prove horizontal and vertical coordinate synchronization, immutable drawing anchors, native gesture configuration, and drawing-only pointer ownership. All 119 application regression files pass locally.
- **Release:** Resolved in active signed release `2.0.0-pro.326` / `950326`; Android CI, identity, signer continuity, release asset, checksum, and published endpoint verification all pass.

## Trading Practice drawings ignored touch and text editor could be clipped
- **Date:** 2026-08-17
- **Severity:** High
- **Cause:** Saving a drawing immediately called `setTool(null)`, disabling pointer events on the SVG overlay. Selection then depended on narrow geometric tolerances, while the annotation form was absolutely positioned inside an overflow-clipped chart shell.
- **Fix:** Finished drawings now switch directly to Select/Edit with the new object selected; rendered SVG ownership, 28px invisible line/path hit strokes, and 36px handle targets make mobile selection and dragging reliable. Text/Note/Price Note use a fixed dialog attached outside the chart shell.
- **Validation:** Seven focused chart tests cover automatic selection, painted-target selection, TIME + PRICE drag persistence, visible text submission, touch target sizing, and render/select behavior for every supported tool. All 119 application regression files pass locally.
- **Release:** First resolved in signed `.325`; current active `.326` preserves the repair and passes the same identity, signer, asset, checksum, and endpoint gates.

## Trading Practice scale, decision persistence, and Live continuity
- **Date:** 2026-08-17
- **Severity:** High
- **Cause:** The right scale had no minimum width/whole-label guarantee inside an overflow-clipped shell; Live replaced the selected pack with a separate native buffer; IndexedDB writes reported success before transaction commit; and the legacy drawing layer supported only three primitives without selection/editing.
- **Fix:** Reserved an 84–92px responsive price axis and kept overlays inside the plot, merged the immutable selected pack into Live with ordered timestamp upsert/deduplication, verified decision retrieval only after commit, and added a persistent editable TIME + PRICE drawing model.
- **Release:** Resolved in active signed release `2.0.0-pro.324` / `950324` after full CI identity, signer, asset, checksum, and endpoint verification.

## Fixed Competing Mapping Authorities and Live Recompute Paths — 2026-08-11

### Legacy Router and UI Layers Could Reinterpret or Replace Direction
- **Severity:** Critical
- **Cause:** The old pipeline combined validated-context evaluation, regime/strategy routing, cross-timeframe voting, UI reconciliation, Entry Watch mutation, and Scalper bridges. Several layers could derive or rewrite directional fields after the core analysis, leaving more than one effective Mapping authority.
- **Fix:** `Amy-SMC-D` replay now produces the canonical immutable Mapping contract. Router compatibility is explicitly execution-consumer-only, Mapping Snapshot projects D fields, and Entry/Scalper/zone/UI adapters cannot overwrite D direction.

### Mapping Could Be Coupled to Live Price or Recurring Render Work
- **Severity:** Critical
- **Cause:** Legacy reconciliation and runtime timers listened to live market events or polled frequently, allowing price-facing updates to republish Mapping state and rebuild the view even without a new closed candle.
- **Fix:** Twelve Data WebSocket ticks now update targeted price/status elements only. Mapping replay runs only from the REST closed-candle analysis path; Mapping UI and adapter refreshes are event-driven and keyed by the closed source candle.

### Stale Provider State Could Hide a Valid Last Mapping
- **Severity:** High
- **Cause:** Freshness/integrity layers could clear or replace the full Mapping when REST refresh failed, even though a previously analyzed closed candle remained valid.
- **Fix:** Freshness remains an internal quality signal, while the last valid D result and its source timestamp remain visible until a newer valid closed candle is available.

### H1 Dealing Range Could Admit the Current Candle or the Wrong Source
- **Severity:** Critical
- **Cause:** The previous engine did not implement the finalized D H1 previous-240 contract as the sole H1 range source, and generic location/context logic risked contaminating the descriptive field.
- **Fix:** H1 range is calculated from exactly the prior 240 normalized closed H1 candles; current H1 is excluded. M5/M15 keep their structural sources, and all three pure-location outputs are dependency-isolated from predictors.

## Fixed Preview Duplicate News Delivery — 2026-08-01

### One News Event Could Produce Two or Three Notifications
- **Severity:** High
- **Cause:** Preview devices received the data-only push from `news-sync`, the second system notification from `news-system-push`, and could also receive the local WorkManager fallback for the same news item.
- **Fix:** Preview devices now use one dedicated system-notification route. A canonical event key, atomic delivery ledger, retry state, and scheduler lease enforce one successful delivery per event/device; the upstream legacy data route excludes Preview so the unchanged public system route receives no Preview pairs, and Preview cancels its old local fallback.
- **Validation:** Source regression covers routing, ledger/RPC markers, Preview device isolation, and local fallback cancellation; deployed health and database state must be checked before release.

## Fixed Pattern-v3 TP1 UI Refresh — 2026-08-01

### TP1 Could Be Reached Without Refreshing the Active Card
- **Severity:** High
- **Cause:** Pattern-v3 deliberately keeps lifecycle status `ACTIVE` after TP1 because Stop Loss does not move to breakeven, while the Mapping render signature did not include `tp1Hit` or lifecycle sequence.
- **Fix:** Scalper payload and execution-authority signatures now include TP1 progress and pattern metadata, so the UI immediately changes to `TP1 HIT · SL TETAP` without changing the lifecycle status.
- **Validation:** Deterministic regression verifies that otherwise-identical ACTIVE payloads produce different signatures when TP1 progress changes.

## Fixed Private Preview Frozen Live Price — 2026-07-31

### XAU/USD Price Stopped Refreshing Automatically
- **Severity:** Critical
- **Cause:** Preview 293/294 had replaced the intended Twelve Data WebSocket quote stream with a 20-second REST request to the shared Mapping proxy. The display therefore depended on REST freshness/cache and consumed daily API credits while the account showed no WebSocket connection.
- **Fix:** Preview 295 restores one native Android WebSocket subscription for XAU/USD, validates provider timestamps, and reconnects after network, foreground, socket, or stalled-tick failures. The key remains outside WebView storage. Mapping candles retain their existing REST/Vercel path unchanged.
- **Validation:** JavaScript syntax checks, focused live-price/security/Preview identity tests, and all 92 JavaScript regression files passed. Android compile, lint, signing, and APK identity remain mandatory release-workflow gates.

## Fixed Preview Mapping Stability and Scalper Shadow Defects — 2026-07-30

### Mapping Root Render Flicker and Scroll Jumps
- **Severity:** High
- **Cause:** Ordinary refresh paths repeatedly assigned the complete `#app` markup, republished unchanged Mapping snapshots, and let presentation observers move panels after the canonical renderer had placed them.
- **Fix:** Mapping now skips equal state signatures, patches keyed DOM nodes in place, preserves disclosure state by stable key, aborts superseded analysis requests, and keeps Dashboard/Analyze source order identical to observer order. Background refresh does not force scroll.

### Scalper Shadow Panel Disappeared During Refresh
- **Severity:** High
- **Cause:** The panel was created only by the polling runtime, while a later Mapping root render removed it; each response then replaced the panel with `outerHTML`.
- **Fix:** Dashboard and Analyze own one permanent keyed shell. Polling patches only its content, keeps the last valid payload through transient failures, and rejects late or lifecycle-regressive state for the same setup ID.

### Mapping Header Leaked Status Text and a Second Dot
- **Severity:** Medium
- **Cause:** Connection, clock, consistency, and integrity runtimes all wrote different strings into `#conn`; the generic online pseudo-element rendered an additional dot.
- **Fix:** Every Mapping header writer restores exactly `●`; freshness is represented by color/data attributes. The 18×18 container is fixed, pseudo-elements are disabled, and obsolete top-header time fields are empty and hidden.

### Scalper Shadow Stop Evaluated Before a Causal Entry
- **Severity:** Critical
- **Cause:** A historical candle could be selected as “next open,” activation and stop evaluation could occur in one engine run, and an IFVG stop reference could sit on the wrong side of entry with only a minimal ATR buffer.
- **Fix:** Entry starts at the first live open after detection, is persisted with an entry lock before lifecycle evaluation, and ignores closed-candle highs/lows before the entry timestamp. Stops use the setup candle’s closed M15 structural invalidation wick/zone plus a 0.20 ATR buffer; wrong-side structural references invalidate instead of being rescued by the buffer. Optimistic status/timestamp writes prevent late runs from reversing newer lifecycle state.
- **Validation:** Deterministic fixtures and regression tests only; no backtest was run.

## Fixed Causal Entry Watch Replay Defects — 2026-07-29

### Terminal Setup State Was Dropped
- **Severity:** High
- **Cause:** Consumers projected only `activeSetup`, so a terminal authoritative `entryMap.setup` disappeared before setup execution, Entry Watch, scanner, and notification handling.
- **Fix:** Added a shared lifecycle contract and preserved the authoritative setup through every consumer without changing lifecycle formulas or evaluation order.

### Replay Session Used Wall Clock
- **Severity:** High
- **Cause:** Core Mapping analysis called `Date.now()` directly, so historical replay could display current session context. This affected Mapping Engine replay, not only the external audit harness.
- **Fix:** Live mode still uses the wall clock; replay accepts an explicit timestamp or the last closed candle timestamp and ignores an open future candle.

### Pre-Forecast Sweep Entered Causal Sequence
- **Severity:** Critical
- **Cause:** Sweep memory did not require the selected sweep to occur after Direction Forecast activation.
- **Fix:** Eligible sweep index must be at least forecast start; displaced MSS must remain later than the sweep and no later than the latest closed candle.

### Dealing Location Mixed Unpaired Swings and Breakout Close
- **Severity:** Critical
- **Cause:** The latest slow high and slow low could come from different legs, while MSS breakout close was used as the sole dealing-location reference. This made M5 fail every historical Dealing Location evaluation.
- **Fix:** Build a confirmed paired zigzag leg and gate on sweep position while recording POI, entry, and MSS close strength separately. Thresholds remain unchanged.

### Structural Target Diagnosis Hid Risk Rejection
- **Severity:** Medium
- **Cause:** A geometrically valid target could be labeled target-pass even when risk exceeded the unchanged 6 ATR cap.
- **Fix:** Diagnosis now reports `RISK > 6 ATR` separately from the four target-location outcomes.

## Fixed Mapping Accuracy V3 Defects — 2026-07-28

### Multiple Mapping State Writers
- **Severity:** Critical
- **Cause:** Entry Watch, integrity, and runtime repair layers could clear or replace `bestSetup`, `setups`, and result state after the concept engine finished.
- **Fix:** One causal engine owns the result and frozen Mapping snapshot; Entry Watch and repair layers are read-only/UI-only consumers.

### Mirrored H1 Bearish Forecast
- **Severity:** High
- **Cause:** A balanced compatibility fork re-enabled H1 bearish behavior that the trusted reference deliberately suppresses.
- **Fix:** The compatibility module delegates to the canonical forecast; H1 bearish always returns `NO CLEAR DIRECTION`.

### Weak Close-Cross Changed Structure
- **Severity:** High
- **Cause:** Any close beyond a swing could be treated as BOS/MSS and flip the structure.
- **Fix:** Weak events remain `BREAK_CANDIDATE`; trend changes require 0.10 ATR penetration, 0.30 ATR body, and 0.45 body/range.

### Liquidity Self-Cancel and Reactivation
- **Severity:** High
- **Cause:** One interaction could be interpreted as both sweep and invalidation, and current-price evaluation could later reactivate it.
- **Fix:** First interaction is irreversible and classified as `CLOSED_THROUGH`, `SWEPT_UNCONFIRMED`, or `CONFIRMED_REACTION`.

### Premature Zone Inversion
- **Severity:** High
- **Cause:** Wick mitigation or a single close could create IFVG/Breaker state.
- **Fix:** Conversion requires three outside closes, 0.30 ATR continuation, a later retest, and inverse rejection.

### Future Previous-Period Liquidity
- **Severity:** Critical
- **Cause:** Latest PDH/PDL/PWH/PWL used `availableIndex: 0`, allowing a historical trigger to see a level before its source period closed.
- **Fix:** Availability is the first candle at or after the source-period close.

### Entry Trigger Missed Trusted Trend Gates
- **Severity:** Critical
- **Cause:** The rebuilt sequence initially relied on Direction Forecast plus local structure without independently checking the trusted entry-time H4 bias, EMA21/34/90 stack, or H1 EMA-distance limit.
- **Fix:** Entry now requires point-in-time context close/EMA20 slope alignment, a directional local EMA stack, and the reference H1 maximum distance of 2.00 ATR. Context candles closing after the trigger are excluded.

### W1 Thursday Epoch Drift
- **Severity:** High
- **Cause:** Generic Unix interval flooring anchored weekly closure to Thursday, which could lag or repeatedly refetch weekly candles.
- **Fix:** Server and client W1 closure boundaries use Monday 00:00 UTC.

### Terminal Entry Watch Kept Direction
- **Severity:** High
- **Cause:** A terminal scenario could keep a BUY/SELL watch action visible.
- **Fix:** SL hit, TP2 hit, TP1/BE, and expiry always render action `WAIT`.

### Stale WITA Soft-Render Selectors
- **Severity:** Medium
- **Cause:** Soft live rendering still queried old `top-wib`/`kz-wib` IDs.
- **Fix:** It now updates `top-wita` and `kz-wita` consistently.

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

## 2026-09-05 — Jalur 03 Replay Entry Save

- Fixed Candle Replay submit accessing `event.currentTarget` after awaiting storage. Browser event dispatch clears this property, causing entry saving and the final button reset to fail.
- Capture the form synchronously and retain it through save, duplicate-decision handling, and error recovery.
- Validation: 24 Trading Practice tests pass, including new, already-locked, and failed-storage submits with a cleared event target; JavaScript syntax and diff whitespace checks pass.


## 2026-09-05 — Pro328

Pro328: isolated per-device scan/recommendation/notification paths; enabled drivers skipped before detectors. Discipline retest cannot fill historical candles before setup creation and resolves same-bar SL/TP conservatively. Drawing drag final pointer position and cancellation preserve persisted objects. Focused engine/drawing/API regression checks passed (50 checks). Full local suite stopped at missing files in partial checkout; CI performs the complete suite. No profitability backtest added or thresholds tuned.

Release gate resolved: the old parity assertion still counted 10 base methods; updated to 11 with an explicit Discipline presence assertion. Complete CI suite passed after this correction. Existing FCM destination and payload were verified unchanged; recipient restriction deployment then succeeded.


## 2026-09-06 — Pro329

Pro329 source fix: coordinateToTime returned null beyond available candles, and drawing timestamps were clamped to replay cursor, preventing extension/drawing in empty chart space. Added logical-coordinate projection, rectangle corner/edge handles, tap selection and repeat drawing mode. Translation failures previously returned the source text, which was persisted as Indonesian and never retried. Sync now retries public Telegram posts in rotating batches and stores an empty translation on failure. No tests/backtests or post-change verification performed, per user request.


## 2026-09-09 — Pro332

Pro332 fixes fixed fullscreen being trapped by the Academy fadeInUp transform, overflowing object controls, fallback cancellation on unrelated fullscreen events, and annotation editors hidden behind fullscreen. Four focused fullscreen state tests pass; existing 122-file regression suite passes. Browser rendering could not be checked locally because no browser executable is installed and download timed out.


Pro332 release completed: GitHub Actions run 34301702033 succeeded, including JavaScript regression, Android unit/lint/build, signing identity and published endpoint verification. Active public update.json is 2.0.0-pro.332 / 950332, enabled=true. Published APK SHA-256 62bd08b231bef85e768af95b50540ecfe3e0d6b3e71a77dbc670da18f4e297f1 matches the release asset digest. Earlier build/activation pending status is resolved. Actual device notification and WebView visual checks remain unobserved.
# 2026-09-09 — Pro333 Candle Replay fullscreen height and mobile overflow

- **Cause:** Fullscreen changed `.practice-layout` to flex but retained the base `align-items: start`; the chart column therefore used only intrinsic content height and the absolutely positioned chart collapsed to zero height.
- **Fix:** Fullscreen now stretches the chart column through the available viewport height. Mobile drawing actions wrap, and the object popover is bounded to the workspace viewport with border-box sizing.
- **Scope:** Presentation/layout only. Replay state, candle data, drawings, and trading calculations are unchanged.


## 2026-09-09 — Pro334 server-owned live price

Pro334 source fixes device-key dependency, backward/stale tick acceptance, UTC parsing and synthetic sentinel ingestion. Candle proxy disables CDN stale serving, bounds memory TTL at candle close + grace, and avoids caching stale Edge fallback as fresh. A degraded Edge response attempts the configured Vercel provider before preserving fallback. Targeted checks only; real-device/deployed stream still needs observation.


## 2026-09-09 — Pro334 release gate correction

Release run 34341434298 stopped before APK creation because api-polling-coordinator.test.mjs still required the removed CDN stale cache policy. Updated that regression to require no-store on all three cache headers and bounded candle-close memory TTL; the targeted test file passes 11 checks. Keep published manifest333 until signed release succeeds.



## 2026-09-09 — Pro335 replay navigation

Pro335 fixes full-data replacement during forward replay, viewport displacement on rewind, drawing interception in gesture mode, competing secondary pointer edits, late seek responses and playback continuing at the final bar. Data changes wait for active object gestures to complete. Focused chart/fullscreen/replay regression tests pass; Android device touch behavior remains unobserved.


## 2026-09-09 — Replay downward swipe triggers native refresh

The Pro335 device screenshot exposes the native SwipeRefreshLayout spinner. CSS touch-action cannot stop Android parent interception; updatePermissionGate also re-enabled refresh on resume. Pro336 adds a native exact-route policy, pre-navigation/page-start disable, child-scroll interception guard, reload callback guard and resume-safe restoration. Kotlin tests cover replay routes, queries/fragments, normal-page restoration and malformed URLs. Android CI owns compilation and test execution; device verification remains pending. No trading backtest.

## 2026-09-12 — Pro337 Mapping replacement

Removed legacy analysis/repair stack from the production Mapping entry. New model
rejects conflicting duplicates, future/open/synthetic data and stale source decisions.
Gaps retire liquidity and cancel uncertain simulations; ambiguous fill/target bars
cannot manufacture wins. New deterministic positive BUY/SELL and rejection fixtures
pass. Browser preview blocked by ERR_BLOCKED_BY_CLIENT; no device visual claim.


## 2026-09-13 — Pro338 Academy

Fixed guided question/chart mismatch, correct-only progression and repeat-answer score masking. Each question now supplies matching OHLC and markers; wrong answers can advance and remain in the review. Autoscale includes SL/TP and zone references so supporting levels cannot fall outside the chart.


## 2026-09-13 — Pro340 local application assistant

Legacy mentor read obsolete Mapping contracts after the Pro337 replacement and several wrappers could replace the answer path. Replaced active mentor loading with a single local assistant, explicitly persisted the new Mapping snapshot for other pages, removed remote-provider fallback from public ask, and connected Academy dynamic loading. Guided summary now retains review lesson titles. News translation completion updates its assistant snapshot.


## 2026-09-13 — Pro341

- Fixed cold-start home TypeError: renderHome called quickCard(projects[4]) after the catalog was reduced to four modules. Home now maps actual entries and falls back from obsolete saved tabs. Regression executes startup while fetch never resolves.
- Fixed stale/divergent Berita hero and liquidity: the active Mapping uses amyfx.ict.mapping.v1 while Intel mounted legacy contract values and rewrote candle requests to another provider route. Active Intel now shares the ICT model/provider/snapshot and labels stale data; old responses cannot replace newer source candles.
- Local verification: all128 JavaScript regression files passed; eight targeted tests cover cold start, blocked storage, bands, freshness, snapshot parity, concurrent requests, failed/older data, and shared provider wiring. Browser installation failed (certificate validation in agent-browser; trusted Playwright download timed out), so visual/device verification is unobserved.


Pro341 release verified: PR #3 merged as 89f147daa947632da15a21da5bd5b7ee5e8a297f. Signed release workflow34788293012 and main lint34788292968 succeeded. All128 JS files, Android tests/lint/build, existing signer continuity and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.341 /950341; APK digest matches manifest SHA-256 8f59f72ecb22ed384c5c390ea20e9a1927cd3e17ad9910b9ee6b4fde80d7943c. Earlier Pro341 publication-pending notes are resolved. Browser/device appearance and native notification receipt remain unobserved. Internal validation was aligned from Node20 to the repository-required Node22 after its old runtime failed to import stripTypeScriptTypes. Legacy Learning Preview and1.5.8 PR checks lacked their old signing cache; Pro release used its existing signer and passed verification.


## 2026-09-14 — Pro342 Mapping restoration

Pro342 fixes the missing server Scalper setups on the replacement ICT page. It restores device-scoped BUY/SELL levels, pending/active/terminal status, history and preferences. Live inspection found latest server runs FAILED with Supabase504 Gateway Timeout; this pre-existing backend failure remains unresolved and is displayed fail-closed. Fresh HTTP timestamps never substitute for engine completion or per-setup evaluation.

## 2026-09-24 — Pro357 mapping awareness repair prepared

The previous active Scalper/Mapping path reported a BUY/SELL setup after sweep, MSS and FVG even when M15 already opposed H1. The new context engine reports H1 weakening plus M15 opposing control before M1 execution readiness, retains exact area/invalidation prices only when a valid POI exists, and prevents a swept liquidity level from becoming active again after price retraces. Old APKs interpret unknown FCM data payloads as news; the new push filter restricts market-context delivery to Pro357+ registrations. All 137 JavaScript regression files pass locally. The live functions still run the old implementation because automatic approval review rejected production deployment; no claim of live repair is made.


## 2026-09-19 — Pro346 scalper fixes
Replaced rolling-five-bar pseudo-BOS, immediate expansion chasing and Discipline EPSILON breakout stops; AMD/new limit fills start after persisted detection. Added first-touch invalidation, expiry, actual-entry RR checks, conservative limit-bar TP handling and adverse stop gaps. Preserved deployed SMR boolean-anchor fix missing from repository. Deterministic regression validation does not establish improved WR.


## 2026-09-30 — Pro375 integration corrections

Fixed newly created zones immediately testing their own formation candle; retests require later closed bars. LTF momentum/ATR do not bridge missing feed candles. Missing midnight/Asia coverage is UNAVAILABLE, never an arbitrary fallback. Historical scoring uses key levels available at each trigger close. DOL reached is latched for that sweep/target. Avoid undefined timeToCoordinate at the final killzone candle. Backend M1 loads paginate below PostgREST row caps. Offline removal also clears all new overlay layers and scoring tables.

## 2026-09-30 — Pro376 live-snapshot execution clarity

A real snapshot had M15 BUY bias while the independent SELL confluence score was higher. Explicitly mark that counter-bias score in state/narration; it cannot create A+. Execution invalidation and target geometry now compare against the latest closed M5 price instead of the older M15 close. Entry/dashboard/chart consume the same warning text.

Pro376 backend v24 additionally suppresses a primary target when the Dashboard DOL points against the primary side, is reached, or is on the wrong side of the latest M5 close. DOL remains visible as a separately labelled dashboard observation. Thirty deterministic replay seeds enforce that geometry.


## 2026-09-30 — Pro377 Mapping ringkas

User authorized a presentation-only simplification and version bump. Main Mapping shows market state, manual readiness/news, primary POI/CE/invalidation/target and chart. Full bias, narration, evidence, liquidity, conditions, alternatives and six reference models stay accessible in closed Detail accordions; opened driver/scenario details survive refresh. All46 display controls remain in four groups, stored preferences are preserved. Chart narration prioritizes risk warnings in two lines; repeated structural labels and overlapping text are suppressed without removing drawings or numerical logic. Canonical engine, backend, scoring, risk gates and notification policies are unchanged. Source2.0.0-pro.377/950377; signed CI owns manifest activation after publication. Local141 regression files and Chromium360/390 dark/light/menu/offline smoke passed; release verification pending.


Pro377 release verification completed: source dc1ff82e9f6bd0571bac754484654141212ebafc; signed Actions36701710390 and lint36701710388 succeeded. Public update.json is enabled at2.0.0-pro.377/950377. Downloaded32,667,949-byte APK SHA-2561998d6efe381114b230d393db90f0a675dc2b7b6263f10f12775941796e7ed76 matches manifest/checksum; all changed Mapping assets match APK and shared trading engine remains byte-identical to backend. Final141 regression files and Chromium360/390 dark/light/settings/driver-refresh/news-lock/offline smoke passed. Earlier Pro377 publication-pending note is resolved. Real Android update-notification receipt remains unobserved.


## 2026-09-30 — Pro378 Chart Gold fullscreen

Addressed the user screenshot showing small Chart Gold text in the constrained Mapping card. Fullscreen bypasses surrounding UI containers and gives the existing canvas the available viewport; resize/rotation repaint overlays without replacing chart data.


Pro378 release verification completed: source7d9b2d608e4fe6dbb6addb7063dd039401282beb, signed Actions36704449764 and lint36704449726 succeeded. Public update.json enabled at2.0.0-pro.378/950378. Downloaded32,670,025-byte APK SHA-256516d95d6fd9bcfec15985dc6b8cc354e51480265d8ab0689936dce1947ce91bf matches manifest/checksum; all fullscreen assets match source and canonical trading engine remains byte-identical to backend. Final141 regression files and Chromium portrait/landscape360/390/844px, pinch/pan/zoom/scroll/Back/Escape/fallback/theme/refresh/offline checks passed. Earlier Pro378 release-pending note resolved. Actual Android device behavior and update notification receipt remain unobserved.


## 2026-09-30 — Pro379 TradingView axis gestures

Reproduced Pro378 on touch: price-axis drag left autoScale=true because vertTouchDrag=false routes the movement to page scroll. Enabled native axis touch; fixed price-only overlay redraw and repeated rightOffset application that discarded a manual horizontal viewport on refresh. No server, trading-engine or notification-policy changes.


Pro379 release verification completed: source6b6d447ead4e60b1f12957e42f0c20f543241af7, signed Actions36707758513 and lint36707758575 succeeded. Public update.json enabled at2.0.0-pro.379/950379. Downloaded32,670,665-byte APK SHA-256ff37cbe0180131239ae56fa46bb9b1b07c28a62f323e79d295922b91d80136ae matches public manifest/checksum; eight affected/fullscreen assets match source and canonical trading engine remains byte-identical to backend. All142 regression files and Chromium touch price/time-axis scaling, double-tap/Auto harga reset, overlay alignment, refresh-preserved viewport and existing fullscreen/pinch/pan/Back/Escape/theme/offline checks passed. Earlier Pro379 release-pending notes resolved. Actual Android device gestures and update notification receipt remain unobserved.


## 2026-09-30 — Mapping driver no-setup diagnosis (local audit)

Read-only production diagnosis at source048bafcb: six displayed tournament models remain BELUM DIEVALUASI reference cards, not wired detectors. Deployed scalper-engine v24 matches source and produces market_context only; scalper-setups explicitly returns active:[], retaining archives. Last setup24 September04:49 UTC; zero new setups in72h and zero rows for the six displayed IDs. Observed4,253 completed context runs/63 failures in72h;61 failures target.toFixed during05:32–06:32 UTC today, current runs recovered. Pro376 policy788 snapshots: zero score>=75 or A+; predominant failed gates M5 break/displacement and directional active target. Full143 regression files pass. No strategy/gate/runtime changes or production writes. Details: /workspace/mapping-driver-audit/DIAGNOSIS.md.


## 2026-09-30 — False Sniper attribution in legacy model (local correction)

Pro368 commit9bbca50 added Sniper ID, Fib78.6% and quickScalpRR0.8 metadata without calculating OTE or fixed-R targets. Removed unsupported metadata and Deep OTE labels from core/setup-model.js, preserving entry/SL/TP/score. Added BUY/SELL identity/geometry regression. Historical five other driver labels were common-context status rules, not independent detectors; see docs/mapping/SIX_DRIVER_LOGIC_AUDIT.md.


## 2026-09-30 — Pro382 six-driver evaluation

Diperbaiki: enam referensi tanpa detector, metadata Sniper palsu, Fib tidak dihitung, ensemble tanpa quorum, Shield tanpa risk policy, Rapid tanpa sesi/exit. Regresi menemukan crossing pada gap M5 dan lifecycle melewatkan candle berikutnya; diperbaiki. Statistik model baru memakai realized R, termasuk BE gap/time exit, dan mengecualikan outcome ambigu.
